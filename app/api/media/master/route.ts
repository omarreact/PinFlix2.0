import { NextRequest, NextResponse } from "next/server";
import { GET as getConfiguredSources } from "@/app/api/sources/route";
import {
  buildMasterMediaResponse,
  parseMediaSelection,
} from "@/lib/media-master";

export const dynamic = "force-dynamic";

/**
 * Canonical PinFlix playback discovery endpoint.
 *
 * GET /api/media/master?type=movie&id=123
 * GET /api/media/master?type=tv&id=456&season=1&episode=2
 *
 * A TMDB ID is a metadata reference, not a media URL. This endpoint returns
 * only licensed sources explicitly configured by the PinFlix operator.
 * It does not scrape third-party portals or generate guessed CDN paths.
 */
export async function GET(request: NextRequest) {
  const selection = parseMediaSelection(request.nextUrl.searchParams);
  if (!selection) {
    return NextResponse.json(
      { error: "Invalid media selection", schema: "pinflix.media.v1" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Reuse the existing licensed resolver, preserving /api/sources clients.
  const upstream = await getConfiguredSources(request);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Media catalog unavailable", schema: "pinflix.media.v1" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const raw: unknown = await upstream.json().catch(() => null);
  const sources = raw && typeof raw === "object" && "sources" in raw
    ? (raw as { sources: unknown }).sources
    : [];
  const response = buildMasterMediaResponse(
    selection,
    sources,
    // media.pincodeit.com is this application's first-party public-use CDN.
    // Private/third-party media hosts remain explicitly environment-allowlisted.
    [process.env.MEDIA_SOURCE_ALLOWED_HOSTS, "media.pincodeit.com"].filter(Boolean).join(","),
    process.env.MEDIA_PROXY_ALLOWED_HOSTS,
  );

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
