import { NextRequest, NextResponse } from "next/server";
import own from "@/data/own-sources.json";

export const dynamic = "force-dynamic";

export interface Source {
  label: string;
  url: string;
  kind: "hls" | "mp4";
  subtitles?: Array<{ label: string; language: string; url: string }>;
}

type Item = { label?: unknown; url?: unknown; subtitles?: unknown };
type Registry = Record<string, unknown>;
const registry = own as Registry;

/**
 * The media catalog is an OWNER-CONFIGURED, licensed media API.
 * TMDB contains metadata, never playable video URLs.
 */
function hostAllowed(host: string, source: "local" | "remote" | "public"): boolean {
  if (source === "public") return host === "media.pincodeit.com";
  const configured = (process.env.MEDIA_SOURCE_ALLOWED_HOSTS ?? "")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return source === "local" ? configured.length === 0 || configured.includes(host) :
    configured.includes(host); // Remote API requires an explicit media host allowlist.
}

function normalize(input: unknown, origin: "local" | "remote" | "public"): Source[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 30).flatMap((entry: Item) => {
    if (!entry || typeof entry !== "object" ||
        typeof entry.label !== "string" || typeof entry.url !== "string") return [];
    try {
      const url = new URL(entry.url);
      const host = url.hostname.toLowerCase();
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
          !hostAllowed(host, origin) || entry.url.length > 4096) return [];
      // Only expose direct HLS and MP4 URLs (no third-party iframe scraping).
      const kind = /\.m3u8$/i.test(url.pathname) ? "hls" :
        /\.mp4$/i.test(url.pathname) ? "mp4" : null;
      if (!kind) return [];
      const subtitles = Array.isArray(entry.subtitles) ? entry.subtitles.slice(0, 20).flatMap((track) => {
        if (!track || typeof track !== "object" || typeof track.label !== "string" || typeof track.language !== "string" || typeof track.url !== "string") return [];
        try { const u = new URL(track.url); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && hostAllowed(u.hostname.toLowerCase(), origin) && /\.(srt|vtt)$/i.test(u.pathname) ? [{ label: track.label.slice(0, 80), language: track.language.slice(0, 20), url: u.href }] : []; } catch { return []; }
      }) : [];
      return [{ ...(subtitles.length ? { subtitles } : {}), label: entry.label.trim().slice(0, 80) || "Media source",
        url: url.toString(), kind }];
    } catch { return []; }
  });
}

async function licensedCatalog(key: string, type: "movie" | "tv", id: string,
  season: string | null, episode: string | null): Promise<Source[]> {
  const configuredEndpoint = process.env.MEDIA_CATALOG_URL?.trim();
  // First-party public-use content is independently opt-in at the Cloudflare
  // media edge; private catalog requests still require a server-side token.
  const endpoint = configuredEndpoint || "https://media.pincodeit.com/public-resolve";
  const publicCatalog = !configuredEndpoint;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return [];
    url.searchParams.set("key", key);
    url.searchParams.set("type", type);
    url.searchParams.set("tmdbId", id);
    if (type === "tv") {
      url.searchParams.set("season", season!);
      url.searchParams.set("episode", episode!);
    }
    const token = publicCatalog ? undefined : process.env.MEDIA_CATALOG_TOKEN;
    const result = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(publicCatalog ? 3500 : 7000),
      cache: "no-store",
    });
    if (!result.ok) return [];
    const data: unknown = await result.json();
    return normalize((data as { sources?: unknown })?.sources, publicCatalog ? "public" : "remote");
  } catch { return []; }
}

/** Optional Internet Archive metadata discovery. Opt-in only: rights must be verified. */
async function archiveSource(title: string, year: string): Promise<Source[]> {
  if (process.env.ENABLE_ARCHIVE_SOURCES !== "true") return [];
  try {
    const query = new URL("https://archive.org/advancedsearch.php");
    query.searchParams.set("q",
      `title:("${title.replace(/"/g, "")}") AND mediatype:movies AND collection:feature_films`);
    ["identifier", "title", "year"].forEach((field) => query.searchParams.append("fl[]", field));
    query.searchParams.set("rows", "10");
    query.searchParams.set("output", "json");
    const result = await fetch(query, { next: { revalidate: 86400 },
      signal: AbortSignal.timeout(7000) });
    if (!result.ok) return [];
    const data = await result.json();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const docs: { identifier: string; title: string; year?: string }[] =
      data.response?.docs ?? [];
    const match = docs.find((d) => norm(d.title) === norm(title) &&
      (!year || !d.year || Math.abs(Number(d.year) - Number(year)) <= 1));
    if (!match || !/^[a-zA-Z0-9_\-\.]+$/.test(match.identifier)) return [];
    const metadata = await fetch(`https://archive.org/metadata/${match.identifier}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000) });
    if (!metadata.ok) return [];
    const files: { name: string; format: string; size?: string }[] =
      (await metadata.json()).files ?? [];
    const mp4 = files.filter((f) => typeof f.name === "string" && /\.mp4$/i.test(f.name))
      .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0))[0];
    if (!mp4) return [];
    // Inclusion in the Archive is not proof of public-domain status.
    return normalize([{ label: "Internet Archive (verify rights)",
      url: `https://archive.org/download/${match.identifier}/${encodeURIComponent(mp4.name)}` }],
      "local");
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const type = p.get("type");
  const id = (p.get("id") ?? p.get("tmdbId")) ?? "";
  const title = (p.get("title") ?? "").slice(0, 200);
  const year = (p.get("year") ?? "").slice(0, 4);
  const season = p.get("season");
  const episode = p.get("episode");
  if ((type !== "movie" && type !== "tv") || !/^\d{1,10}$/.test(id) ||
      (type === "tv" && (!season || !episode ||
        !/^[1-9]\d{0,2}$/.test(season) || !/^[1-9]\d{0,2}$/.test(episode)))) {
    return NextResponse.json({ error: "Invalid media selection" }, { status: 400 });
  }

  const keys = type === "tv" ?
    [`tv:${id}:s${season}e${episode}`, `tv:${id}`] : [`movie:${id}`];
  // Optional private persistent registry on a Node/BDIX host. Vercel uses the
  // bundled registry or remote catalog because its filesystem is ephemeral.
  let activeRegistry = registry;
  if (process.env.MEDIA_REGISTRY_PATH) {
    try {
      const { readFile } = await import("node:fs/promises");
      const loaded: unknown = JSON.parse(await readFile(process.env.MEDIA_REGISTRY_PATH, "utf8"));
      activeRegistry = loaded && typeof loaded === "object" && !Array.isArray(loaded) ? loaded as Registry : {};
    } catch { activeRegistry = {}; }
  }
  const delisted = new Set((process.env.MEDIA_DELISTED_KEYS ?? "").split(",").map((key) => key.trim()));
  if (keys.some((key) => delisted.has(key))) return NextResponse.json({ sources: [] }, { headers: { "Cache-Control": "no-store" } });
  const local = keys.flatMap((key) => normalize(activeRegistry[key], "local"));
  const [remote, archive] = await Promise.all([
    licensedCatalog(keys[0], type, id, season, episode),
    type === "movie" && title ? archiveSource(title, year) : Promise.resolve([]),
  ]);

  // No fabricated CDN paths: only owner-configured media sources may be returned.
  const seen = new Set<string>();
  const sources = [...local, ...remote, ...archive].filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });

  return NextResponse.json({ sources }, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
