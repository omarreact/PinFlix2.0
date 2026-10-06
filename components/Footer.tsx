import Link from "next/link";
import { ArrowUpRight, Globe, Mail, Rss } from "lucide-react";
import { Logo } from "./Navbar";
import { GENRE_OPTIONS } from "@/lib/tmdb";

export function CtaBanner() {
  return (
    <section className="mx-4 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_20%_20%,rgba(117,242,60,0.16),transparent_34%),linear-gradient(135deg,#111811_0%,#0b0d0b_45%,#111111_100%)] px-6 py-10 shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:mx-8 sm:px-10 sm:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.26em] text-accent">
            Your next watch
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-[-0.045em] text-white sm:text-4xl">
            Find something worth pressing play on.
          </h2>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/48">
            Browse curated movies and TV shows with a faster, cleaner PinFlix experience.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/browse/movie"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-xs font-extrabold text-[#071005] transition hover:-translate-y-0.5 hover:bg-[#91ff5d]"
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
      <div className="mx-auto grid max-w-7xl gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo />
          <p className="max-w-xs text-xs font-medium leading-5 text-white/40">
            A focused movie and TV discovery experience with fast browsing and clean playback flows.
          </p>
          <div className="flex gap-2 text-white/45">
            {[Globe, Mail, Rss].map((Icon, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03]"
              >
                <Icon size={14} />
              </span>
            ))}
          </div>
          <p className="text-[11px] font-medium text-white/28">
            Privacy Policy · Terms of Service
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">
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
          <h4 className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">
            Help
          </h4>
          <ul className="space-y-2.5 text-xs font-semibold text-white/38">
            <li>My Account</li>
            <li>Customer Support</li>
            <li>Contact Us</li>
            <li>Advertise</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">
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
            <li>Devices</li>
            <li>About PinFlix</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl border-t border-white/[0.07] py-5 text-center text-[10px] font-medium text-white/28 sm:text-left">
        © 2026 PINFLIX. Metadata and images by TMDB; this product is not endorsed or certified by TMDB.
      </div>
    </footer>
  );
}
