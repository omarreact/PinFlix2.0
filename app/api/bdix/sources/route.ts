import { NextRequest, NextResponse } from "next/server";
import {
  BDIX_DIRECTORY_URL, filterBdixDirectory, parseBdixDirectory,
} from "@/lib/bdix-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, READ-ONLY directory of unverified third-party references.
 * No media crawling, health pings, private-network requests or playback rights.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  try {
    // The only external request is to the hard-coded GitHub raw file URL.
    const response = await fetch(BDIX_DIRECTORY_URL, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) throw new Error("Directory feed unavailable");
    const size = Number(response.headers.get("content-length") || 0);
    if (size > 300_000) throw new Error("Directory too large");
    const markdown = await response.text();
    const entries = parseBdixDirectory(markdown);
    if (entries.length < 50) throw new Error("Directory incomplete");
    const page = filterBdixDirectory(entries, {
      q: query.get("q") || undefined,
      type: query.get("type") || undefined,
      scope: query.get("scope") || undefined,
      page: Number(query.get("page") || 1),
      limit: Number(query.get("limit") || 24),
    });
    return NextResponse.json({
      schema: "pinflix.bdix.registry.v1",
      source: BDIX_DIRECTORY_URL,
      directoryCount: entries.length,
      verification: "unverified-directory-references",
      ...page,
    }, { headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({
      schema: "pinflix.bdix.registry.v1",
      error: "The directory feed could not be loaded. No sources are being assumed active.",
      items: [], total: 0,
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
