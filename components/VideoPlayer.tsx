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
  Shrink,
  Sun,
  Tv,
} from "lucide-react";
import NativeMediaPlayer, { type PlayableSource } from "@/components/NativeMediaPlayer";
import type { Video } from "@/lib/tmdb";
import type { LibraryTitle } from "@/lib/library";
import { getNextEpisode, getPreviousEpisode, type SeasonSummary } from "@/lib/episode-navigation";

export interface StreamMirror {
  id: string;
  name: string;
  badge: string;
  getUrl: (params: {
    id: string;
    type: "movie" | "tv";
    season: number;
    episode: number;
  }) => string;
}

/** External community embed mirrors, clearly labeled and optional. */
export const STREAM_MIRRORS: StreamMirror[] = [
  {
    id: "vidlink",
    name: "Mirror 1 (VidLink)",
    badge: "Embed",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=9ce1b9&secondaryColor=141d18&iconColor=9ce1b9&title=true&poster=true`
        : `https://vidlink.pro/movie/${id}?primaryColor=9ce1b9&secondaryColor=141d18&iconColor=9ce1b9&title=true&poster=true`,
  },
  {
    id: "vidsrc-pro",
    name: "Mirror 2 (VidSrc)",
    badge: "Embed",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    id: "vidsrc-cc",
    name: "Mirror 3 (VidSrc CC)",
    badge: "Embed",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`
        : `https://vidsrc.cc/v2/embed/movie/${id}`,
  },
  {
    id: "superembed",
    name: "Mirror 4 (SuperEmbed)",
    badge: "Embed",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  },
  {
    id: "autoembed",
    name: "Mirror 5 (AutoEmbed)",
    badge: "Embed",
    getUrl: ({ id, type, season, episode }) =>
      type === "tv"
        ? `https://player.autoembed.cc/embed/tv/${id}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${id}`,
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
  status: "loading" | "ready" | "empty" | "error";
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

  // Playback mode: "native" (default when sources exist), "trailer", or mirror ID
  const [activeMode, setActiveMode] = useState<"native" | "trailer" | string>("native");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLightsOff, setIsLightsOff] = useState(false);
  const [autoNext, setAutoNext] = useState(true);

  // Custom Direct Stream state
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customSources, setCustomSources] = useState<PlayableSource[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customError, setCustomError] = useState("");

  // Direct native sources lookup (from own-sources / archive)
  const [resolved, setResolved] = useState<Resolution>({
    key: mediaKey,
    sources: [],
    status: "loading",
  });
  const [nativeSourceIndex, setNativeSourceIndex] = useState(0);
  const [allNativeFailed, setAllNativeFailed] = useState(false);
  const [showMirrorsNotice, setShowMirrorsNotice] = useState(false);

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

  // Fetch authorized direct sources from /api/sources (Native-first)
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
        if (!response.ok) throw new Error("Source lookup failed");
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
            status: sources.length > 0 ? "ready" : "empty",
          });
          setAllNativeFailed(false);
          setNativeSourceIndex(0);
          // Restore native-first playback whenever direct sources are available
          if (sources.length > 0) {
            setActiveMode("native");
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResolved({ key: mediaKey, sources: [], status: "error" });
        }
      });

    return () => controller.abort();
  }, [mediaKey, type, id, validId, currentSeason, currentEpisode, title, year, refreshKey]);

  // Combined native sources (custom added + API verified)
  const currentNativeSources = [
    ...customSources,
    ...(resolved.key === mediaKey ? resolved.sources : []),
  ];

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

  // Episode navigation calculations
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

  // P0-05: Source failover logic across all native sources
  const handleNativeFatalError = () => {
    if (nativeSourceIndex + 1 < currentNativeSources.length) {
      // Advance to next available source
      setNativeSourceIndex((idx) => idx + 1);
    } else {
      // All native sources failed
      setAllNativeFailed(true);
    }
  };

  // P0-07: Auto-Next playback completion handler
  const handleNativeEnded = () => {
    if (autoNext && type === "tv" && nextEp && onEpisodeChange) {
      onEpisodeChange(nextEp.season, nextEp.episode);
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
        label: `Custom Direct ${isHls ? "HLS" : "MP4"}`,
        url: customUrlInput.trim(),
        kind: isHls ? "hls" : "mp4",
      };
      setCustomSources((prev) => [newSource, ...prev]);
      setActiveMode("native");
      setNativeSourceIndex(0);
      setAllNativeFailed(false);
      setCustomUrlInput("");
      setShowCustomInput(false);
    } catch {
      setCustomError("Please enter a valid video stream URL");
    }
  };

  const activeMirror = STREAM_MIRRORS.find((m) => m.id === activeMode);
  const activeNativeSource =
    currentNativeSources.length > 0 && !allNativeFailed
      ? currentNativeSources[Math.min(nativeSourceIndex, currentNativeSources.length - 1)]
      : null;

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
        {/* Top Player Header */}
        <div className="flex w-full max-w-5xl items-center justify-between gap-2 px-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-accent">
              <Film size={14} className="text-accent" />
              {type === "tv"
                ? `TV Series · S${String(currentSeason).padStart(2, "0")} E${String(currentEpisode).padStart(2, "0")}`
                : "Movie Playback"}
            </span>
            <span className="rounded-md border border-white/10 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
              {activeMode === "native"
                ? "Native Player"
                : activeMode === "trailer"
                  ? "YouTube Trailer"
                  : activeMirror?.name || "Mirror"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {type === "tv" && (
              <label
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 hover:text-white"
                title="Automatically advance to next episode when video ends"
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
          {/* 1. Official YouTube Trailer Mode */}
          {activeMode === "trailer" && officialTrailer ? (
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
          ) : /* 2. Native Player with available active source */
          activeMode === "native" && activeNativeSource ? (
            <NativeMediaPlayer
              key={`native:${mediaKey}:${nativeSourceIndex}:${refreshKey}`}
              source={activeNativeSource}
              item={item}
              season={type === "tv" ? currentSeason : undefined}
              episode={type === "tv" ? currentEpisode : undefined}
              onFatalError={handleNativeFatalError}
              onEnded={handleNativeEnded}
            />
          ) : /* 3. Explicit Third-Party Mirror (if user chose a mirror) */
          activeMirror ? (
            <iframe
              key={`mirror:${activeMirror.id}:${mediaKey}:${refreshKey}`}
              src={activeMirror.getUrl({
                id,
                type,
                season: currentSeason,
                episode: currentEpisode,
              })}
              className="absolute inset-0 h-full w-full border-0 bg-black"
              title={`Watch ${title || "title"} on ${activeMirror.name}`}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; display-capture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
              referrerPolicy="no-referrer"
            />
          ) : (
            /* 4. P0-03 & P0-04: Clear, honest empty/error state (NEVER fall through to empty iframe) */
            <div
              role="status"
              className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <Film size={36} className="text-zinc-500" aria-hidden="true" />
              <p className="max-w-md text-sm font-semibold text-white">
                {resolved.status === "loading"
                  ? "Looking up direct authorized streams…"
                  : allNativeFailed
                    ? "Direct playback failed across available native sources."
                    : "No direct authorized HLS/MP4 stream is configured for this title yet."}
              </p>
              <p className="max-w-md text-xs leading-relaxed text-zinc-400">
                {allNativeFailed
                  ? "You can try refreshing, load a custom direct stream link, or switch to an alternate mirror below."
                  : "TMDB provides discovery metadata. Full-length native playback requires configured HLS (.m3u8) or MP4 media sources."}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {officialTrailer && (
                  <button
                    type="button"
                    onClick={() => setActiveMode("trailer")}
                    className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black transition hover:bg-accent-soft"
                  >
                    Watch Official Trailer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="rounded-lg border border-white/20 bg-zinc-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
                >
                  Load Custom Stream (.m3u8/.mp4)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAllNativeFailed(false);
                    setNativeSourceIndex(0);
                    setRefreshKey((k) => k + 1);
                  }}
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white"
                >
                  Retry Lookup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Source Selection & Player Controls Bar */}
        <div className="flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-white/15 bg-surface/90 p-3 sm:p-4 backdrop-blur-md">
          {/* Source Tabs */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                <Server size={14} className="text-accent" />
                Playback Source
              </span>
              {currentNativeSources.length > 1 && activeMode === "native" && (
                <span className="text-[11px] text-zinc-400">
                  Source {nativeSourceIndex + 1} of {currentNativeSources.length} (Automatic Failover)
                </span>
              )}
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {/* Native Source Tab (Primary) */}
              <button
                type="button"
                onClick={() => {
                  setActiveMode("native");
                  setAllNativeFailed(false);
                  if (currentNativeSources.length === 0) {
                    setShowCustomInput(true);
                  }
                }}
                className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  activeMode === "native"
                    ? "border-accent bg-accent text-[#0b100e] shadow-md shadow-accent/20"
                    : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Tv size={14} />
                <span>Native Player (HLS/MP4)</span>
                {currentNativeSources.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      activeMode === "native"
                        ? "bg-black/20 text-[#0b100e]"
                        : "bg-white/10 text-accent"
                    }`}
                  >
                    {currentNativeSources.length} direct
                  </span>
                )}
              </button>

              {/* Official Trailer Tab */}
              {officialTrailer && (
                <button
                  type="button"
                  onClick={() => setActiveMode("trailer")}
                  className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    activeMode === "trailer"
                      ? "border-accent bg-accent text-[#0b100e] shadow-md shadow-accent/20"
                      : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Play size={13} className="fill-current" />
                  <span>Official Trailer</span>
                </button>
              )}

              {/* External Community Mirrors */}
              {STREAM_MIRRORS.map((mirror) => {
                const isActive = activeMode === mirror.id;
                return (
                  <button
                    key={mirror.id}
                    type="button"
                    onClick={() => {
                      setActiveMode(mirror.id);
                      setShowMirrorsNotice(true);
                    }}
                    className={`group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-accent bg-accent text-[#0b100e] shadow-md shadow-accent/20"
                        : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <span>{mirror.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-black/20 text-[#0b100e]"
                          : "bg-white/10 text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      {mirror.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Truthful Mirror Disclosure (P0-12) */}
          {activeMirror && showMirrorsNotice && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
              Notice: {activeMirror.name} is hosted by an independent third party. Content licensing, uptime, and advertising behavior are managed externally.
            </p>
          )}

          {/* Episode Navigation Bar for TV Series */}
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
                title="Reload player"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-800 px-3 py-1.5 font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
              >
                <RotateCcw size={14} />
                Reload Player
              </button>

              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
              >
                <Link2 size={13} />
                {showCustomInput ? "Hide Custom Stream" : "Add Direct Stream URL"}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  activeMode === "native" && activeNativeSource
                    ? "bg-emerald-400"
                    : activeMode === "trailer"
                      ? "bg-red-400"
                      : "bg-amber-400"
                }`}
              />
              <span>
                Playing via:{" "}
                <strong className="text-zinc-200">
                  {activeMode === "native"
                    ? activeNativeSource
                      ? activeNativeSource.label
                      : "Native (No Source)"
                    : activeMode === "trailer"
                      ? "YouTube"
                      : activeMirror?.name || "Mirror"}
                </strong>
              </span>
            </div>
          </div>

          {/* Direct Stream Source Selector (when multiple native sources exist) */}
          {activeMode === "native" && currentNativeSources.length > 1 && (
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
                  setAllNativeFailed(false);
                }}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-accent"
              >
                {currentNativeSources.map((source, idx) => (
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
                Add Authorized Direct Stream (.m3u8 HLS or .mp4)
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  placeholder="https://example.com/video/master.m3u8"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs text-white outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black transition hover:bg-accent-soft"
                >
                  Play Native Stream
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
