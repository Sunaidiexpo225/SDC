// Pure Cloudinary delivery-URL helpers — no SDK, no secret, safe to import in
// client components. Cloudinary delivery URLs are public and built by string
// composition; the API key/secret are only needed server-side to *upload*.

// Each platform's target aspect ratio ("screen size"). A single master video
// is delivered cropped to these per platform, with smart gravity so the
// subject stays centered.
const FEED_ASPECT: Record<string, string> = {
  instagram: "4:5", // portrait feed
  tiktok: "9:16", // vertical
  x: "16:9", // landscape
  facebook: "4:5",
  linkedin: "16:9",
};

// Vertical "Reel/Story" 9:16 wins on the platforms that have that surface.
const VERTICAL = new Set(["instagram", "facebook", "tiktok"]);

export function platformAspect(platform: string, format?: string | null): string {
  if (format === "Reel" && VERTICAL.has(platform)) return "9:16";
  return FEED_ASPECT[platform] ?? "1:1";
}

// Builds a delivery URL for a Cloudinary asset. When `aspect` is given the
// asset is fill-cropped to that ratio with auto gravity; q_auto/f_auto keep it
// optimized. `resourceType` is "image" or "video".
export function cldUrl(
  cloudName: string,
  resourceType: string,
  publicId: string,
  aspect?: string,
): string {
  const tx = ["c_fill", "g_auto", aspect ? `ar_${aspect}` : "", "q_auto", "f_auto"]
    .filter(Boolean)
    .join(",");
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${tx}/${publicId}`;
}

// The original asset, untouched (no transformation → no transformation credit,
// and the video-transform size cap doesn't apply).
export function cldRawUrl(
  cloudName: string,
  resourceType: string,
  publicId: string,
): string {
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`;
}

function aspectValue(aspect: string): number {
  const [w, h] = aspect.split(":").map(Number);
  return h ? w / h : 1;
}

// True when the source dimensions already match the target aspect (within a
// small tolerance), so no crop is needed.
export function aspectMatches(
  aspect: string,
  srcW?: number | null,
  srcH?: number | null,
): boolean {
  if (!srcW || !srcH) return false;
  return Math.abs(srcW / srcH - aspectValue(aspect)) < 0.02;
}

// A delivery URL suitable for a platform to *ingest* (publish). Images are
// fill-cropped to the platform aspect and forced to jpg. VIDEO is delivered at
// its own aspect (never cropped) — just re-containered to mp4/h264 — so a
// landscape 16:9 clip stays 16:9 instead of being cropped to a portrait feed
// ratio (all platforms accept landscape video).
export function platformPublishUrl(
  cloudName: string,
  resourceType: string,
  publicId: string,
  platform: string,
  format?: string | null,
): string {
  if (resourceType === "video") {
    return `https://res.cloudinary.com/${cloudName}/video/upload/q_auto,f_mp4/${publicId}`;
  }
  const aspect = platformAspect(platform, format);
  const tx = ["c_fill", "g_auto", `ar_${aspect}`, "q_auto", "f_jpg"].join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${tx}/${publicId}`;
}

// The per-platform delivery URL for an asset + post format. Video keeps its
// natural aspect (no crop). Images serve the original when they already match
// the platform ratio, otherwise fill-crop to it.
export function platformMediaUrl(
  cloudName: string,
  resourceType: string,
  publicId: string,
  platform: string,
  format?: string | null,
  srcW?: number | null,
  srcH?: number | null,
): string {
  if (resourceType === "video") {
    return cldRawUrl(cloudName, resourceType, publicId);
  }
  const aspect = platformAspect(platform, format);
  if (aspectMatches(aspect, srcW, srcH)) {
    return cldRawUrl(cloudName, resourceType, publicId);
  }
  return cldUrl(cloudName, resourceType, publicId, aspect);
}
