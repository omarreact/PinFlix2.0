"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Expand,
  Film,
  Link2,
  Moon,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  Shrink,
  Sun,
  Tv,
} from "lucide-react";
import NativeMediaPlayer, { type PlayableSource } from "@/components/NativeMediaPlayer";
import type { Video } from "@/lib/tmdb";
import { saveProgress, type LibraryTitle } from "@/lib/library";
import { getNextEpisode, getPreviousEpisode, type SeasonSummary } from "@/lib/episode-navigation";

export interface StreamServer {
  id: string;
  name: string;
  badge: string;
  tag: string;
  getUrl: (params: {
    id: string;
    type: "movie" | "tv";
    season: number;
    episode: number;
  }) => string;
}

export const STREAM_SERVERS: StreamServer[] = [
  {
    id: "vidlink",
    name: "Server 1: VidLink",
    badge: "1080p HD",
    tag: "Fastest",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=9ce1b9&secondaryColor=141d18&iconColor=9ce1b9&title=true&poster=true`
        : `https://vidlink.pro/movie/${id}?primaryColor=9ce1b9&secondaryColor=141d18&iconColor=9ce1b9&title=true&poster=true`,
  },
  {
    id: "vidsrc-pro",
    name: "Server 2: VidSrc Pro",
    badge: "Cloud VIP",
    tag: "Stable",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    id: "vidsrc-cc",
    name: "Server 3: VidSrc CC",
    badge: "Multi-CDN",
    tag: "Global",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`
        : `https://vidsrc.cc/v2/embed/movie/${id}`,
  },
  {
    id: "superembed",
    name: "Server 4: SuperEmbed",
    badge: "Multi-Audio",
    tag: "Mirror",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  },
  {
    id: "autoembed",
    name: "Server 5: AutoEmbed",
    badge: "Subtitles",
    tag: "HD",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${id}`,
  },
  {
    id: "vidsrc-xyz",
    name: "Server 6: VidSrc XYZ",
    badge: "Backup CDN",
    tag: "Alternate",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
  },
  {
    id: "2embed",
    name: "Server 7: 2Embed",
    badge: "Fast Stream",
    tag: "Backup",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${id}`,
  },
];

interface VideoPlayerProps {
  tmdbId: string | number;
  type?: "movie" | "tv";
  season?: string | number;
  episode?: string | number;
  trailerKey?: string | null;
  title?: string;
  year?: string;
  posterPath?: string | null;
  videos?: Video[];
  onEpisodeChange?: (season: number, episode: number) => void;
  seasons?: SeasonSummary[];
}

interface Resolution {
  key: string;
  sources: PlayableSource[];
  status: "ready" | "empty" | "error";
}

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;

function episodeNumber(value: string | number | undefined): number {
  if (value === undefined || value === null) return 1;
  const raw = String(value).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= 999 ? n : 1;
}

function validSource(value: unknown): value is PlayableSource {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.label !== "string" ||
    typeof entry.url !== "string" ||
    (entry.kind !== "hls" && entry.kind !== "mp4")
  )
    return false;
  try {
    const url = new URL(entry.url);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      (entry.kind === "hls" ? /\.m3u8$/i : /\.mp4$/i).test(url.pathname)
    );
  } catch {
    return false;
  }
}

