// X (Twitter) publishing via API v2, authenticated with OAuth 1.0a user context
// (post to your own account with the 4 portal credentials — no redirect flow):
//   consumer key/secret (app-level, env)  +  access token/secret (per account).
//
// Flow: optionally upload media to v1.1 media/upload (simple for images, chunked
// for video), then POST /2/tweets with the text and any media_ids.

import crypto from "crypto";

const TWEETS = "https://api.twitter.com/2/tweets";
const UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";

export interface XCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

// RFC-3986 percent-encoding (stricter than encodeURIComponent).
function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// Build an OAuth 1.0a Authorization header. `params` are only those that take
// part in the signature — query params and x-www-form-urlencoded fields — NOT
// multipart fields or a JSON body.
function authHeader(method: string, baseUrl: string, params: Record<string, string>, c: XCreds): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };
  const all: Record<string, string> = { ...params, ...oauth };
  const paramStr = Object.keys(all).sort().map((k) => `${pct(k)}=${pct(all[k])}`).join("&");
  const base = [method.toUpperCase(), pct(baseUrl), pct(paramStr)].join("&");
  const key = `${pct(c.consumerSecret)}&${pct(c.accessTokenSecret)}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  const header: Record<string, string> = { ...oauth, oauth_signature: sig };
  return "OAuth " + Object.keys(header).sort().map((k) => `${pct(k)}="${pct(header[k])}"`).join(", ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const qs = (p: Record<string, string>) =>
  Object.keys(p).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(p[k])}`).join("&");

async function fetchT(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function uploadImage(c: XCreds, bytes: Buffer, mime: string): Promise<string> {
  const header = authHeader("POST", UPLOAD, {}, c);
  const form = new FormData();
  form.append("media", new Blob([bytes as unknown as BlobPart], { type: mime }), "upload");
  const res = await fetchT(UPLOAD, { method: "POST", headers: { Authorization: header }, body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.media_id_string) {
    throw new Error(data?.errors?.[0]?.message || data?.error || `X image upload failed (${res.status})`);
  }
  return data.media_id_string as string;
}

async function uploadVideo(c: XCreds, bytes: Buffer, mime: string): Promise<string> {
  // INIT
  const initP = { command: "INIT", total_bytes: String(bytes.length), media_type: mime, media_category: "tweet_video" };
  const initRes = await fetchT(`${UPLOAD}?${qs(initP)}`, {
    method: "POST",
    headers: { Authorization: authHeader("POST", UPLOAD, initP, c) },
  });
  const initData = await initRes.json().catch(() => null);
  const mediaId: string | undefined = initData?.media_id_string;
  if (!initRes.ok || !mediaId) throw new Error(initData?.error || `X video INIT failed (${initRes.status})`);

  // APPEND (~4 MB chunks)
  const CHUNK = 4 * 1024 * 1024;
  let seg = 0;
  for (let off = 0; off < bytes.length; off += CHUNK) {
    const chunk = bytes.subarray(off, Math.min(off + CHUNK, bytes.length));
    const apP = { command: "APPEND", media_id: mediaId, segment_index: String(seg) };
    const form = new FormData();
    form.append("media", new Blob([chunk as unknown as BlobPart], { type: "application/octet-stream" }), "chunk");
    const apRes = await fetchT(`${UPLOAD}?${qs(apP)}`, {
      method: "POST",
      headers: { Authorization: authHeader("POST", UPLOAD, apP, c) },
      body: form,
    });
    if (!apRes.ok) throw new Error(`X video APPEND failed (${apRes.status})`);
    seg++;
  }

  // FINALIZE
  const finP = { command: "FINALIZE", media_id: mediaId };
  const finRes = await fetchT(`${UPLOAD}?${qs(finP)}`, {
    method: "POST",
    headers: { Authorization: authHeader("POST", UPLOAD, finP, c) },
  });
  const finData = await finRes.json().catch(() => null);
  if (!finRes.ok) throw new Error(finData?.error || `X video FINALIZE failed (${finRes.status})`);

  // Poll STATUS until the async processing finishes.
  let info = finData?.processing_info;
  for (let i = 0; info && info.state !== "succeeded" && i < 18; i++) {
    if (info.state === "failed") throw new Error("X could not process the video");
    await sleep((info.check_after_secs || 3) * 1000);
    const stP = { command: "STATUS", media_id: mediaId };
    const stRes = await fetchT(`${UPLOAD}?${qs(stP)}`, {
      method: "GET",
      headers: { Authorization: authHeader("GET", UPLOAD, stP, c) },
    });
    info = (await stRes.json().catch(() => null))?.processing_info;
  }
  return mediaId;
}

async function postTweet(c: XCreds, text: string, mediaIds: string[]): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (mediaIds.length) body.media = { media_ids: mediaIds };
  const res = await fetchT(TWEETS, {
    method: "POST",
    headers: { Authorization: authHeader("POST", TWEETS, {}, c), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.id) {
    throw new Error(data?.detail || data?.title || data?.errors?.[0]?.message || `X post failed (${res.status})`);
  }
  return data.data.id as string;
}

export async function publishToX(input: {
  creds: XCreds;
  caption: string;
  mediaUrl?: string | null;
  mimeType?: string | null;
  isVideo?: boolean;
}): Promise<{ id: string }> {
  const { creds } = input;
  if (!creds.consumerKey || !creds.consumerSecret || !creds.accessToken || !creds.accessTokenSecret) {
    throw new Error("X account is missing its keys");
  }
  let mediaIds: string[] = [];
  if (input.mediaUrl) {
    const r = await fetchT(input.mediaUrl, { method: "GET" }, 30000);
    if (!r.ok) throw new Error(`Could not fetch media for X (${r.status})`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const mime = input.mimeType || (input.isVideo ? "video/mp4" : "image/jpeg");
    const id = input.isVideo ? await uploadVideo(creds, bytes, mime) : await uploadImage(creds, bytes, mime);
    mediaIds = [id];
  }
  const text = (input.caption || "").slice(0, 280); // X hard limit
  const id = await postTweet(creds, text, mediaIds);
  return { id };
}
