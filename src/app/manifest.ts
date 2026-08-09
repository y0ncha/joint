import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Joint",
    short_name: "Joint",
    description: "A shared household money workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6d4b8",
    theme_color: "#f6d4b8",
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
