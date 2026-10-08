"use client";

import { useEffect, useRef } from "react";
import { getProgress, saveProgress, type LibraryTitle } from "@/lib/library";

export interface PlayableSource {
  label: string;
  url: string;
  kind: "hls" | "mp4";
}

interface NativeMediaPlayerProps {
  source: PlayableSource;
  item: LibraryTitle;
  season?: number;
  episode?: number;
  onFatalError: () => void;
}

function playbackUrl(source: PlayableSource): string {
  // HTTPS is fetched directly by the browser; only owner-allowlisted HTTP
  // sources may use the existing optional media proxy.
  return source.url.startsWith("https://")
    ? source.url
    : `/api/media-proxy?url=${encodeURIComponent(source.url)}`;
}

export default function NativeMediaPlayer({
  source,
  item,
  season,
  episode,
  onFatalError,
}: NativeMediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const errorCallback = useRef(onFatalError);
  const itemRef = useRef({ item, season, episode });
  const lastProgressWrite = useRef(0);

  useEffect(() => {
    errorCallback.current = onFatalError;
    itemRef.current = { item, season, episode };
  }, [onFatalError, item, season, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    let hls: import("hls.js").default | null = null;
    const url = playbackUrl(source);

    if (source.kind === "mp4") {
      video.src = url;
      video.load();
    } else {
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;

          if (Hls.isSupported()) {
            const instance = new Hls({ enableWorker: true });
            hls = instance;
            instance.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal && !destroyed) errorCallback.current();
            });
            instance.loadSource(url);
            instance.attachMedia(video);
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.load();
          } else {
            errorCallback.current();
          }
        })
        .catch(() => {
          if (!destroyed) errorCallback.current();
        });
    }

    return () => {
      destroyed = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [source.kind, source.url]);

  const savePosition = (completed = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const { item: media, season: s, episode: e } = itemRef.current;
    saveProgress(media, video.currentTime, video.duration, s, e, completed);
    lastProgressWrite.current = video.currentTime;
  };

  const poster = item.posterPath?.startsWith("/")
    ? `https://image.tmdb.org/t/p/w780${item.posterPath}`
    : undefined;

  return (
    <video
      ref={videoRef}
      className="h-full w-full bg-black object-contain"
      poster={poster}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      aria-label={`Play ${item.title} from ${source.label}`}
      onLoadedMetadata={() => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
        const saved = getProgress(item, season, episode);
        if (saved && !saved.completed && saved.seconds > 10 &&
          saved.seconds < video.duration - 30) video.currentTime = saved.seconds;
      }}
      onTimeUpdate={() => {
        const video = videoRef.current;
        if (video && Math.abs(video.currentTime - lastProgressWrite.current) >= 10) {
          savePosition();
        }
      }}
      onPause={() => savePosition()}
      onEnded={() => savePosition(true)}
      onError={() => errorCallback.current()}
    >
      <track kind="captions" />
      Your browser cannot play this video.
    </video>
  );
}
