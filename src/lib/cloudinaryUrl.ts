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

// Convenience: the per-platform URL for a given asset + post format.
export function platformMediaUrl(
  cloudName: string,
  resourceType: string,
  publicId: string,
  platform: string,
  format?: string | null,
): string {
  return cldUrl(cloudName, resourceType, publicId, platformAspect(platform, format));
}
