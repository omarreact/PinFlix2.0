"use client";

import { useEffect, useRef, useState } from "react";
import { getProgress, saveProgress, type LibraryTitle } from "@/lib/library";
import { syncProgressToCloud } from "@/lib/cloud-library";
import type { PlayableSource } from "@/lib/playback";
export type { PlayableSource } from "@/lib/playback";

interface NativeMediaPlayerProps {
  source: PlayableSource;
  item: LibraryTitle;
  season?: number;
  episode?: number;
  onFatalError: () => void;
  onEnded?: () => void;
}

export default function NativeMediaPlayer({ source, item, season, episode, onFatalError, onEnded }: NativeMediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const callbacks = useRef({ onFatalError, onEnded });
  const mediaRef = useRef({ item, season, episode });
  const lastProgressWrite = useRef(0);
  const [levels, setLevels] = useState<Array<{ index: number; height: number }>>([]);
  const [quality, setQuality] = useState(-1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => { callbacks.current = { onFatalError, onEnded }; mediaRef.current = { item, season, episode }; }, [onFatalError, onEnded, item, season, episode]);

  const persist = (completed = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || (video.currentTime <= 1 && !completed)) return;
    const { item: media, season: s, episode: e } = mediaRef.current;
    saveProgress(media, video.currentTime, video.duration, s, e, completed);
    void syncProgressToCloud(media, video.currentTime, video.duration, s, e, completed);
    lastProgressWrite.current = video.currentTime;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let failed = false;
    let hls: import("hls.js").default | null = null;
    const fail = () => {
      if (destroyed || failed) return;
      failed = true;
      callbacks.current.onFatalError();
    };
    const restore = () => {
      const { item: media, season: s, episode: e } = mediaRef.current;
      const saved = getProgress(media, s, e);
      if (saved && !saved.completed && saved.seconds > 1 && saved.seconds < video.duration - 1) video.currentTime = saved.seconds;
    };
    const startup = window.setTimeout(() => { if (video.readyState < 2) fail(); }, 15000);
    video.addEventListener("error", fail);
    video.addEventListener("loadedmetadata", restore);
    const flush = () => persist();
    window.addEventListener("pagehide", flush);
    if (source.kind === "mp4" || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.url;
      video.load();
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) { fail(); return; }
        hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          if (!destroyed) setLevels(data.levels.map((level, index) => ({ index, height: level.height })));
        });
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(); });
        hls.loadSource(source.url);
        hls.attachMedia(video);
      }).catch(fail);
    }
    return () => {
      persist();
      destroyed = true;
      window.clearTimeout(startup);
      window.removeEventListener("pagehide", flush);
      video.removeEventListener("error", fail);
      video.removeEventListener("loadedmetadata", restore);
      hls?.destroy();
      hlsRef.current = null;
      video.pause(); video.removeAttribute("src"); video.load();
    };
    // Callbacks and title identity are refs; progress renders must not reload media.
  }, [source.url, source.kind]);

  const poster = item.posterPath?.startsWith("/") ? `https://image.tmdb.org/t/p/w780${item.posterPath}` : undefined;
  return <div className="relative h-full w-full bg-black">
    <video ref={videoRef} className="h-full w-full bg-black object-contain" poster={poster} controls playsInline preload="metadata" controlsList="nodownload" aria-label={`Play ${item.title} via ${source.label}`}
      onTimeUpdate={() => { const video = videoRef.current; if (video && Math.abs(video.currentTime - lastProgressWrite.current) >= 5) persist(); }}
      onPause={() => persist()}
      onEnded={() => { persist(true); callbacks.current.onEnded?.(); }}>
      {source.subtitles?.map((track) => <track key={`${track.language}-${track.url}`} kind="subtitles" srcLang={track.language} label={track.label} src={track.url} />)}
      Your browser cannot play this video.
    </video>
    <div className="absolute right-3 top-3 flex gap-2 rounded-lg bg-black/70 p-2 text-xs text-white">
      {levels.length > 1 && <label>Quality <select aria-label="Playback quality" className="bg-zinc-900" value={quality} onChange={(event) => { const index = Number(event.target.value); if (hlsRef.current) hlsRef.current.currentLevel = index; setQuality(index); }}><option value={-1}>Auto</option>{levels.map((level) => <option key={level.index} value={level.index}>{level.height ? `${level.height}p` : `Level ${level.index + 1}`}</option>)}</select></label>}
      <label>Speed <select aria-label="Playback speed" className="bg-zinc-900" value={speed} onChange={(event) => { const rate = Number(event.target.value); if (videoRef.current) videoRef.current.playbackRate = rate; setSpeed(rate); }}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}</select></label>
    </div>
  </div>;
}
