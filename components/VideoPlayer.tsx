"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Film, Loader2 } from "lucide-react";
import type { Video } from "@/lib/tmdb";

interface Source {
  label: string;
  url: string;
  kind: "hls" | "mp4";
}

type Server =
  | ({ id: string } & Source)
  | { id: string; label: string; kind: "youtube"; url: string };

/** Native HLS (Safari) or hls.js everywhere else; plain <video> for MP4. */
function MediaPlayer({ source }: { source: Source }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: import("hls.js").default | undefined;
    let cancelled = false;
    const onError = () => setFailed(source.url);
    video.addEventListener("error", onError);

    if (source.kind === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = source.url;
      } else {
        import("hls.js").then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return setFailed(source.url);
          hls = new Hls();
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setFailed(source.url);
          });
          hls.loadSource(source.url);
          hls.attachMedia(video);
        });
      }
    } else {
      video.src = source.url;
    }

    return () => {
      cancelled = true;
      video.removeEventListener("error", onError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [source]);

  if (failed === source.url)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <AlertTriangle />
        This source failed to load. Try another server.
      </div>
    );

  return (
    <video
      ref={ref}
      controls
      autoPlay
      playsInline
      className="h-full w-full bg-black"
    />
  );
}

export default function VideoPlayer({
  type,
  tmdbId,
  title,
  year,
  season,
  episode,
  videos,
}: {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: string;
  season?: number;
  episode?: number;
  videos: Video[];
}) {
  const reqKey = `${type}:${tmdbId}:${season ?? ""}:${episode ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; sources: Source[] } | null>(
    null,
  );
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const u = new URL("/api/sources", window.location.origin);
    u.searchParams.set("type", type);
    u.searchParams.set("id", String(tmdbId));
    u.searchParams.set("title", title);
    u.searchParams.set("year", year);
    if (season) u.searchParams.set("season", String(season));
    if (episode) u.searchParams.set("episode", String(episode));
    fetch(u, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setLoaded({ key: reqKey, sources: d.sources ?? [] }))
      .catch(
        (e) =>
          e.name !== "AbortError" && setLoaded({ key: reqKey, sources: [] }),
      );
    return () => ac.abort();
  }, [reqKey, type, tmdbId, title, year, season, episode]);

  const loading = loaded?.key !== reqKey;

  const servers: Server[] = [
    ...(loading ? [] : loaded!.sources).map((s, i) => ({
      ...s,
      id: `src${i}`,
    })),
    ...videos
      .filter((v) => v.site === "YouTube")
      .sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"))
      .slice(0, 3)
      .map(
        (v): Server => ({
          id: `yt${v.id}`,
          label: `${v.type}: ${v.name.slice(0, 24)}`,
          kind: "youtube",
          url: v.key,
        }),
      ),
  ];

  const active = servers.find((s) => s.id === pick) ?? servers[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-zinc-300">
            <Loader2 className="animate-spin" /> Finding sources…
          </div>
        ) : !active ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
            <Film /> No playable source for this title.
          </div>
        ) : active.kind === "youtube" ? (
          <iframe
            key={active.id}
            src={`https://www.youtube-nocookie.com/embed/${active.url}?rel=0&autoplay=1`}
            title={active.label}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <MediaPlayer key={active.id} source={active} />
        )}
      </div>

      {servers.length > 0 && (
        <div className="glass no-scrollbar flex items-center gap-2 overflow-x-auto rounded-xl p-3">
          <span className="mr-2 shrink-0 text-sm text-zinc-400">Server:</span>
          {servers.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setPick(s.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                s.id === active?.id
                  ? s.kind === "youtube"
                    ? "bg-blue-600 text-white" : "bg-accent text-black"
                  : "bg-white/10 text-zinc-300 hover:bg-white/20"
              }`}
            >
              {s.kind === "youtube" ? s.label : `Server ${i + 1} · ${s.label}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

