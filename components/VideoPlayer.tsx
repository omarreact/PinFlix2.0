"use client";

import { useEffect, useState } from "react";
import { Expand, Play, RotateCcw, Shrink } from "lucide-react";
import type { Video } from "@/lib/tmdb";

interface VideoPlayerProps {
  tmdbId: string | number;
  type?: "movie" | "tv";
  season?: string | number;
  episode?: string | number;
  trailerKey?: string | null;
  // Keep compatibility with PinFlix's existing TitleView.
  title?: string;
  year?: string;
  posterPath?: string | null;
  videos?: Video[];
}

interface EmbedProvider {
  name: string;
  movie: (id: string) => string;
  tv: (id: string, season: number, episode: number) => string;
}

// Streams are embedded directly into the visitor's browser, not proxied
// through PinFlix. Only embed content you have permission to distribute.
const PROVIDERS: EmbedProvider[] = [
  {
    name: "VidSrc.cc (Best Pick)",
    movie: (id) => `https://vidsrc.cc/embed/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidsrc.cc/embed/tv/${id}/${season}/${episode}`,
  },
  {
    name: "VidEasy (Up to 4K)",
    movie: (id) => `https://player.videasy.net/movie/${id}`,
    tv: (id, season, episode) =>
      `https://player.videasy.net/tv/${id}/${season}/${episode}`,
  },
  {
    name: "VidSrc.me (Very Stable)",
    movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv: (id, season, episode) =>
      `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
  },
  {
    name: "Embed.su (Fast Proxy)",
    movie: (id) => `https://embed.su/embed/movie/${id}`,
    tv: (id, season, episode) =>
      `https://embed.su/embed/tv/${id}/${season}/${episode}`,
  },
];

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/;

function episodeNumber(value: string | number): number {
  const raw = String(value).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n <= 999 ? n : 1;
}

export default function VideoPlayer({
  tmdbId,
  type = "movie",
  season = 1,
  episode = 1,
  trailerKey = null,
  title,
  videos = [],
}: VideoPlayerProps) {
  const id = String(tmdbId).trim();
  const currentSeason = episodeNumber(season);
  const currentEpisode = episodeNumber(episode);
  const mediaKey = `${type}:${id}:${currentSeason}:${currentEpisode}`;

  // A changed movie, season or episode immediately resets server and trailer
  // without setting state in an effect (or flashing the previous embed).
  const [selection, setSelection] = useState({ mediaKey: "", index: 0 });
  const [trailerModeKey, setTrailerModeKey] = useState<string | null>(null);
  const [shieldRemovedFor, setShieldRemovedFor] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const serverIndex = selection.mediaKey === mediaKey ? selection.index : 0;
  const activeServer = PROVIDERS[serverIndex];
  const streamKey = `${mediaKey}:${serverIndex}`;
  const isShieldActive = shieldRemovedFor !== streamKey;

  useEffect(() => {
    if (!isTheaterMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTheaterMode(false);
    };
    window.addEventListener("keydown", exitOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", exitOnEscape);
    };
  }, [isTheaterMode]);

  // Support the new explicit trailerKey prop AND the existing TMDB videos prop.
  const tmdbTrailer = videos
    .filter((video) => video.site === "YouTube" && YOUTUBE_KEY.test(video.key))
    .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"))[0];
  const resolvedTrailerKey =
    trailerKey && YOUTUBE_KEY.test(trailerKey) ? trailerKey : tmdbTrailer?.key;
  const isTrailerMode = Boolean(resolvedTrailerKey && trailerModeKey === mediaKey);

  const embedUrl = type === "tv"
    ? activeServer.tv(id, currentSeason, currentEpisode)
    : activeServer.movie(id);

  const handleNextServer = () => {
    setTrailerModeKey(null);
    setSelection({
      mediaKey,
      index: (serverIndex + 1) % PROVIDERS.length,
    });
  };

  const toggleTrailer = () => {
    setShieldRemovedFor(null);
    setTrailerModeKey(isTrailerMode ? null : mediaKey);
  };

  if (!/^[1-9][0-9]*$/.test(id)) {
    return (
      <div role="alert" className="rounded-xl bg-zinc-900 p-6 text-center text-sm text-amber-400">
        Invalid TMDB ID.
      </div>
    );
  }

  return (
    <section
      aria-label="PinFlix video player"
      data-theater-mode={isTheaterMode}
      className={isTheaterMode
        ? "fixed inset-0 z-[80] flex w-screen flex-col items-center gap-3 overflow-y-auto bg-black/95 px-3 py-8 backdrop-blur-sm sm:px-8"
        : "flex w-full flex-col gap-3"}
    >
      <div className="relative aspect-video w-full max-w-5xl shrink-0 overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
        {isTrailerMode && resolvedTrailerKey ? (
          <iframe
            key={`trailer:${mediaKey}:${resolvedTrailerKey}`}
            src={`https://www.youtube-nocookie.com/embed/${resolvedTrailerKey}?rel=0&autoplay=1`}
            className="absolute inset-0 h-full w-full border-0"
            title={`Official trailer: ${title || id}`}
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <iframe
            key={`stream:${mediaKey}:${serverIndex}`}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            title={`${activeServer.name} player: ${title || id}`}
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {!isTrailerMode && isShieldActive && (
          <button
            type="button"
            aria-label="Activate the video player"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShieldRemovedFor(streamKey);
            }}
            className="absolute inset-0 z-20 flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 bg-black/45 p-4 text-white transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 shadow-xl shadow-indigo-950/60 sm:h-20 sm:w-20">
              <Play size={32} fill="currentColor" aria-hidden="true" />
            </span>
            <span className="rounded-lg border border-white/15 bg-zinc-950/80 px-4 py-2 text-center text-xs font-semibold sm:text-sm">
              Click to open player controls
            </span>
          </button>
        )}
      </div>

      <div className="flex w-full max-w-5xl flex-col items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#111111] p-4 text-sm sm:flex-row">
        <div aria-live="polite" className="min-w-0 text-center text-gray-400 sm:text-left">
          {isTrailerMode ? (
            <p className="font-semibold text-white">
              Currently Playing:
              <span className="ml-1 text-red-500">Official Trailer</span>
            </p>
          ) : (
            <>
              <span className="font-semibold text-white">Playing on: </span>
              <span className="ml-1 font-medium text-emerald-400">{activeServer.name}</span>
              <span className="ml-2 text-xs text-gray-500">
                (Server {serverIndex + 1} of {PROVIDERS.length})
              </span>
            </>
          )}
        </div>

        <div className="flex w-full flex-wrap justify-center gap-3 sm:w-auto">
          <button
            type="button"
            onClick={() => setIsTheaterMode((value) => !value)}
            aria-pressed={isTheaterMode}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-zinc-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isTheaterMode ? <Shrink size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
            {isTheaterMode ? "Exit Theater" : "Theater Mode"}
          </button>
          {resolvedTrailerKey && (
            <button
              type="button"
              onClick={toggleTrailer}
              aria-pressed={isTrailerMode}
              className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 font-medium text-white shadow-lg transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isTrailerMode
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-red-600 hover:bg-red-700"}`}
            >
              {isTrailerMode ? "Back to Movie" : "Watch Trailer"}
            </button>
          )}

          {!isTrailerMode && (
            <button
              type="button"
              onClick={handleNextServer}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 sm:flex-none"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Next Server
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        If playback is unavailable, choose another server. Video is delivered by the selected external provider.
      </p>
      {isTrailerMode && (
        <p className="text-xs text-zinc-500">
          Official trailer preview only — this is not the full movie or episode.
        </p>
      )}
    </section>
  );
}
