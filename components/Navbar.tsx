"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, User, X } from "lucide-react";
import { img, tmdb, titleOf, yearOf, type Title } from "@/lib/tmdb";

export const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse/movie", label: "Movies" },
  { href: "/browse/tv", label: "TV Shows" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-black">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        pinflix
        <sup className="ml-0.5 text-[9px] text-accent">2.0</sup>
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

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
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
    if (q.trim().length < 2) return;
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

  const shown = q.trim().length < 2 ? [] : results;
  const go = (t: Title) => {
    setFocus(false);
    setQ("");
    setMenu(false);
    router.push(`/title/${t.media_type}/${t.id}`);
  };

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid || menu
          ? "bg-[#0b0b0b]/95 shadow-lg shadow-black/50 backdrop-blur-md"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="flex items-center gap-6 px-4 py-3 sm:px-8">
        <Logo />
        <ul className="hidden items-center gap-6 text-xs font-semibold md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition hover:text-accent">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          <div ref={wrap} className="relative hidden sm:block">
            <div className="flex w-64 items-center gap-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 backdrop-blur focus-within:border-accent">
              <Search size={16} />
              <input
                value={q}
                onFocus={() => setFocus(true)}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find movies, TV shows…"
                className="w-full bg-transparent text-xs outline-none placeholder:text-zinc-400"
              />
            </div>
            {focus && shown.length > 0 && (
              <ul className="glass absolute right-0 top-11 w-80 overflow-hidden rounded-xl">
                {shown.map((r) => (
                  <li key={`${r.media_type}${r.id}`}>
                    <button
                      onClick={() => go(r)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10"
                    >
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
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
                        <p className="truncate text-sm font-semibold">
                          {titleOf(r)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {r.media_type === "tv" ? "TV" : "Movie"} · {yearOf(r)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            aria-label="Profile"
            className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 sm:flex"
          >
            <User size={18} />
          </button>
          <Link
            href="/browse/movie"
            className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-black transition hover:brightness-110"
          >
            Subscribe
          </Link>
          <button
            aria-label="Menu"
            onClick={() => setMenu((m) => !m)}
            className="md:hidden"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {menu && (
        <div className="animate-fade-in space-y-4 border-t border-white/10 px-4 py-4 md:hidden">
          <div className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find movies, TV shows…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {shown.map((r) => (
            <button
              key={`${r.media_type}${r.id}`}
              onClick={() => go(r)}
              className="block w-full truncate text-left text-sm text-zinc-300"
            >
              {titleOf(r)} · {yearOf(r)}
            </button>
          ))}
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenu(false)}
              className="block text-sm font-semibold"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
