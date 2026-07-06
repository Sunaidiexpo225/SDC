// Instagram publishing via the Instagram Content Publishing API.
//
//   1. POST /{ig-user-id}/media        → create a media container (image_url or
//      video_url + caption). Video uses media_type=REELS.
//   2. (video only) poll /{container}?fields=status_code until FINISHED.
//   3. POST /{ig-user-id}/media_publish → publish the container.
//
// The base host depends on how the app was set up in Meta:
//   • "Instagram API with Facebook Login"    → https://graph.facebook.com  (default)
//   • "Instagram API with Instagram Login"   → https://graph.instagram.com
// Override with IG_API_BASE if needed. The endpoint paths are identical either
// way. The media URL must be publicly fetchable — our Cloudinary URLs are.

const GRAPH = process.env.IG_API_BASE || "https://graph.facebook.com/v21.0";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface IgPublishInput {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrl: string;
  isVideo: boolean;
}

async function graphPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error?.message || `Graph API error (${res.status})`);
  }
  return data;
}

// Best-effort lookup of the account's real @username, used to replace the
// placeholder handle when an account is connected. Never throws — on any
// failure (bad token, network, timeout) it just returns null and the caller
// keeps the existing handle.
export async function fetchInstagramUsername(
  igUserId: string,
  accessToken: string,
): Promise<string | null> {
  if (!igUserId || !accessToken) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `${GRAPH}/${igUserId}?fields=username&access_token=${encodeURIComponent(accessToken)}`,
      { signal: ctrl.signal },
    );
    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data.username === "string") {
      return data.username;
    }
  } catch {
    // ignore — handle stays as-is
  } finally {
    clearTimeout(timer);
  }
  return null;
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

  // 2. Video containers process asynchronously — wait until ready.
  if (isVideo) {
    let ready = false;
    for (let i = 0; i < 18; i++) {
      await sleep(3000);
      const res = await fetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
      );
      const st = await res.json().catch(() => null);
      if (st?.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (st?.status_code === "ERROR") {
        throw new Error("Instagram could not process the video");
      }
    }
    if (!ready) throw new Error("Instagram video processing timed out");
  }

  // 3. Publish.
  const published = await graphPost(`${igUserId}/media_publish`, {
    access_token: accessToken,
    creation_id: creationId,
  });
  return { id: published.id };
}