export default function VideoPlayer({
  tmdbId,
  type = "movie",
  season = 1,
  episode = 1,
  trailerKey = null,
  title,
  year,
  posterPath = null,
  videos = [],
  onEpisodeChange,
  seasons = [],
}: VideoPlayerProps) {
  const id = String(tmdbId).trim();
  const currentSeason = episodeNumber(season);
  const currentEpisode = episodeNumber(episode);
  const mediaKey =
    type === "tv"
      ? `tv:${id}:s${currentSeason}e${currentEpisode}`
      : `movie:${id}`;
  const validId = /^[1-9][0-9]*$/.test(id);

  // Streaming server state
  const [selectedServerId, setSelectedServerId] = useState<string>("vidlink");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [isTrailerMode, setIsTrailerMode] = useState(false);
  const [autoNext, setAutoNext] = useState(true);

  // Custom Direct Stream state
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customSources, setCustomSources] = useState<PlayableSource[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customError, setCustomError] = useState("");

  // Direct authorized sources lookup (from own-sources / archive)
  const [resolved, setResolved] = useState<Resolution | null>(null);
  const [nativeSourceIndex, setNativeSourceIndex] = useState(0);
  const [nativeFailed, setNativeFailed] = useState(false);

  // Save to watch history / Continue Watching on initial mount or episode change
  useEffect(() => {
    if (!validId) return;
    const item: LibraryTitle = {
      type,
      id: Number(id),
      title: title || `Title ${id}`,
      year: year || "",
      posterPath,
    };
    // Save progress with a default duration so "Continue Watching" shows the title
    saveProgress(
      item,
      120,
      type === "tv" ? 2700 : 7200,
      type === "tv" ? currentSeason : undefined,
      type === "tv" ? currentEpisode : undefined,
      false,
    );
  }, [id, type, currentSeason, currentEpisode, title, year, posterPath, validId]);

  // Handle trailer resolution
  const tmdbTrailer = videos
    .filter((video) => video.site === "YouTube" && YOUTUBE_KEY.test(video.key))
    .sort(
      (a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"),
    )[0];
  const officialTrailer =
    trailerKey && YOUTUBE_KEY.test(trailerKey)
      ? trailerKey
      : tmdbTrailer?.key;

  // Fetch optional direct licensed sources from /api/sources
  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    const request = new URL("/api/sources", window.location.origin);
    request.searchParams.set("type", type);
    request.searchParams.set("id", id);
    if (title) request.searchParams.set("title", title);
    if (year) request.searchParams.set("year", year);
    if (type === "tv") {
      request.searchParams.set("season", String(currentSeason));
      request.searchParams.set("episode", String(currentEpisode));
    }

    void fetch(request, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        const entries =
          data && typeof data === "object" && "sources" in data
            ? data.sources
            : undefined;
        const sources: PlayableSource[] = Array.isArray(entries)
          ? entries.filter(validSource)
          : [];
        if (!controller.signal.aborted) {
          setResolved({
            key: mediaKey,
            sources,
            status: sources.length ? "ready" : "empty",
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResolved({ key: mediaKey, sources: [], status: "error" });
        }
      });

    return () => controller.abort();
  }, [mediaKey, type, id, validId, currentSeason, currentEpisode, title, year]);

  // Theater Mode / Lights Off body scroll & escape listener
  useEffect(() => {
    if (!isTheaterMode && !isLightsOff) return;
    const previousOverflow = document.body.style.overflow;
    if (isTheaterMode) {
      document.body.style.overflow = "hidden";
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTheaterMode(false);
        setIsLightsOff(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isTheaterMode, isLightsOff]);

  if (!validId) {
    return (
      <div role="alert" className="rounded-xl bg-zinc-900 p-6 text-amber-400">
        Invalid TMDB ID.
      </div>
    );
  }

  // Combined native sources (direct from API + any custom added by user)
  const allNativeSources = [
    ...customSources,
    ...(resolved?.key === mediaKey ? resolved.sources : []),
  ];

  // Episode calculations
  const nextEp =
    type === "tv" && seasons.length
      ? getNextEpisode(currentSeason, currentEpisode, seasons)
      : null;
  const prevEp =
    type === "tv" && seasons.length
      ? getPreviousEpisode(currentSeason, currentEpisode, seasons)
      : null;

  const handleNextEpisode = () => {
    if (nextEp && onEpisodeChange) {
      onEpisodeChange(nextEp.season, nextEp.episode);
    }
  };

  const handlePrevEpisode = () => {
    if (prevEp && onEpisodeChange) {
      onEpisodeChange(prevEp.season, prevEp.episode);
    }
  };

  const handleAddCustomStream = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError("");
    try {
      const parsed = new URL(customUrlInput.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setCustomError("URL must start with http:// or https://");
        return;
      }
      const isHls = /\.m3u8($|\?)/i.test(parsed.pathname);
      const isMp4 = /\.mp4($|\?)/i.test(parsed.pathname);
      if (!isHls && !isMp4) {
        setCustomError("Direct link must end with .m3u8 (HLS) or .mp4");
        return;
      }
      const newSource: PlayableSource = {
        label: `Custom ${isHls ? "HLS" : "MP4"} Stream`,
        url: customUrlInput.trim(),
        kind: isHls ? "hls" : "mp4",
      };
      setCustomSources([newSource, ...customSources]);
      setSelectedServerId("native");
      setNativeSourceIndex(0);
      setCustomUrlInput("");
      setShowCustomInput(false);
    } catch {
      setCustomError("Please enter a valid video stream URL");
    }
  };

  const currentServer = STREAM_SERVERS.find((s) => s.id === selectedServerId);
  const isNativeServer = selectedServerId === "native";

  // Build current iframe URL
  const iframeSrc = currentServer
    ? currentServer.getUrl({
        id,
        type,
        season: currentSeason,
        episode: currentEpisode,
      })
    : "";

  const item: LibraryTitle = {
    type,
    id: Number(id),
    title: title || `Title ${id}`,
    year: year || "",
    posterPath,
  };

  return (
    <>
      {/* Cinema Lights Off Dimmer */}
      {isLightsOff && (
        <div
          onClick={() => setIsLightsOff(false)}
          className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <section
        aria-label="PinFlix media player"
        data-theater-mode={isTheaterMode}
        className={
          isTheaterMode
            ? "fixed inset-0 z-[80] flex w-screen flex-col items-center gap-3 overflow-y-auto bg-black/98 px-3 py-6 backdrop-blur-md sm:px-8"
            : isLightsOff
              ? "relative z-50 flex w-full flex-col gap-3"
              : "flex w-full flex-col gap-3"
        }
      >
        {/* Top Player Status Bar */}
        <div className="flex w-full max-w-5xl items-center justify-between gap-2 px-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-accent">
              <Film size={14} className="text-accent" />
              {type === "tv"
                ? `TV Series · S${String(currentSeason).padStart(2, "0")} E${String(currentEpisode).padStart(2, "0")}`
                : "Full Movie"}
            </span>
            <span className="hidden rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent sm:inline-block">
              1080p HD
            </span>
            <span className="hidden items-center gap-1 text-[11px] text-zinc-400 md:inline-flex">
              <ShieldCheck size={12} className="text-emerald-400" />
              Ad-Sandboxed
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {type === "tv" && (
              <label
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
                title="Automatically queue next episode"
              >
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={(e) => setAutoNext(e.target.checked)}
                  className="accent-accent"
                />
                Auto-Next
              </label>
            )}

            <button
              type="button"
              onClick={() => setIsLightsOff(!isLightsOff)}
              title={isLightsOff ? "Turn lights on" : "Cinema Lights Off"}
              aria-pressed={isLightsOff}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                isLightsOff
                  ? "border-amber-400 bg-amber-400/20 text-amber-300"
                  : "border-white/15 bg-zinc-900 text-zinc-300 hover:text-white"
              }`}
            >
              {isLightsOff ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden sm:inline">
                {isLightsOff ? "Lights On" : "Lights Off"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsTheaterMode(!isTheaterMode)}
              aria-pressed={isTheaterMode}
              title={isTheaterMode ? "Exit theater mode" : "Expand theater mode"}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:text-white"
            >
              {isTheaterMode ? <Shrink size={13} /> : <Expand size={13} />}
              <span className="hidden sm:inline">
                {isTheaterMode ? "Exit" : "Theater"}
              </span>
            </button>
          </div>
        </div>

        {/* The Screen / Media Container */}
        <div className="relative aspect-video w-full max-w-5xl shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl shadow-black/80">
          {isTrailerMode && officialTrailer ? (
            <iframe
              key={`trailer:${mediaKey}:${officialTrailer}:${refreshKey}`}
              src={`https://www.youtube-nocookie.com/embed/${officialTrailer}?rel=0&autoplay=1&modestbranding=1`}
              className="absolute inset-0 h-full w-full border-0"
              title={`Official trailer: ${title || id}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : isNativeServer && allNativeSources.length > 0 && !nativeFailed ? (
            <NativeMediaPlayer
              key={`native:${mediaKey}:${nativeSourceIndex}:${refreshKey}`}
              source={
                allNativeSources[
                  Math.min(nativeSourceIndex, allNativeSources.length - 1)
                ]
              }
              item={item}
              season={type === "tv" ? currentSeason : undefined}
              episode={type === "tv" ? currentEpisode : undefined}
              onFatalError={() => setNativeFailed(true)}
            />
          ) : (
            <iframe
              key={`stream:${selectedServerId}:${mediaKey}:${refreshKey}`}
              src={iframeSrc}
              className="absolute inset-0 h-full w-full border-0 bg-black"
              title={`Watch ${title || "movie"} on ${currentServer?.name || "Server"}`}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; display-capture"
              allowFullScreen
              // Anti-redirect protection: allows player scripts & forms, but blocks malicious top-navigation redirects
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* Server Selection & Action Controls (Movibox Style) */}
        <div className="flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-white/15 bg-surface/90 p-3 sm:p-4 backdrop-blur-md">
          {/* Server Pills */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                <Server size={14} className="text-accent" />
                Select Streaming Server
              </span>
              <span className="text-[11px] text-zinc-400">
                If playback buffers or doesn&apos;t start, switch server
              </span>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {STREAM_SERVERS.map((server) => {
                const isActive =
                  selectedServerId === server.id && !isTrailerMode;
                return (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => {
                      setSelectedServerId(server.id);
                      setIsTrailerMode(false);
                      setNativeFailed(false);
                    }}
                    className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-accent bg-accent text-[#0b100e] shadow-md shadow-accent/20"
                        : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <span>{server.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-black/20 text-[#0b100e]"
                          : "bg-white/10 text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      {server.badge}
                    </span>
                  </button>
                );
              })}

              {/* Direct Stream / Custom Stream Server option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedServerId("native");
                  setIsTrailerMode(false);
                  setNativeFailed(false);
                  if (allNativeSources.length === 0) {
                    setShowCustomInput(true);
                  }
                }}
                className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  isNativeServer && !isTrailerMode
                    ? "border-accent bg-accent text-[#0b100e] shadow-md shadow-accent/20"
                    : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Tv size={14} />
                <span>Direct Native (HLS/MP4)</span>
                {allNativeSources.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isNativeServer && !isTrailerMode
                        ? "bg-black/20 text-[#0b100e]"
                        : "bg-white/10 text-accent"
                    }`}
                  >
                    {allNativeSources.length} available
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Episode Navigation Bar for TV Shows */}
          {type === "tv" && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!prevEp}
                  onClick={handlePrevEpisode}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Prev Episode
                </button>

                <button
                  type="button"
                  disabled={!nextEp}
                  onClick={handleNextEpisode}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Episode
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="text-xs text-zinc-400">
                Playing Season {currentSeason}, Episode {currentEpisode}
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                title="Reload streaming player"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
              >
                <RotateCcw size={14} />
                Reload Player
              </button>

              {officialTrailer && (
                <button
                  type="button"
                  onClick={() => setIsTrailerMode(!isTrailerMode)}
                  aria-pressed={isTrailerMode}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition ${
                    isTrailerMode
                      ? "border-accent bg-accent text-[#0b100e]"
                      : "border-white/15 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  <Play size={13} className="fill-current" />
                  {isTrailerMode ? "Back to Stream" : "Watch Trailer"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
              >
                <Link2 size={13} />
                {showCustomInput ? "Hide Custom Stream" : "Custom Stream URL"}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span>
                Streaming on:{" "}
                <strong className="text-zinc-200">
                  {isTrailerMode
                    ? "Official YouTube Trailer"
                    : isNativeServer
                      ? "Native Direct Stream"
                      : currentServer?.name || "Server"}
                </strong>
              </span>
            </div>
          </div>

          {/* Direct Stream Source Selector (when Native player is selected) */}
          {isNativeServer && allNativeSources.length > 1 && (
            <div className="border-t border-white/10 pt-2">
              <label
                htmlFor="pinflix-native-source"
                className="mb-1 block text-xs font-medium text-zinc-400"
              >
                Select direct stream source:
              </label>
              <select
                id="pinflix-native-source"
                value={nativeSourceIndex}
                onChange={(e) => {
                  setNativeSourceIndex(Number(e.target.value));
                  setNativeFailed(false);
                }}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                {allNativeSources.map((source, idx) => (
                  <option key={`${source.url}-${idx}`} value={idx}>
                    {source.label} ({source.kind.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Stream Input Form */}
          {showCustomInput && (
            <form
              onSubmit={handleAddCustomStream}
              className="mt-1 rounded-xl border border-white/15 bg-zinc-900/90 p-3"
            >
              <p className="mb-2 text-xs font-semibold text-zinc-200">
                Load Direct Stream (.m3u8 HLS or .mp4)
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  placeholder="https://example.com/stream.m3u8"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs text-white outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black transition hover:bg-accent-soft"
                >
                  Play Direct Stream
                </button>
              </div>
              {customError && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-400">
                  <AlertCircle size={12} />
                  {customError}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </>
  );
}
