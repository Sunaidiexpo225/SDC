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
