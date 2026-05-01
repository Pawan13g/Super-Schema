import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Super Schema",
    short_name: "Super Schema",
    description:
      "Visual database designer with AI-powered schema generation, multi-dialect SQL output, and ORM model export.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0b0f",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["productivity", "developer"],
    lang: "en",
    shortcuts: [
      {
        name: "Open canvas",
        short_name: "Canvas",
        url: "/",
      },
      {
        name: "Projects",
        short_name: "Projects",
        url: "/projects",
      },
      {
        name: "Settings",
        short_name: "Settings",
        url: "/settings",
      },
    ],
  };
}
