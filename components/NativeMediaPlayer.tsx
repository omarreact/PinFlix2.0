"use client";

import { useEffect, useRef, useState } from "react";
import { getProgress, saveProgress, type LibraryTitle } from "@/lib/library";
import { syncProgressToCloud } from "@/lib/cloud-library";

export const ISP_CDN_BASE = "http://vod.cineplexbd.net:8081";

export interface PlayableSource {
  label: string;
  url: string;
  kind: "hls" | "mp4";
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
 * Builds prioritized ISP CDN candidate streams for a title.
 * Checks http://vod.cineplexbd.net:8081 before any third-party fallbacks.
 */
function buildIspCandidates(
  item: LibraryTitle,
  season?: number,
  episode?: number,
): StreamCandidate[] {
  const slug =
    (item.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || String(item.id);

  if (item.type === "tv") {
    const s = String(season ?? 1).padStart(2, "0");
    const e = String(episode ?? 1).padStart(2, "0");
    const directMp4 = `${ISP_CDN_BASE}/tv/${slug}/s${s}e${e}.mp4`;
    const directHls = `${ISP_CDN_BASE}/tv/${slug}/s${s}e${e}/master.m3u8`;
    return [
      {
        url: directMp4,
        kind: "mp4",
        label: `Primary ISP CDN MP4 (vod.cineplexbd.net:8081)`,
        isIsp: true,
      },
      {
        url: directHls,
        kind: "hls",
        label: `Primary ISP CDN HLS (vod.cineplexbd.net:8081)`,
        isIsp: true,
      },
      {
        url: `/api/media-proxy?url=${encodeURIComponent(directMp4)}`,
        kind: "mp4",
        label: `ISP CDN Proxy MP4 (vod.cineplexbd.net:8081)`,
        isIsp: true,
      },
      {
        url: `/api/media-proxy?url=${encodeURIComponent(directHls)}`,
        kind: "hls",
        label: `ISP CDN Proxy HLS (vod.cineplexbd.net:8081)`,
        isIsp: true,
      },
    ];
  }

  // Movie candidates
  const directMp4 = `${ISP_CDN_BASE}/movies/${slug}.mp4`;
  const directHls = `${ISP_CDN_BASE}/movies/${slug}/master.m3u8`;
  return [
    {
      url: directMp4,
      kind: "mp4",
      label: "Primary ISP CDN MP4 (vod.cineplexbd.net:8081)",
      isIsp: true,
    },
    {
      url: directHls,
      kind: "hls",
      label: "Primary ISP CDN HLS (vod.cineplexbd.net:8081)",
      isIsp: true,
    },
    {
      url: `/api/media-proxy?url=${encodeURIComponent(directMp4)}`,
      kind: "mp4",
      label: "ISP CDN Proxy MP4 (vod.cineplexbd.net:8081)",
      isIsp: true,
    },
    {
      url: `/api/media-proxy?url=${encodeURIComponent(directHls)}`,
      kind: "hls",
      label: "ISP CDN Proxy HLS (vod.cineplexbd.net:8081)",
      isIsp: true,
    },
  ];
}

/**
 * Returns prioritized stream candidates, ensuring http://vod.cineplexbd.net:8081
 * is verified as the primary streaming source before attempting third-party fallbacks.
 */
function getPrioritizedCandidates(
  source: PlayableSource,
  item: LibraryTitle,
  season?: number,
  episode?: number,
): StreamCandidate[] {
  const isSourceIsp =
    source.url.includes("vod.cineplexbd.net") || source.url.includes(":8081");

  const ispCandidates = buildIspCandidates(item, season, episode);

  const fallbackCandidate: StreamCandidate = {
    url: source.url,
    kind: source.kind,
    label: source.label || "Third-party Fallback Source",
    isIsp: false,
  };

  if (isSourceIsp) {
    const explicitIsp: StreamCandidate = {
      url: source.url,
      kind: source.kind,
      label: source.label || "ISP CDN (vod.cineplexbd.net:8081)",
      isIsp: true,
    };
    const explicitProxy: StreamCandidate = {
      url: `/api/media-proxy?url=${encodeURIComponent(source.url)}`,
      kind: source.kind,
      label: "ISP CDN Proxy (vod.cineplexbd.net:8081)",
      isIsp: true,
    };
    return [explicitIsp, explicitProxy, fallbackCandidate];
  }

  // Strictly check ISP CDN first before third-party fallbacks
  return [...ispCandidates, fallbackCandidate];
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
  const errorCallback = useRef(onFatalError);
  const endedCallback = useRef(onEnded);
  const itemRef = useRef({ item, season, episode });
  const lastProgressWrite = useRef(0);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = getPrioritizedCandidates(source, item, season, episode);
  const currentCandidate =
    candidates[Math.min(candidateIndex, candidates.length - 1)];

  useEffect(() => {
    errorCallback.current = onFatalError;
    endedCallback.current = onEnded;
    itemRef.current = { item, season, episode };
  }, [onFatalError, onEnded, item, season, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentCandidate) return;

    let destroyed = false;
    let hls: import("hls.js").default | null = null;

    const handleCandidateFail = () => {
      if (destroyed) return;
      if (candidateIndex + 1 < candidates.length) {
        setCandidateIndex((idx) => idx + 1);
      } else {
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
    <div className="relative h-full w-full bg-black">
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

      {/* Primary ISP CDN status indicator overlay */}
      {currentCandidate?.isIsp && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-black/70 px-2 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>ISP BDIX CDN (vod.cineplexbd.net:8081)</span>
        </div>
      )}
    </div>
  );
}
