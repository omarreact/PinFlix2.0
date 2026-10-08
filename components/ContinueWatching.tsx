"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play } from "lucide-react";
import { img } from "@/lib/tmdb";
import { LIBRARY_EVENT, listHistory, type WatchProgress } from "@/lib/library";

export default function ContinueWatching() {
  const [entries, setEntries] = useState<WatchProgress[]>([]);
  useEffect(() => {
    const refresh = () => setEntries(listHistory().filter((entry) => !entry.completed).slice(0, 8));
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  if (entries.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold sm:text-2xl">Continue Watching</h2>
        <Link href="/my-list" className="flex items-center gap-1 text-xs font-semibold text-accent">
          My Library <ArrowRight size={14} />
        </Link>
      </div>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-3">
        {entries.map((entry) => {
          const params = new URLSearchParams({ play: "1" });
          if (entry.type === "tv") {
            params.set("season", String(entry.season ?? 1));
            params.set("episode", String(entry.episode ?? 1));
          }
          const href = `/title/${entry.type}/${entry.id}?${params.toString()}`;
          const poster = img(entry.posterPath, "w300");
          return (
            <Link key={`${entry.type}:${entry.id}:s${entry.season}e${entry.episode}`}
              href={href} className="group w-36 shrink-0 sm:w-44">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900">
                {poster && <Image src={poster} fill alt="" sizes="176px"
                  className="object-cover transition group-hover:scale-105" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/35">
                  <Play className="opacity-0 transition group-hover:opacity-100" size={28} />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                  <div className="h-full bg-accent" style={{
                    width: `${Math.min(100, 100 * entry.seconds / entry.duration)}%`,
                  }} />
                </div>
              </div>
              <p className="mt-2 truncate text-xs font-bold text-white">{entry.title}</p>
              {entry.type === "tv" && <p className="mt-1 text-[11px] text-zinc-500">
                S{entry.season} · E{entry.episode}
              </p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
