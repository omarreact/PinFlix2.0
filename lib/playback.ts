export interface SubtitleTrack { label: string; language: string; url: string }
export interface PlayableSource { label: string; url: string; kind: "hls" | "mp4"; subtitles?: SubtitleTrack[] }

/** Preserve the resolver's delivery URL, including its same-origin HTTP proxy. */
export function normalizePlaybackSource(value: unknown): PlayableSource | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.label !== "string" || typeof entry.url !== "string" || (entry.kind !== "hls" && entry.kind !== "mp4")) return null;
  const playbackUrl = typeof entry.playbackUrl === "string" ? entry.playbackUrl : entry.url;
  try {
    const url = new URL(playbackUrl, "https://pinflix.invalid");
    if (url.username || url.password) return null;
    if (playbackUrl.startsWith("/")) {
      if (url.origin !== "https://pinflix.invalid" || url.pathname !== "/api/media-proxy") return null;
      const target = new URL(url.searchParams.get("url") ?? "");
      if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || !(entry.kind === "hls" ? /\.m3u8$/i : /\.mp4$/i).test(target.pathname)) return null;
    } else if (!["http:", "https:"].includes(url.protocol) || !(entry.kind === "hls" ? /\.m3u8$/i : /\.mp4$/i).test(url.pathname)) return null;
    const subtitles = Array.isArray(entry.subtitles) ? entry.subtitles.filter((track): track is SubtitleTrack => {
      if (!track || typeof track !== "object" || typeof track.url !== "string" || typeof track.label !== "string" || typeof track.language !== "string") return false;
      try { const u = new URL(track.url, "https://pinflix.invalid"); return !u.username && !u.password && (u.protocol === "https:" || u.protocol === "http:"); } catch { return false; }
    }) : [];
    return { label: entry.label, url: playbackUrl, kind: entry.kind, ...(subtitles.length ? { subtitles } : {}) };
  } catch { return null; }
}

export function toWebVtt(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n|\r/g, "\n").trimStart();
  return /^WEBVTT(?:\s|$)/.test(normalized) ? normalized : "WEBVTT\n\n" + normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
}
