"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Mail, Rss } from "lucide-react";
import { Logo } from "./Navbar";
import { GENRE_OPTIONS, img, tmdb, type Title } from "@/lib/tmdb";

export function CtaBanner() {
  const [posters, setPosters] = useState<string[]>([]);
  useEffect(() => {
    const ac = new AbortController();
    tmdb<{ results: Title[] }>("/trending/all/week", {}, ac.signal)
      .then((d) =>
        setPosters(
          d.results.filter((r) => r.poster_path).map((r) => r.poster_path!),
        ),
      )
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return (
    <section className="relative mx-4 overflow-hidden rounded-xl bg-zinc-950 sm:mx-8">
      <div className="absolute inset-0 grid grid-cols-5 gap-1 opacity-30 sm:grid-cols-8 lg:grid-cols-10">
        {posters.slice(0, 20).map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={img(p, "w154")!} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#1c4a0c] via-[#0a1f06]/80 to-black/70" />
      <div className="relative px-6 py-14 text-center sm:py-20">
        <h2 className="font-display text-2xl font-bold uppercase leading-tight sm:text-4xl">
          Start your free
          <br />
          trial today
        </h2>
        <p className="mx-auto mt-3 max-w-md text-xs text-zinc-300">
          Subscribe for {"$9.99"} / month. Cancel anytime.
        </p>
        <Link
          href="/browse/movie"
          className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 text-xs font-bold text-black transition hover:brightness-110"
        >
          Start free trial
        </Link>
      </div>
    </section>
  );
}

export default function Footer() {
  const genres = GENRE_OPTIONS.filter((g) =>
    ["10749", "18", "10751", "35", "28", "12", "27", "53", "878"].includes(g.id),
  );
  return (
    <footer className="mt-16 bg-[#111] px-4 pt-12 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="text-xs font-semibold">Connect with us</p>
          <div className="flex gap-3 text-zinc-300">
            <Globe size={16} />
            <Mail size={16} />
            <Rss size={16} />
          </div>
          <p className="text-xs text-zinc-500">
            Privacy Policy · Terms of Service
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold">Genres</h4>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-zinc-400">
            {genres.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/browse/movie?genre=${g.id}`}
                  className="hover:text-accent"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold">Help</h4>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li>My Account</li>
            <li>Customer Support</li>
            <li>Contact Us</li>
            <li>Advertise</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="mb-3 text-sm font-bold">Learn More</h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li>
                <Link href="/browse/movie" className="hover:text-accent">
                  View Plans
                </Link>
              </li>
              <li>Blog</li>
              <li>Devices</li>
              <li>About Us</li>
            </ul>
          </div>
          <p className="text-xs text-zinc-500">Download mobile app</p>
          <div className="flex gap-2">
            <span className="rounded-lg border border-white/30 px-3 py-1.5 text-[10px] font-semibold">
              App Store
            </span>
            <span className="rounded-lg border border-white/30 px-3 py-1.5 text-[10px] font-semibold">
              Google Play
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-[11px] text-zinc-500">
        © 2026 PINFLIX. All rights reserved. Metadata and images by TMDB; this
        product is not endorsed or certified by TMDB.
      </div>
    </footer>
  );
}

