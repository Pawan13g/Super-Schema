import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Allow indexing of public marketing/docs pages, block API + private app
// routes. Crawlers also get redirected away from /projects + /settings by
// the auth middleware so they couldn't index user data anyway, but we
// declare the intent explicitly.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/projects",
          "/projects/",
          "/settings",
          "/settings/",
        ],
      },
      // Don't waste GPTBot / CCBot bandwidth on auth-gated pages either.
      {
        userAgent: ["GPTBot", "CCBot", "anthropic-ai", "ClaudeBot"],
        allow: ["/", "/docs", "/terms", "/privacy"],
        disallow: ["/api/", "/projects", "/settings", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
