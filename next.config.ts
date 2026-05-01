import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow remote avatars from supported OAuth providers + common hosts.
    // Add new entries here when wiring up additional providers.
    remotePatterns: [
      // Google
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Microsoft Graph
      { protocol: "https", hostname: "graph.microsoft.com" },
      // Gravatar
      { protocol: "https", hostname: "*.gravatar.com" },
      { protocol: "https", hostname: "gravatar.com" },
    ],
  },
};

export default nextConfig;
