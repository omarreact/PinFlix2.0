/**
 * PinFlix master media contract.
 *
 * This module intentionally does not discover media from TMDB, guess CDN paths,
 * bypass signed links, or import third-party embed providers. Sources originate
 * from an operator-configured, licensed catalog and explicit host allowlists.
 */
export type MasterMediaType = "movie" | "tv";

export interface MediaSelection {
  type: MasterMediaType;
  id: string;
  season?: number;
  episode?: number;
}

export interface MasterMediaSource {
  id: string;
  label: string;
  url: string;
  kind: "hls" | "mp4";
  delivery: "direct" | "proxy";
  playbackUrl: string;
  subtitles?: Array<{ label: string; language: string; url: string }>;
}

export interface MasterMediaResponse {
  schema: "pinflix.media.v1";
  key: string;
  selection: MediaSelection;
  status: "ready" | "unavailable";
  defaultSourceId: string | null;
  sources: MasterMediaSource[];
}

const ID = /^[1-9][0-9]{0,9}$/;
const EPISODE = /^[1-9][0-9]{0,2}$/;

export function parseMediaSelection(params: URLSearchParams): MediaSelection | null {
  const type = params.get("type");
  const id = params.get("id") ?? "";
  if ((type !== "movie" && type !== "tv") || !ID.test(id)) return null;
  const season = params.get("season");
  const episode = params.get("episode");
  if (type === "movie") {
    return season === null && episode === null ? { type, id } : null;
  }
  if (!season || !episode || !EPISODE.test(season) || !EPISODE.test(episode)) return null;
  return { type, id, season: Number(season), episode: Number(episode) };
}

export function mediaSelectionKey(selection: MediaSelection): string {
  return selection.type === "movie"
    ? `movie:${selection.id}`
    : `tv:${selection.id}:s${selection.season}e${selection.episode}`;
}

function hostsFromEnv(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && !s.includes(":") && !s.includes("/")));
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host !== "localhost" && !host.endsWith(".localhost") &&
    !host.endsWith(".local") && !host.endsWith(".internal") &&
    !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(":");
}

/**
 * Authoritative response formatter. No implicit origins or fallbacks.
 * All playback media origins must be explicitly allowlisted, including local
 * registry entries. HTTP media additionally requires a proxy allowlist.
 */
export function buildMasterMediaResponse(
  selection: MediaSelection,
  entries: unknown,
  mediaAllowedHosts: string | undefined,
  proxyAllowedHosts: string | undefined,
): MasterMediaResponse {
  const hosts = hostsFromEnv(mediaAllowedHosts);
  const proxyHosts = hostsFromEnv(proxyAllowedHosts);
  const sources: MasterMediaSource[] = [];
  const seen = new Set<string>();

  if (Array.isArray(entries)) {
    for (const raw of entries.slice(0, 30)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.label !== "string" || typeof item.url !== "string" ||
          (item.kind !== "hls" && item.kind !== "mp4") || item.url.length > 4096) continue;
      try {
        const url = new URL(item.url);
        const host = url.hostname.toLowerCase();
        if ((url.protocol !== "https:" && url.protocol !== "http:") ||
            url.username || url.password || !isPublicHostname(host) ||
            !hosts.has(host) || seen.has(url.href)) continue;
        const kind = /\.m3u8$/i.test(url.pathname) ? "hls" :
          /\.mp4$/i.test(url.pathname) ? "mp4" : null;
        if (kind !== item.kind) continue;
        if (url.protocol === "http:" && !proxyHosts.has(host)) continue;
        const subtitles = Array.isArray(item.subtitles) ? item.subtitles.slice(0, 20).flatMap((track) => {
          if (!track || typeof track !== "object" || typeof track.label !== "string" || typeof track.language !== "string" || typeof track.url !== "string") return [];
          try {
            const sub = new URL(track.url);
            if (!isPublicHostname(sub.hostname) || !hosts.has(sub.hostname.toLowerCase()) || sub.username || sub.password || !["http:", "https:"].includes(sub.protocol) || !/\.(srt|vtt)$/i.test(sub.pathname)) return [];
            const proxy = sub.protocol === "http:" || /\.srt$/i.test(sub.pathname);
            if (proxy && !proxyHosts.has(sub.hostname.toLowerCase())) return [];
            return [{ label: track.label.slice(0, 80), language: track.language.slice(0, 20), url: proxy ? `/api/media-proxy?url=${encodeURIComponent(sub.href)}` : sub.href }];
          } catch { return []; }
        }) : [];
        seen.add(url.href);
        sources.push({
          id: `source-${sources.length + 1}`,
          label: item.label.trim().slice(0, 80) || "Licensed source",
          url: url.href,
          kind,
          delivery: url.protocol === "https:" ? "direct" : "proxy",
          ...(subtitles.length ? { subtitles } : {}),
          playbackUrl: url.protocol === "https:"
            ? url.href
            : `/api/media-proxy?url=${encodeURIComponent(url.href)}`,
        });
      } catch {
        // Malformed URL: omit it rather than risk exposing or proxying it.
      }
    }
  }

  return {
    schema: "pinflix.media.v1",
    key: mediaSelectionKey(selection),
    selection,
    status: sources.length > 0 ? "ready" : "unavailable",
    defaultSourceId: sources[0]?.id ?? null,
    sources,
  };
}
