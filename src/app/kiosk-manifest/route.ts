import type { MetadataRoute } from "next";
import { NextResponse } from "next/server";

/**
 * Manifest route for the kiosk subdomain. Regular `manifest.ts` metadata
 * routes only work at the app root, so the kiosk manifest is served via a
 * route handler with the correct `application/manifest+json` content type —
 * otherwise Chrome deems the app non-installable and only offers "Create
 * shortcut".
 */
const kioskManifest: MetadataRoute.Manifest = {
  id: "chronify-kiosk",
  name: "Chronify Kiosk",
  short_name: "Chronify Kiosk",
  description: "Kiosk-Modus für Stempeluhr",
  start_url: "/de/kiosk",
  scope: "/",
  display: "fullscreen",
  display_override: ["fullscreen", "standalone"],
  orientation: "portrait-primary",
  background_color: "#ffffff",
  theme_color: "#2563eb",
  lang: "de",
  categories: ["productivity", "business"],
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: "/icons/maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export function GET() {
  return NextResponse.json(kioskManifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
