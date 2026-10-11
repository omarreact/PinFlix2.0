"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { getProgress, saveProgress, type LibraryTitle } from "@/lib/library";
import { syncProgressToCloud } from "@/lib/cloud-library";

export interface PlayableSource {
  label: string;
  url: string;
  kind: "hls" | "mp4";
  playbackUrl?: string;
}

export interface StreamCandidate {
  url: string;
  kind: "hls" | "mp4";
  label: string;
  isIsp: boolean;
}

interface NativeMediaPlayerProps {
  source: PlayableSource;
  item: LibraryTitle;
  season?: number;
  episode?: number;
  onFatalError: () => void;
  onEnded?: () => void;
}

/**
 * Play only resolved sources. TMDB titles do not imply an origin file exists.
 * The master resolver supplies the validated playbackUrl for HTTP streams;
 * custom HTTP streams may use the server proxy only when its host is approved.
 * Retrying fabricated title-derived file paths slows the player dramatically.
 */
function getPrioritizedCandidates(source: PlayableSource): StreamCandidate[] {
  let playbackUrl = source.playbackUrl || source.url;
  try {
    const url = new URL(playbackUrl);
    if (url.protocol === "http:") {
      playbackUrl = "/api/media-proxy?url=" + encodeURIComponent(url.href);
    }
  } catch {
    // Relative first-party proxy URLs remain as they were provided.
  }
  return [{
    url: playbackUrl,
    kind: source.kind,
    label: source.label,
    isIsp: false,
  }];
}

export default function NativeMediaPlayer({
  source,
  item,
  season,
  episode,
  onFatalError,
  onEnded,
}: NativeMediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const failedRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const errorCallback = useRef(onFatalError);
  const endedCallback = useRef(onEnded);
  const itemRef = useRef({ item, season, episode });
  const lastProgressWrite = useRef(0);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = getPrioritizedCandidates(source);
  const currentCandidate =
    candidates[Math.min(candidateIndex, candidates.length - 1)];

  useEffect(() => {
    const onChange = () => {
      const entered = document.fullscreenElement === containerRef.current;
      setIsFullscreen(entered);
      if (!entered && screen.orientation?.unlock) {
        try { screen.orientation.unlock(); } catch { /* Browser may disallow unlock. */ }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const element = containerRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
        return;
      }
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        // A best-effort lock: only supported browsers permit landscape locking.
        try {
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (value: "landscape") => Promise<void>;
          };
          await orientation?.lock?.("landscape");
        } catch { /* No orientation permission. */ }
      } else {
        const legacyVideo = videoRef.current as (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
        }) | null;
        legacyVideo?.webkitEnterFullscreen?.();
      }
    } catch { /* Fullscreen is optional; native controls remain available. */ }
  };

  useEffect(() => {
    errorCallback.current = onFatalError;
    endedCallback.current = onEnded;
    itemRef.current = { item, season, episode };
  }, [onFatalError, onEnded, item, season, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentCandidate) return;

    let destroyed = false;
    failedRef.current = false;
    let hls: import("hls.js").default | null = null;

    const handleCandidateFail = () => {
      if (destroyed) return;
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((idx) => idx + 1);
      } else if (!failedRef.current) {
        failedRef.current = true;
        errorCallback.current();
      }
    };

    if (currentCandidate.kind === "mp4") {
      video.src = currentCandidate.url;
      video.load();
    } else {
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed) return;

          if (Hls.isSupported()) {
            const instance = new Hls({ enableWorker: true });
            hls = instance;
            instance.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal && !destroyed) {
                handleCandidateFail();
              }
            });
            instance.loadSource(currentCandidate.url);
            instance.attachMedia(video);
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = currentCandidate.url;
            video.load();
          } else {
            handleCandidateFail();
          }
        })
        .catch(() => {
          if (!destroyed) handleCandidateFail();
        });
    }

    return () => {
      destroyed = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [currentCandidate, candidateIndex, candidates.length]);

  const savePosition = (completed = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const { item: media, season: s, episode: e } = itemRef.current;
    if (video.currentTime > 1 || completed) {
      saveProgress(media, video.currentTime, video.duration, s, e, completed);
      void syncProgressToCloud(
        media,
        video.currentTime,
        video.duration,
        s,
        e,
        completed,
      );
      lastProgressWrite.current = video.currentTime;
    }
  };

  const poster = item.posterPath?.startsWith("/")
    ? `https://image.tmdb.org/t/p/w780${item.posterPath}`
    : undefined;

  return (
    <div ref={containerRef} className={`relative w-full bg-black ${isFullscreen ? "h-screen" : "h-full"}`}>
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        poster={poster}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        aria-label={`Play ${item.title} via ${currentCandidate?.label || source.label}`}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
          const saved = getProgress(item, season, episode);
          if (
            saved &&
            !saved.completed &&
            saved.seconds > 10 &&
            saved.seconds < video.duration - 30
          ) {
            video.currentTime = saved.seconds;
          }
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (video && Math.abs(video.currentTime - lastProgressWrite.current) >= 10) {
            savePosition();
          }
        }}
        onPause={() => savePosition()}
        onEnded={() => {
          savePosition(true);
          endedCallback.current?.();
        }}
        onError={() => {
          if (failedRef.current) return;
          failedRef.current = true;
          if (candidateIndex + 1 < candidates.length) {
            setCandidateIndex((idx) => idx + 1);
          } else {
            errorCallback.current();
          }
        }}
      >
        <track kind="captions" />
        Your browser cannot play this video.
      </video>

      <button
        type="button"
        onClick={() => { void toggleFullscreen(); }}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen and rotate landscape when supported"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-white/90 backdrop-blur-md transition hover:bg-black/75"
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      {/* Optional source indicator for an explicitly validated ISP origin */}
      {currentCandidate?.isIsp && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-black/70 px-2 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>ISP BDIX CDN (vod.cineplexbd.net:8081)</span>
        </div>
      )}
    </div>
  );
}
