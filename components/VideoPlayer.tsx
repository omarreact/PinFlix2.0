"use client";

import { useState } from "react";
import { ArrowRight, PlayCircle, Server } from "lucide-react";
import type { Video } from "@/lib/tmdb";

interface VideoPlayerProps {
  tmdbId: string | number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  // Existing TitleView props remain accepted without changing its API.
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

// Media is fetched by the viewer's browser directly from the provider.
// PinFlix does not proxy, download, or store these iframe video streams.
// Only use providers for content you are authorized to distribute.
const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    name: "VidSrc",
    movie: (id) => `https://vidsrc.cc/embed/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidsrc.cc/embed/tv/${id}/${season}/${episode}`,
  },
  {
    name: "VidEasy",
    movie: (id) => `https://player.videasy.net/movie/${id}`,
    tv: (id, season, episode) =>
      `https://player.videasy.net/tv/${id}/${season}/${episode}`,
  },
  {
    name: "VidSrc.me",
    movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv: (id, season, episode) =>
      `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
  },
  {
    name: "Embed.su",
    movie: (id) => `https://embed.su/embed/movie/${id}`,
    tv: (id, season, episode) =>
      `https://embed.su/embed/tv/${id}/${season}/${episode}`,
  },
];

function validEpisodeNumber(value: number | undefined, minimum: number) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= 999
    ? value
    : 1;
}

export default function VideoPlayer({
  tmdbId,
  type,
  season,
  episode,
  title,
  videos = [],
}: VideoPlayerProps) {
  const id = String(tmdbId).trim();
  const currentSeason = validEpisodeNumber(season, 0);
  const currentEpisode = validEpisodeNumber(episode, 1);
  const mediaKey = `${type}:${id}:${type === "tv" ? `${currentSeason}:${currentEpisode}` : ""}`;

  // Keying the selection to the title/episode resets the provider to the
  // first server when TitleView changes its route params.
  const [selection, setSelection] = useState({ mediaKey: "", index: 0 });
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const activeIndex = selection.mediaKey === mediaKey ? selection.index : 0;
  const provider = EMBED_PROVIDERS[activeIndex];

  const trailer = videos
    .filter((video) => video.site === "YouTube" && /^[a-zA-Z0-9_-]{11}$/.test(video.key))
    .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"))[0];
  const showingTrailer = Boolean(trailer && previewKey === mediaKey);

  const embedUrl = type === "movie"
    ? provider.movie(id)
    : provider.tv(id, currentSeason, currentEpisode);

  const tryNextServer = () => {
    setPreviewKey(null);
    setSelection({
      mediaKey,
      index: (activeIndex + 1) % EMBED_PROVIDERS.length,
    });
  };

  if (!/^[1-9][0-9]*$/.test(id)) {
    return (
      <div role="alert" className="rounded-xl border border-white/10 bg-zinc-900 p-6 text-center text-sm text-amber-400">
        This title has an invalid TMDB ID.
      </div>
    );
  }

  return (
    <section aria-label="PinFlix video player" className="flex w-full flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black">
        {showingTrailer && trailer ? (
          <iframe
            key={`trailer:${mediaKey}:${trailer.key}`}
            src={`https://www.youtube-nocookie.com/embed/${trailer.key}?rel=0`}
            title={`Official preview: ${trailer.name}`}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allowFullScreen
          />
        ) : (
          <iframe
            key={`stream:${mediaKey}:${activeIndex}`}
            src={embedUrl}
            title={`${provider.name} player: ${title || `${type} ${id}`}`}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allowFullScreen
          />
        )}
      </div>

      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-300">
            <Server size={19} />
          </div>
          <div aria-live="polite" aria-atomic="true" className="min-w-0">
            <p className="text-[11px] font-medium text-zinc-400">Current Server</p>
            <p className="truncate text-sm font-bold text-white">
              {showingTrailer ? "Official Trailer" : provider.name}
              {!showingTrailer && (
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  {activeIndex + 1} / {EMBED_PROVIDERS.length}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {trailer && (
            <button
              type="button"
              onClick={() => setPreviewKey(mediaKey)}
              aria-pressed={showingTrailer}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${showingTrailer ? "bg-blue-600 text-white" : "bg-white/10 text-zinc-200 hover:bg-white/20"}`}
            >
              <PlayCircle size={15} aria-hidden="true" />
              Trailer
            </button>
          )}
          <button
            type="button"
            onClick={tryNextServer}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-extrabold text-black transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none"
          >
            Try Next Server
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        If playback is unavailable, try another server. Streams load directly from external providers, not through PinFlix servers.
      </p>
      {showingTrailer && (
        <p className="text-xs text-zinc-500">Preview only — a trailer is not a full movie or episode.</p>
      )}
    </section>
  );
}
