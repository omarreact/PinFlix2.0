import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // PinFlix uses TMDB's public poster/backdrop CDN.
    // External streaming-site CDNs from the uploaded sample are intentionally
    // not added, because the existing app doesn't request those images.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
