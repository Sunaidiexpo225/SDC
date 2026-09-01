// Instagram publishing via the Instagram Content Publishing API.
//
//   1. POST /{ig-user-id}/media        → create a media container (image_url or
//      video_url + caption). Video uses media_type=REELS.
//   2. poll /{container}?fields=status_code until FINISHED.
//   3. POST /{ig-user-id}/media_publish → publish the container.
//
// The base host depends on how the app was set up in Meta:
//   • "Instagram API with Facebook Login"    → https://graph.facebook.com  (default)
//   • "Instagram API with Instagram Login"   → https://graph.instagram.com
// Override with IG_API_BASE if needed. The endpoint paths are identical either
// way. The media URL must be publicly fetchable — our Cloudinary URLs are.

const GRAPH = process.env.IG_API_BASE || "https://graph.facebook.com/v21.0";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch with a hard timeout so a hung Graph connection can't block a publish
// past the function's time budget.
async function fetchT(url: string, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface IgPublishInput {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrl: string;
  isVideo: boolean;
}

async function graphPost(path: string, params: Record<string, string>) {
  const res = await fetchT(`${GRAPH}/${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error?.message || `Graph API error (${res.status})`);
  }
  return data;
}

export async function publishToInstagram(
  input: IgPublishInput,
): Promise<{ id: string }> {
  const { igUserId, accessToken, caption, mediaUrl, isVideo } = input;
  if (!igUserId || !accessToken) {
    throw new Error("Instagram account is missing its token or account ID");
  }

  // 1. Create the media container.
  const createParams: Record<string, string> = {
    access_token: accessToken,
    caption,
  };
  if (isVideo) {
    createParams.media_type = "REELS";
    createParams.video_url = mediaUrl;
  } else {
    createParams.image_url = mediaUrl;
  }
  const container = await graphPost(`${igUserId}/media`, createParams);
  const creationId: string = container.id;

  // 2. Wait until the container is ready. Video always processes async. Image
  // containers are usually quick, but Meta still has to fetch the image from
  // its URL — publishing before that finishes fails with "Media ID is not
  // available", so poll for images too.
  const attempts = isVideo ? 18 : 10;
  const delayMs = isVideo ? 3000 : 1500;
  let ready = false;
  for (let i = 0; i < attempts; i++) {
    await sleep(delayMs);
    const res = await fetchT(
      `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
    ).catch(() => null);
    const st = res ? await res.json().catch(() => null) : null;
    if (st?.status_code === "FINISHED") {
      ready = true;
      break;
    }
    if (st?.status_code === "ERROR") {
      throw new Error(
        isVideo
          ? "Instagram could not process the video"
          : "Instagram could not process the image",
      );
    }
    // Some image containers don't expose status_code at all — don't block on a
    // field the account never returns; the publish retry below covers it.
    if (!isVideo && st && st.status_code === undefined) {
      ready = true;
      break;
    }
  }
  if (!ready) {
    throw new Error(
      isVideo
        ? "Instagram video processing timed out"
        : "Instagram image processing timed out",
    );
  }

  // 3. Publish. Meta can still briefly report the container as unavailable just
  // after it reports FINISHED, so retry that specific error a few times.
  let lastErr: Error | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const published = await graphPost(`${igUserId}/media_publish`, {
        access_token: accessToken,
        creation_id: creationId,
      });
      return { id: published.id };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error("Instagram publish failed");
      if (!/not available|not ready/i.test(lastErr.message)) throw lastErr;
      await sleep(2000);
    }
  }
  throw lastErr ?? new Error("Instagram publish failed");
}
