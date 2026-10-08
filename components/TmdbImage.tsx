"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Keep Next.js image optimization when it works, but fall back to the
 * official TMDB CDN if Vercel's optimizer rejects an image request.
 * If the original image is also unavailable, show a readable placeholder.
 */
export default function TmdbImage({
  src,
  alt,
  onError,
  unoptimized,
  ...props
}: ImageProps) {
  const source = typeof src === "string" ? src : "";
  const [fallback, setFallback] = useState<{
    source: string;
    stage: "direct" | "unavailable";
  } | null>(null);
  const stage = fallback?.source === source ? fallback.stage : "optimized";

  if (stage === "unavailable") {
    return (
      <span
        role="img"
        aria-label={alt || "Artwork unavailable"}
        className="absolute inset-0 flex items-center justify-center bg-[#151815] p-3 text-center text-xs font-semibold text-white/55"
      >
        {alt || "Artwork unavailable"}
      </span>
    );
  }

  const direct = unoptimized || stage === "direct";

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={direct}
      onError={(event) => {
        setFallback({
          source,
          stage: direct ? "unavailable" : "direct",
        });
        onError?.(event);
      }}
    />
  );
}
