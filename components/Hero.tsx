import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

const VIDEO_ID = "d9MyW72ELq0";

export default function Hero() {
  return (
    <header className="relative h-[76vh] min-h-[540px] w-full overflow-hidden bg-black sm:h-[92vh] sm:min-h-[680px]">
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

      <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/38 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-[#070807] via-[#070807]/62 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="absolute inset-x-0 bottom-[15%] px-4 sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl animate-fade-up">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.28em] text-accent sm:text-[11px]">
              <span className="h-px w-8 bg-accent" />
              Featured trailer
            </div>

            <h1 className="max-w-xl font-display text-4xl font-bold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Avatar: The Way of Water
            </h1>

            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-white/68 sm:text-base">
              A cinematic spotlight for PinFlix 2.0. Explore the catalog while the
              featured trailer plays seamlessly in the background.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/browse/movie"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-xs font-extrabold text-[#071005] shadow-[0_12px_32px_rgba(117,242,60,0.2)] transition hover:-translate-y-0.5 hover:bg-[#91ff5d]"
              >
                <Play size={15} className="fill-current" />
                Browse movies
              </Link>
              <Link
                href="/browse/tv"
                className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
              >
                Explore TV shows
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
