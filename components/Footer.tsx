import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./Navbar";
import { GENRE_OPTIONS } from "@/lib/tmdb";

export function CtaBanner() {
  return (
    <section className="mx-4 overflow-hidden rounded-2xl border border-white/15 bg-surface px-6 py-10 sm:mx-8 sm:px-10 sm:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-accent">
            Your next watch
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-2xl font-medium leading-tight tracking-[-0.035em] text-white sm:text-4xl">
            Find something worth pressing play on.
          </h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/48">
            Browse curated movies and TV shows with a faster, cleaner PinFlix experience.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/browse/movie"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-[#0b100e] transition hover:bg-accent-soft"
          >
            Browse movies
            <ArrowUpRight size={14} />
          </Link>
          <Link
            href="/browse/tv"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-xs font-bold text-white/78 transition hover:bg-white/10 hover:text-white"
          >
            TV shows
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Footer() {
  const genres = GENRE_OPTIONS.filter((g) =>
    ["10749", "18", "10751", "35", "28", "12", "27", "53", "878"].includes(g.id),
  );

  return (
    <footer className="mt-16 border-t border-white/[0.07] bg-[#080a08] px-4 pt-12 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo />
          <p className="max-w-xs text-xs font-medium leading-5 text-white/40">
            A focused movie and TV discovery experience with fast browsing and clean playback flows.
          </p>
          <p className="text-xs leading-5 text-white/65">Your library and playback progress are stored in this browser.</p>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-medium text-white/90">
            Genres
          </h4>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs font-semibold text-white/38">
            {genres.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/browse/movie?genre=${g.id}`}
                  className="transition hover:text-accent"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-medium text-white/90">
            Explore
          </h4>
          <ul className="space-y-2.5 text-xs font-semibold text-white/38">
            <li>
              <Link href="/browse/movie" className="transition hover:text-accent">
                Movies
              </Link>
            </li>
            <li>
              <Link href="/browse/tv" className="transition hover:text-accent">
                TV Shows
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-white/[0.07] py-5 text-center text-[10px] font-medium text-white/28 sm:text-left">
        © 2026 PINFLIX. Metadata and images by TMDB; this product is not endorsed or certified by TMDB.
      </div>
    </footer>
  );
}
