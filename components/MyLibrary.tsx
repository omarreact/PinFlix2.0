"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Cloud, Play, Trash2, User } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { img } from "@/lib/tmdb";
import {
  LIBRARY_EVENT,
  listHistory,
  listWatchlist,
  removeHistory,
  setWatchlist,
  type LibraryTitle,
  type WatchProgress,
  type SavedTitle,
} from "@/lib/library";
import { syncWatchlistToCloud, subscribeToCloudWatchlist } from "@/lib/cloud-library";
import { useAuth } from "@/components/AuthProvider";

function playUrl(item: LibraryTitle, season?: number, episode?: number): string {
  const params = new URLSearchParams({ play: "1" });
  if (item.type === "tv") {
    params.set("season", String(season ?? 1));
    params.set("episode", String(episode ?? 1));
  }
  return `/title/${item.type}/${item.id}?${params.toString()}`;
}

function Poster({ item }: { item: LibraryTitle }) {
  const url = img(item.posterPath, "w300");
  return (
    <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
      {url ? (
        <Image src={url} alt="" fill sizes="80px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
          No image
        </div>
      )}
    </div>
  );
}

export default function MyLibrary() {
  const { user, signInWithGoogle } = useAuth();
  const [saved, setSaved] = useState<SavedTitle[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSaved(listWatchlist());
      setHistory(listHistory());
    };
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);

    let unsubscribeCloud: (() => void) | undefined;
    if (user) {
      unsubscribeCloud = subscribeToCloudWatchlist(user.uid);
    }

    return () => {
      window.removeEventListener(LIBRARY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [user]);

  const handleRemoveWatchlist = (item: SavedTitle) => {
    setWatchlist(item, false);
    void syncWatchlistToCloud(item, false);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-[65vh] max-w-6xl px-4 pb-16 pt-28 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold sm:text-5xl">
              My Library
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Manage your personal watchlist and continue where you left off.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface/80 px-3.5 py-2 text-xs">
            {user ? (
              <span className="flex items-center gap-2 font-medium text-emerald-400">
                <Cloud size={15} />
                Cloud Sync: Active ({user.displayName || "Account"})
              </span>
            ) : (
              <div className="flex items-center gap-2 text-zinc-400">
                <Cloud size={15} className="text-zinc-500" />
                <span>Cloud Sync: Guest</span>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="ml-1 inline-flex items-center gap-1 font-bold text-accent hover:underline"
                >
                  <User size={13} /> Sign In to Sync
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-accent">My Watchlist</h2>
          {saved.length === 0 ? (
            <p className="rounded-xl border border-white/10 p-6 text-sm text-zinc-500">
              Save a movie or show from its details page to see it here.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {saved.map((item) => (
                <article
                  key={`${item.type}:${item.id}`}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <Link href={playUrl(item)}>
                    <Poster item={item} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={playUrl(item)}
                      className="font-semibold hover:text-accent"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.type === "tv" ? "TV Series" : "Movie"} · {item.year}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={playUrl(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black"
                      >
                        <Play size={13} /> Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveWatchlist(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-accent">Continue Watching</h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-white/10 p-6 text-sm text-zinc-500">
              Watch progress appears here after playing a configured full-length video.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {history.map((item) => (
                <article
                  key={`${item.type}:${item.id}:s${item.season}e${item.episode}`}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <Link href={playUrl(item, item.season, item.episode)}>
                    <Poster item={item} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={playUrl(item, item.season, item.episode)}
                      className="font-semibold hover:text-accent"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.type === "tv"
                        ? `Season ${item.season}, Episode ${item.episode}`
                        : item.year}
                      {item.completed ? " · Finished" : ""}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((item.seconds / item.duration) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={playUrl(item, item.season, item.episode)}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black"
                      >
                        <Play size={13} /> {item.completed ? "Watch again" : "Resume"}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeHistory(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                      >
                        <Trash2 size={13} /> Clear
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
