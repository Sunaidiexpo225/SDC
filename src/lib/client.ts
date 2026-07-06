// Thin fetch wrappers for the REST API (browser side).

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => req<T>(url),
  post: <T>(url: string, body?: unknown) =>
    req<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    req<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(url: string) => req<T>(url, { method: "DELETE" }),
};

export interface UploadedMedia {
  id: string;
  url: string;
  kind: string;
  filename: string;
  mimeType: string;
  size: number;
  // Present for Cloudinary uploads — lets the UI build per-platform crop URLs.
  publicId?: string | null;
  cloudName?: string | null;
  resourceType?: string | null;
  width?: number | null;
  height?: number | null;
}

// Uploads a file, transparently using whichever driver the server reports:
// - "s3": upload the bytes straight to the bucket via a presigned PUT (no
//   function body limit), then confirm.
// - "db": post the file as multipart to /api/media.
// The server validates type/size in the presign step before any bytes move.
export async function uploadMedia(
  file: File,
  eventId?: string,
): Promise<UploadedMedia> {
  const init = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      eventId,
    }),
  });
  const initData = await init.json().catch(() => null);
  if (!init.ok) throw new Error((initData && initData.error) || "Upload failed");

  if (initData.mode === "db") {
    const fd = new FormData();
    fd.append("file", file);
    if (eventId) fd.append("eventId", eventId);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error) || "Upload failed");
    return d as UploadedMedia;
  }

  if (initData.mode === "cloudinary") {
    // Browser uploads straight to Cloudinary with the signed ticket.
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", initData.apiKey);
    fd.append("timestamp", String(initData.timestamp));
    fd.append("signature", initData.signature);
    fd.append("folder", initData.folder);
    const up = await fetch(initData.uploadUrl, { method: "POST", body: fd });
    const upData = await up.json().catch(() => null);
    if (!up.ok || !upData?.public_id) {
      throw new Error(upData?.error?.message || "Upload to Cloudinary failed");
    }
    const done = await fetch(`/api/media/${initData.mediaId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId: upData.public_id,
        width: upData.width,
        height: upData.height,
      }),
    });
    const d = await done.json().catch(() => null);
    if (!done.ok) throw new Error((d && d.error) || "Upload failed");
    return d as UploadedMedia;
  }

  // s3
  const put = await fetch(initData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Upload to storage failed");

  const done = await fetch(`/api/media/${initData.mediaId}/complete`, {
    method: "POST",
  });
  const d = await done.json().catch(() => null);
  if (!done.ok) throw new Error((d && d.error) || "Upload failed");
  return d as UploadedMedia;
}
