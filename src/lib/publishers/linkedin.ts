// LinkedIn publishing via the REST Posts API.
//
// Auth: an OAuth 2.0 member access token with the `w_member_social` scope
// (posts on the member's behalf). The author is the member URN we resolve at
// connect time from the OpenID `sub` claim: `urn:li:person:{sub}`.
//
//   • text   → POST /rest/posts { author, commentary, ... }
//   • image  → initialize upload → PUT bytes → POST /rest/posts with the image URN
//   • video  → initialize upload → PUT part(s) → finalize → POST /rest/posts with the video URN
//
// LinkedIn versions its REST API monthly (LinkedIn-Version: YYYYMM) and expires
// versions after ~1 year, so it's overridable via LINKEDIN_VERSION.

const REST = "https://api.linkedin.com/rest";
const VERSION = process.env.LINKEDIN_VERSION || "202506";

function headers(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

async function liError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body?.message as string) || `LinkedIn API error (${res.status})`;
}

// Fetch the (Cloudinary-hosted) media as raw bytes so we can upload it to LinkedIn.
async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download media for LinkedIn (${res.status})`);
  const type = res.headers.get("content-type") || "application/octet-stream";
  const buf = new Uint8Array(await res.arrayBuffer());
  return { bytes: buf, type };
}

// Upload an image: initialize → PUT bytes → return the image URN.
async function uploadImage(owner: string, token: string, mediaUrl: string): Promise<string> {
  const initRes = await fetch(`${REST}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!initRes.ok) throw new Error(await liError(initRes));
  const init = await initRes.json();
  const uploadUrl: string = init?.value?.uploadUrl;
  const imageUrn: string = init?.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an image upload URL");

  const { bytes, type } = await fetchBytes(mediaUrl);
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
    body: bytes as unknown as BodyInit,
  });
  if (!put.ok) throw new Error(`LinkedIn image upload failed (${put.status})`);
  return imageUrn;
}

// Upload a video: initialize → PUT each part (collect ETags) → finalize → URN.
async function uploadVideo(owner: string, token: string, mediaUrl: string): Promise<string> {
  const { bytes } = await fetchBytes(mediaUrl);
  const initRes = await fetch(`${REST}/videos?action=initializeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) throw new Error(await liError(initRes));
  const init = await initRes.json();
  const videoUrn: string = init?.value?.video;
  const uploadToken: string = init?.value?.uploadToken ?? "";
  const instructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> =
    init?.value?.uploadInstructions || [];
  if (!videoUrn || instructions.length === 0) {
    throw new Error("LinkedIn did not return video upload instructions");
  }

  const partIds: string[] = [];
  for (const part of instructions) {
    const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: chunk as unknown as BodyInit,
    });
    if (!put.ok) throw new Error(`LinkedIn video upload failed (${put.status})`);
    const etag = put.headers.get("etag") || put.headers.get("ETag");
    if (etag) partIds.push(etag.replace(/"/g, ""));
  }

  const finalize = await fetch(`${REST}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: headers(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds: partIds },
    }),
  });
  if (!finalize.ok) throw new Error(await liError(finalize));
  return videoUrn;
}

// List the organizations (Company Pages) the authenticated member administers,
// so the operator can choose which Page an event posts as. Requires the
// Community Management API product + r_organization_admin scope. Best-effort:
// returns [] if the scope/product isn't granted.
export async function listAdminOrganizations(
  token: string,
): Promise<Array<{ urn: string; name: string }>> {
  const url =
    `${REST}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` +
    `&projection=(elements*(*,organization~(localizedName)))`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  const elements: unknown[] = body?.elements || [];
  const out: Array<{ urn: string; name: string }> = [];
  for (const el of elements as Array<Record<string, unknown>>) {
    const urn = typeof el.organization === "string" ? el.organization : "";
    if (!urn) continue;
    const decorated = el["organization~"] as { localizedName?: string } | undefined;
    out.push({ urn, name: decorated?.localizedName || urn.replace("urn:li:organization:", "Page ") });
  }
  return out;
}

export async function publishToLinkedIn(input: {
  accessToken: string;
  authorUrn: string; // urn:li:person:xxx (or urn:li:organization:xxx)
  text: string;
  mediaUrl?: string | null;
  isVideo?: boolean;
}): Promise<{ id: string }> {
  const { accessToken, authorUrn, text, mediaUrl, isVideo } = input;
  if (!accessToken || !authorUrn) {
    throw new Error("LinkedIn account is missing its access token or member URN");
  }

  const post: Record<string, unknown> = {
    author: authorUrn,
    commentary: text || "",
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaUrl) {
    const urn = isVideo
      ? await uploadVideo(authorUrn, accessToken, mediaUrl)
      : await uploadImage(authorUrn, accessToken, mediaUrl);
    post.content = { media: { id: urn } };
  }

  const res = await fetch(`${REST}/posts`, {
    method: "POST",
    headers: headers(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error(await liError(res));
  // The post URN comes back in the x-restli-id / x-linkedin-id header.
  const id =
    res.headers.get("x-restli-id") ||
    res.headers.get("x-linkedin-id") ||
    (await res.json().catch(() => null))?.id ||
    "";
  return { id: String(id) };
}
