"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, User, X } from "lucide-react";
import { img, tmdb, titleOf, yearOf, type Title } from "@/lib/tmdb";

export const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse/movie", label: "Movies" },
  { href: "/browse/tv", label: "TV Shows" },
  { href: "/my-list", label: "My List" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="PinFlix home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[#0b100e] transition group-hover:bg-accent-soft">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="font-display text-lg font-medium tracking-[-0.035em] text-white">
        PinFlix
        <sup className="ml-1 align-super text-[11px] font-medium tracking-normal text-accent">
          2.0
        </sup>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Title[]>([]);
  const [focus, setFocus] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    const away = (e: MouseEvent) =>
      !wrap.current?.contains(e.target as Node) && setFocus(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      // Results are hidden by "shown" below until the query is valid.
      return;
    }

    const ac = new AbortController();
    const t = setTimeout(() => {
      tmdb<{ results: Title[] }>("/search/multi", { query: q }, ac.signal)
        .then((d) =>
          setResults(
            d.results
              .filter((r) => r.media_type === "movie" || r.media_type === "tv")
              .slice(0, 6),
          ),
        )
        .catch(() => {});
    }, 300);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenu(false); setFocus(false); }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const shown = q.trim().length < 2 ? [] : results;
  const go = (t: Title) => {
    setFocus(false);
    setQ("");
    setMenu(false);
    router.push(`/title/${t.media_type}/${t.id}`);
  };

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        solid || menu
          ? "border-white/10 bg-[#0b100e]"
          : "border-white/10 bg-[#0b100e]/95"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-7 px-4 sm:px-8">
        <Logo />

        <ul className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-sm font-medium text-white/70 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`block rounded-md px-4 py-2 transition ${
                  active(l.href)
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          <div ref={wrap} className="relative hidden sm:block">
            <div className="flex w-60 items-center gap-2.5 rounded-full border border-white/10 bg-black/30 px-4 py-2.5 text-white/70 backdrop-blur transition focus-within:border-accent/60 focus-within:bg-black/50 focus-within:text-white lg:w-72">
              <Search size={15} strokeWidth={2.2} />
              <input
                value={q}
                onFocus={() => setFocus(true)}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search movies and TV shows"
                placeholder="Search movies & shows"
                className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-white/35"
              />
            </div>

            {focus && shown.length > 0 && (
              <ul className="glass absolute right-0 top-12 w-80 overflow-hidden rounded-2xl p-1">
                {shown.map((r) => (
                  <li key={`${r.media_type}${r.id}`}>
                    <button
                      onClick={() => go(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.07]"
                    >
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                        {r.poster_path && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img(r.poster_path, "w92")!}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {titleOf(r)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-white/45">
                          {r.media_type === "tv" ? "TV Series" : "Movie"} · {yearOf(r)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/my-list"
            aria-label="My Library"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white sm:flex"
          >
            <User size={17} />
          </Link>

          <Link
            href="/browse/movie"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-[#0b100e] transition hover:bg-accent-soft"
          >
            Explore
          </Link>

          <button
            type="button"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="pinflix-mobile-menu"
            onClick={() => setMenu((m) => !m)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] md:hidden"
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menu && (
        <div id="pinflix-mobile-menu" className="animate-fade-in border-t border-white/10 bg-[#0b100e] px-4 pb-5 pt-4 md:hidden">
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <Search size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search movies and TV shows on mobile"
              placeholder="Search movies & shows"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
            />
          </div>

          {shown.length > 0 && (
            <div className="mb-4 space-y-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1.5">
              {shown.slice(0, 4).map((r) => (
                <button
                  key={`${r.media_type}${r.id}`}
                  onClick={() => go(r)}
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold text-white/75 hover:bg-white/[0.06]"
                >
                  {titleOf(r)} · {yearOf(r)}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                  active(l.href) ? "bg-white/[0.08] text-white" : "text-white/70"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
