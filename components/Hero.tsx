"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { genresOf, img, tmdb, titleOf, yearOf, type Title } from "@/lib/tmdb";

export default function Hero() {
  const [pool, setPool] = useState<Title[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    tmdb<{ results: Title[] }>("/trending/movie/week", {}, ac.signal)
      .then((d) => setPool(d.results.filter((r) => r.backdrop_path).slice(0, 5)))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 8000);
    return () => clearInterval(t);
  }, [pool.length]);

  const item = pool[idx];
  if (!item)
    return (
      <div className="h-[75vh] min-h-[460px] w-full animate-pulse bg-zinc-900 sm:h-[90vh]" />
    );

  const href = `/title/movie/${item.id}`;
  return (
    <header className="relative h-[80vh] min-h-[480px] w-full overflow-hidden sm:h-[92vh]">
      <Image
        key={item.id}
        src={img(item.backdrop_path, "original")!}
        alt={titleOf(item)}
        fill
        priority
        sizes="100vw"
        className="animate-fade-in object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />

      <div className="absolute inset-x-0 bottom-[16%] px-4 sm:px-8">
        <div key={item.id} className="max-w-2xl animate-fade-up">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-accent">
            {genresOf(item, 2) || "Trending"}
          </p>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight drop-shadow-lg sm:text-6xl">
            {titleOf(item)}
          </h1>
          <p className="mt-3 text-xs font-semibold text-zinc-300">
            {yearOf(item)} · ★ {item.vote_average.toFixed(1)}
          </p>
          <p className="mt-3 line-clamp-3 max-w-xl text-xs text-zinc-300 sm:text-sm">
            {item.overview}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${href}?play=1`}
              className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-xs font-bold text-black transition hover:brightness-110"
            >
              <Play className="fill-black" size={16} /> Start Watching
            </Link>
            <Link
              href={href}
              className="glass flex items-center gap-2 rounded-lg px-6 py-3 text-xs font-bold transition hover:bg-white/20"
            >
              ⓘ More Info
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[8%] right-4 flex gap-2 sm:right-8">
        {pool.map((p, i) => (
          <button
            key={p.id}
            aria-label={`Show ${titleOf(p)}`}
            onClick={() => setIdx(i)}
            className={`h-2 rounded-full transition-all ${
              i === idx ? "w-8 bg-accent" : "w-2 bg-white/40"
            }`}
          />
        ))}
      </div>
    </header>
  );
}
