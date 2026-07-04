import type { MetadataRoute } from "next";

// Web app manifest — lets Design Central be installed to the home screen
// on iPad / tablets / phones and launched as a standalone app (no browser
// chrome). Served at /manifest.webmanifest by Next's App Router.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sunaidi Design Central",
    short_name: "Design Central",
    description:
      "Run the social calendars for all your events from one dashboard — schedule, auto-publish and measure every account, with AI-written captions.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f6f9",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
