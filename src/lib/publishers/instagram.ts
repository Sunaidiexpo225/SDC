// Instagram publishing via the Meta Graph API (Content Publishing).
//
// Flow for an Instagram Business/Creator account linked to a Facebook Page:
//   1. POST /{ig-user-id}/media        → create a media container (image_url or
//      video_url + caption). Video uses media_type=REELS.
//   2. (video only) poll /{container}?fields=status_code until FINISHED.
//   3. POST /{ig-user-id}/media_publish → publish the container.
//
// The media URL must be publicly fetchable by Meta — our Cloudinary delivery
// URLs are public, so they work directly.

const GRAPH = "https://graph.facebook.com/v21.0";
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
