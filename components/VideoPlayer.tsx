"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Film, Play, RotateCcw, Shrink } from "lucide-react";
import NativeMediaPlayer, { type PlayableSource } from "@/components/NativeMediaPlayer";
import type { Video } from "@/lib/tmdb";
import type { LibraryTitle } from "@/lib/library";

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
}

interface Resolution {
  key: string;
  sources: PlayableSource[];
  status: "ready" | "empty" | "error";
}

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;

function episodeNumber(value: string | number): number {
  const raw = String(value).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= 999 ? n : 1;
}

function validSource(value: unknown): value is PlayableSource {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.label !== "string" ||
      typeof entry.url !== "string" ||
      (entry.kind !== "hls" && entry.kind !== "mp4")) return false;
  try {
    const url = new URL(entry.url);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password &&
      (entry.kind === "hls" ? /\.m3u8$/i : /\.mp4$/i).test(url.pathname);
  } catch {
    return false;
  }
}

/** Direct licensed media, rendered with a local HTML5 player instead of
 * advertising-supported, uncontrolled third-party iframe players. */
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
}: VideoPlayerProps) {
  const id = String(tmdbId).trim();
  const currentSeason = episodeNumber(season);
  const currentEpisode = episodeNumber(episode);
  const mediaKey = type === "tv"
    ? `tv:${id}:s${currentSeason}e${currentEpisode}`
    : `movie:${id}`;
  const validId = /^[1-9][0-9]*$/.test(id);

  const [resolved, setResolved] = useState<Resolution | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [selection, setSelection] = useState({ key: "", index: 0 });
  const [failedStream, setFailedStream] = useState<string | null>(null);
  const lastError = useRef<string | null>(null);
  const [trailerModeKey, setTrailerModeKey] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  const tmdbTrailer = videos
    .filter((video) => video.site === "YouTube" && YOUTUBE_KEY.test(video.key))
    .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"))[0];
  const officialTrailer = trailerKey && YOUTUBE_KEY.test(trailerKey)
    ? trailerKey
    : tmdbTrailer?.key;
  const isTrailerMode = Boolean(officialTrailer && trailerModeKey === mediaKey);

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
        if (!response.ok) throw new Error("Media source lookup failed");
        const data: unknown = await response.json();
        const entries = data && typeof data === "object" &&
          "sources" in data ? data.sources : undefined;
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
  }, [mediaKey, type, id, validId, currentSeason, currentEpisode, title, year, refreshCount]);

  useEffect(() => {
    if (!isTheaterMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTheaterMode(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isTheaterMode]);

  const isLoading = !resolved || resolved.key !== mediaKey;
  const sources = !isLoading && resolved ? resolved.sources : [];
  const currentIndex = selection.key === mediaKey ? selection.index : 0;
  const activeIndex = Math.min(currentIndex, Math.max(0, sources.length - 1));
  const activeSource = sources[activeIndex];
  const streamKey = `${mediaKey}:${activeIndex}:${refreshCount}`;
  const errorForActiveStream = failedStream === streamKey;

  const item: LibraryTitle = {
    type, id: Number(id), title: title || `Title ${id}`,
    year: year || "", posterPath,
  };

  const nextSource = () => {
    if (sources.length < 2) return;
    lastError.current = null;
    setFailedStream(null);
    setSelection({ key: mediaKey, index: (activeIndex + 1) % sources.length });
  };

  const handleFatalError = () => {
    if (lastError.current === streamKey) return;
    lastError.current = streamKey;
    if (activeIndex + 1 < sources.length) {
      setSelection({ key: mediaKey, index: activeIndex + 1 });
    } else {
      setFailedStream(streamKey);
    }
  };

  const retrySources = () => {
    lastError.current = null;
    setFailedStream(null);
    setSelection({ key: mediaKey, index: 0 });
    setResolved(null);
    setRefreshCount((n) => n + 1);
  };

  if (!validId) {
    return <p role="alert" className="rounded-xl bg-zinc-900 p-6 text-amber-400">Invalid TMDB ID.</p>;
  }

  return (
    <section
      aria-label="PinFlix media player"
      data-theater-mode={isTheaterMode}
      className={isTheaterMode
        ? "fixed inset-0 z-[80] flex w-screen flex-col items-center gap-3 overflow-y-auto bg-black/95 px-3 py-8 backdrop-blur-sm sm:px-8"
        : "flex w-full flex-col gap-3"}
    >
      <div className="relative aspect-video w-full max-w-5xl shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black">
        {isTrailerMode && officialTrailer ? (
          <iframe
            key={`trailer:${mediaKey}:${officialTrailer}`}
            src={`https://www.youtube-nocookie.com/embed/${officialTrailer}?rel=0&autoplay=1`}
            className="absolute inset-0 h-full w-full border-0"
            title={`Official trailer: ${item.title}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : activeSource && !errorForActiveStream ? (
          <NativeMediaPlayer
            key={streamKey}
            source={activeSource}
            item={item}
            season={type === "tv" ? currentSeason : undefined}
            episode={type === "tv" ? currentEpisode : undefined}
            onFatalError={handleFatalError}
          />
        ) : (
          <div role="status" className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center">
            <Film size={32} className="text-zinc-500" aria-hidden="true" />
            <p className="max-w-md text-sm font-semibold text-white">
              {isLoading ? "Finding available authorized sources…" :
                resolved?.status === "error" ? "Unable to look up media sources." :
                errorForActiveStream ? "This media could not be played from the available sources." :
                "No ad-free licensed video is configured for this title yet."}
            </p>
            {!isLoading && (
              <p className="max-w-md text-xs leading-relaxed text-zinc-400">
                Choose an official trailer or use Where to Watch below. TMDB metadata alone does not include a movie or episode stream.
              </p>
            )}
            {!isLoading && (
              <button
                type="button"
                onClick={retrySources}
                className="mt-2 rounded-lg border border-white/15 bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                Retry source lookup
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full max-w-5xl flex-col items-center justify-between gap-4 rounded-xl border border-white/15 bg-surface p-4 text-sm sm:flex-row">
        <div aria-live="polite" className="min-w-0 text-center text-zinc-400 sm:text-left">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            {isTrailerMode ? "Official preview" : "Current source"}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-accent">
            {isTrailerMode ? "YouTube Trailer" :
              activeSource ? activeSource.label :
              isLoading ? "Checking…" : "No licensed source"}
          </p>
          {!isTrailerMode && sources.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              Source {activeIndex + 1} of {sources.length} · Native {activeSource.kind.toUpperCase()} video
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setIsTheaterMode((active) => !active)}
            aria-pressed={isTheaterMode}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-zinc-800 px-3 py-2 font-medium text-white hover:bg-zinc-700"
          >
            {isTheaterMode ? <Shrink size={16} /> : <Expand size={16} />}
            {isTheaterMode ? "Exit Theater" : "Theater Mode"}
          </button>
          {officialTrailer && (
            <button
              type="button"
              onClick={() => setTrailerModeKey(isTrailerMode ? null : mediaKey)}
              aria-pressed={isTrailerMode}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 font-medium ${isTrailerMode ? "border-white/25 bg-white/10 text-white hover:bg-white/20" : "border-accent bg-accent text-[#0b100e] hover:bg-accent-soft"}`}
            >
              <Play size={15} aria-hidden="true" />
              {isTrailerMode ? "Back to Video" : "Watch Trailer"}
            </button>
          )}
          {!isTrailerMode && sources.length > 1 && (
            <button
              type="button"
              onClick={nextSource}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-medium text-white hover:text-accent"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Next Source
            </button>
          )}
        </div>
      </div>
      {sources.length > 1 && !isTrailerMode && (
        <div className="w-full max-w-5xl">
          <label htmlFor="pinflix-source" className="mb-1.5 block text-xs font-medium text-zinc-400">Select source</label>
          <select
            id="pinflix-source"
            value={activeIndex}
            onChange={(event) => {
              lastError.current = null;
              setFailedStream(null);
              setSelection({ key: mediaKey, index: Number(event.target.value) });
            }}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          >
            {sources.map((source, index) => (
              <option key={`${source.url}:${index}`} value={index}>{source.label}</option>
            ))}
          </select>
        </div>
      )}
      <p className="w-full max-w-5xl text-xs leading-relaxed text-zinc-500">
        Full-length playback uses owner-configured, authorized MP4/HLS sources without third-party ad iframe overlays. Source availability and video licensing are separate from TMDB.
      </p>
    </section>
  );
}
