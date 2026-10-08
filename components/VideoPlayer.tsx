"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Film, Loader2, RotateCcw, PlayCircle } from "lucide-react";
import type { Video } from "@/lib/tmdb";
import { getProgress, saveProgress, type LibraryTitle } from "@/lib/library";

interface Source { label: string; url: string; kind: "hls" | "mp4"; }

function MediaPlayer({ source, item, season, episode, onFailure }: {
  source: Source;
  item: LibraryTitle;
  season?: number;
  episode?: number;
  onFailure: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const failureRef = useRef(onFailure);
  useEffect(() => { failureRef.current = onFailure; }, [onFailure]);
  const playbackUrl = source.url.startsWith("http://")
    ? `/api/media-proxy?url=${encodeURIComponent(source.url)}`
    : source.url;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: import("hls.js").default | undefined;
    let stopped = false;
    let failed = false;
    let lastSave = 0;
    const fail = () => {
      if (stopped || failed) return;
      failed = true;
      failureRef.current();
    };
    const metadata = () => {
      const saved = getProgress(item, season, episode);
      if (saved && !saved.completed && saved.seconds >= 5 &&
          Number.isFinite(video.duration) && saved.seconds < video.duration - 10) {
        try { video.currentTime = saved.seconds; } catch { /* not seekable */ }
      }
    };
    const progress = () => {
      const now = Date.now();
      if (now - lastSave < 5000 || !Number.isFinite(video.duration) ||
          video.duration <= 0) return;
      lastSave = now;
      saveProgress(item, video.currentTime, video.duration, season, episode);
    };
    const finish = () => {
      if (Number.isFinite(video.duration) && video.duration > 0)
        saveProgress(item, video.duration, video.duration, season, episode, true);
    };
    video.addEventListener("error", fail);
    video.addEventListener("loadedmetadata", metadata);
    video.addEventListener("timeupdate", progress);
    video.addEventListener("pause", progress);
    video.addEventListener("ended", finish);

    if (source.kind === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
      } else {
        import("hls.js").then(({ default: Hls }) => {
          if (stopped) return;
          if (!Hls.isSupported()) { fail(); return; }
          hls = new Hls({ enableWorker: true });
          hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
        }).catch(fail);
      }
    } else {
      video.src = playbackUrl;
    }
    return () => {
      // Preserve the last playhead when switching sources or episodes.
      if (video.currentTime > 0 && Number.isFinite(video.duration) && video.duration > 0 &&
          !video.ended) {
        saveProgress(item, video.currentTime, video.duration, season, episode);
      }
      stopped = true;
      video.removeEventListener("error", fail);
      video.removeEventListener("loadedmetadata", metadata);
      video.removeEventListener("timeupdate", progress);
      video.removeEventListener("pause", progress);
      video.removeEventListener("ended", finish);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source.url, source.kind, playbackUrl, item, season, episode]);

  // The on-hover title overlay mirrors the supplied watch-player presentation.
  // It never intercepts pointer events or changes the underlying <video> controls.
  return (
    <div className="group relative h-full w-full bg-black">
      <video
        ref={ref}
        controls
        autoPlay
        playsInline
        preload="metadata"
        poster={item.posterPath
          ? `https://image.tmdb.org/t/p/w500${item.posterPath}`
          : undefined}
        className="h-full w-full bg-black"
        aria-label={item.title}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 sm:p-6"
      >
        <p className="truncate font-display text-base font-bold text-white sm:text-xl">
          {item.title}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-zinc-300">
          {source.label} · {source.kind.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

export default function VideoPlayer({
  type, tmdbId, title, year, posterPath, season, episode, videos,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: string;
  posterPath?: string | null;
  season?: number;
  episode?: number;
  videos: Video[];
}) {
  const reqKey = `${type}:${tmdbId}:${season ?? ""}:${episode ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; sources: Source[]; error?: boolean } | null>(null);
  const [choice, setChoice] = useState<{ key: string; index: number }>({ key: "", index: 0 });
  const [failed, setFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [trailerMode, setTrailerMode] = useState<string | null>(null);
  const item: LibraryTitle = useMemo(
    () => ({ type, id: tmdbId, title, year, posterPath: posterPath ?? null }),
    [type, tmdbId, title, year, posterPath],
  );

  useEffect(() => {
    const ac = new AbortController();
    const u = new URL("/api/sources", window.location.origin);
    u.searchParams.set("type", type);
    u.searchParams.set("id", String(tmdbId));
    u.searchParams.set("title", title);
    u.searchParams.set("year", year);
    if (type === "tv" && season !== undefined && episode !== undefined) {
      u.searchParams.set("season", String(season));
      u.searchParams.set("episode", String(episode));
    }
    fetch(u, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Source resolver failed");
        return r.json();
      })
      .then((data: { sources?: Source[] }) => setLoaded({
        key: reqKey, sources: Array.isArray(data.sources) ? data.sources : [],
      }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoaded({ key: reqKey, sources: [], error: true });
      });
    return () => ac.abort();
  }, [reqKey, type, tmdbId, title, year, season, episode]);

  const loading = loaded?.key !== reqKey;
  const sources = loading ? [] : (loaded?.sources ?? []);
  const selected = choice.key === reqKey ? choice.index : 0;
  const active = sources[selected] ?? sources[0];
  const error = failed === `${reqKey}:${selected}`;
  const trailer = videos.filter((v) => v.site === "YouTube" &&
    /^[A-Za-z0-9_-]{11}$/.test(v.key))
    .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"))[0];
  const showTrailer = Boolean(trailer && (trailerMode === reqKey || sources.length === 0));

  const switchSource = (index: number) => {
    setTrailerMode(null);
    setFailed(null);
    setChoice({ key: reqKey, index });
    setRetry((count) => count + 1);
  };
  const sourceFailure = () => {
    if (selected + 1 < sources.length) switchSource(selected + 1);
    else setFailed(`${reqKey}:${selected}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black">
        {loading ? (
          <div role="status" aria-live="polite" className="flex h-full flex-col items-center justify-center gap-4 text-zinc-300">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-pulse rounded-full bg-accent/15 blur-lg" />
              <Loader2 size={36} className="relative animate-spin text-accent" />
            </div>
            <p className="text-sm font-semibold tracking-wide">
              Finding available sources…
            </p>
          </div>
        ) : showTrailer && trailer ? (
          <iframe key={reqKey + trailer.key}
            src={`https://www.youtube-nocookie.com/embed/${trailer.key}?rel=0&autoplay=1`}
            title={`Official preview: ${trailer.name}`}
            className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-zinc-400">
            <AlertTriangle size={28} />
            <p>This source couldn&apos;t play. Check the media origin or select another source.</p>
            <button className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm"
              onClick={() => { setFailed(null); setRetry((v) => v + 1); }}>
              <RotateCcw size={15} /> Retry
            </button>
          </div>
        ) : active ? (
          <MediaPlayer key={`${reqKey}:${selected}:${retry}`}
            source={active} item={item} season={season} episode={episode}
            onFailure={sourceFailure} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-zinc-400">
            <Film size={30} />
            <p className="font-semibold">No full-length stream is configured for this title.</p>
            <p className="max-w-md text-xs">PinFlix shows trailers and provider availability separately from licensed playable media.</p>
          </div>
        )}
      </div>
      {loaded?.key === reqKey && loaded.error && (
        <p role="alert" className="text-xs text-amber-400">
          The media source service is unavailable. Please retry later.
        </p>
      )}
      {(sources.length > 0 || trailer) && !loading && (
        <div className="glass no-scrollbar flex flex-wrap items-center gap-2 rounded-xl p-3">
          {sources.length > 0 && (
            <span className="mr-1 shrink-0 text-xs text-zinc-400">
              Streams · {sources.length}
            </span>
          )}
          {sources.map((source, index) => (
            <button key={source.url + index} onClick={() => switchSource(index)}
              aria-pressed={!showTrailer && selected === index}
              className={`rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition duration-200 hover:-translate-y-px ${
                !showTrailer && selected === index ? "bg-accent text-black" :
                  "bg-white/10 text-zinc-300 hover:bg-white/20"
              }`}>
              <span>{source.label}</span>
              <span className="ml-2 text-[10px] font-medium opacity-65">
                {source.kind.toUpperCase()}
              </span>
            </button>
          ))}
          {trailer && (
            <button onClick={() => setTrailerMode(reqKey)}
              aria-pressed={showTrailer}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                showTrailer ? "bg-blue-600 text-white" : "bg-white/10 text-zinc-300"
              }`}>
              <PlayCircle size={14} /> Watch trailer
            </button>
          )}
        </div>
      )}
      {showTrailer && (
        <p className="text-xs text-zinc-500">
          Preview only — a trailer is not a full movie or episode.
        </p>
      )}
    </div>
  );
}
