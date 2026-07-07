// Facebook Page publishing via the Meta Graph API. Uses a Page access token +
// Page ID (the same kind of token you already generate for Instagram, but it
// must carry the pages_manage_posts permission).
//
//   • text        → POST /{page-id}/feed      { message }
//   • image       → POST /{page-id}/photos     { url, caption }
//   • video/reel  → POST /{page-id}/videos     { file_url, description }
//
// Facebook fetches the media URL server-side, so our public Cloudinary URLs work.

const GRAPH = "https://graph.facebook.com/v21.0";

async function fbPost(path: string, params: Record<string, string>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      body: new URLSearchParams(params),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      throw new Error(data?.error?.message || `Graph API error (${res.status})`);
    }
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export async function publishToFacebook(input: {
  pageId: string;
  accessToken: string;
  message: string;
  mediaUrl?: string | null;
  isVideo?: boolean;
}): Promise<{ id: string }> {
  const { pageId, accessToken, message, mediaUrl, isVideo } = input;
  if (!pageId || !accessToken) {
    throw new Error("Facebook account is missing its Page token or Page ID");
  }

  if (mediaUrl) {
    if (isVideo) {
      const data = await fbPost(`${pageId}/videos`, {
        access_token: accessToken,
        file_url: mediaUrl,
        description: message,
      });
      return { id: String(data.id ?? "") };
    }
    const data = await fbPost(`${pageId}/photos`, {
      access_token: accessToken,
      url: mediaUrl,
      caption: message,
    });
    return { id: String(data.post_id ?? data.id ?? "") };
  }

  const data = await fbPost(`${pageId}/feed`, { access_token: accessToken, message });
  return { id: String(data.id ?? "") };
}
