import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

const VIDEO_ID = "d9MyW72ELq0";

export default function Hero() {
  return (
    <header className="relative h-[76vh] min-h-[530px] max-h-[850px] w-full overflow-hidden border-b border-white/10 bg-black sm:h-[85vh] sm:min-h-[620px]">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <iframe
          title="Avatar: The Way of Water official trailer"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&controls=0&loop=1&playlist=${VIDEO_ID}&modestbranding=1&rel=0&playsinline=1&disablekb=1&fs=0`}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.77777778vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={-1}
        />
      </div>

      <div className="absolute inset-0 bg-black/55" />

      <div className="absolute inset-x-0 bottom-[15%] px-4 sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-xl animate-fade-up rounded-2xl border border-white/15 bg-[#0b100e]/90 p-5 sm:p-8">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.28em] text-accent sm:text-[11px]">
              <span className="h-px w-8 bg-accent" />
              Featured trailer
            </div>

            <h1 className="max-w-xl font-display text-4xl font-medium leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Avatar: The Way of Water
            </h1>

            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-white/68 sm:text-base">
              Discover movies and TV series, explore the details, and find your next favorite watch.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/title/movie/76600?play=1"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-[#0b100e] shadow-lg shadow-accent/20 transition hover:bg-accent-soft"
              >
                <Play size={16} className="fill-current" />
                Watch Movie Now
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
        Muted autoplay
      </div>
    </header>
  );
}
