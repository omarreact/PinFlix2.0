"use client";

import { useEffect, useState } from "react";
import TmdbImage from "@/components/TmdbImage";
import { img, tmdb, type Title } from "@/lib/tmdb";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

export default function Hero() {
  const [backdrop, setBackdrop] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void tmdb<Title>("/movie/76600", {}, controller.signal)
      .then((title) => setBackdrop(img(title.backdrop_path, "original")))
      .catch(() => { /* Retain the lightweight gradient when metadata is unavailable. */ });
    return () => controller.abort();
  }, []);

  return (
    <header className="relative h-[76vh] min-h-[530px] max-h-[850px] w-full overflow-hidden border-b border-white/10 bg-black sm:h-[85vh] sm:min-h-[620px]">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {backdrop ? (
          <TmdbImage src={backdrop} alt="" fill priority sizes="100vw"
            className="object-cover object-center" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_25%,#263e50,transparent_60%),linear-gradient(135deg,#10171e,#07090b)]" />
        )}
      </div>

      <div className="absolute inset-0 bg-black/55" />

      <div className="absolute inset-x-0 bottom-[15%] px-4 sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-xl animate-fade-up rounded-2xl border border-white/15 bg-[#0b100e]/90 p-5 sm:p-8">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.28em] text-accent sm:text-[11px]">
              <span className="h-px w-8 bg-accent" />
              Featured movie
            </div>

            <h1 className="max-w-xl font-display text-4xl font-medium leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Avatar: The Way of Water
            </h1>

            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-white/68 sm:text-base">
              Discover movies and TV series, explore the details, and find your next favorite watch.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/title/movie/76600"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-[#0b100e] shadow-lg shadow-accent/20 transition hover:bg-accent-soft"
              >
                <Play size={16} />
                Explore Movie
              </Link>
              <Link
                href="/browse/movie"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Browse movies
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 right-4 hidden items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55 backdrop-blur sm:flex sm:right-8">
        Featured catalog
      </div>
    </header>
  );
}
