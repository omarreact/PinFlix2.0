"use client";

import { useEffect, useState } from "react";
import Image from "@/components/TmdbImage";
import Link from "next/link";
import { genresOf, img, tmdb, titleOf, type MediaType, type Title } from "@/lib/tmdb";

export default function PopularList({ type }: { type: MediaType }) {
  const [items, setItems] = useState<Title[]>([]);
  useEffect(() => {
    const ac = new AbortController();
    tmdb<{ results: Title[] }>(`/${type}/popular`, {}, ac.signal)
      .then((d) => setItems(d.results.slice(0, 5)))
      .catch(() => {});
    return () => ac.abort();
  }, [type]);

  return (
    <aside>
      <h3 className="mb-4 text-sm font-bold">
        Popular {type === "tv" ? "TV Shows" : "Movies"}
      </h3>
      <ul className="space-y-4">
        {items.map((t, i) => (
          <li key={t.id}>
            <Link
              href={`/title/${type}/${t.id}`}
              className="group flex items-center gap-3"
            >
              <span className="w-4 text-xs font-bold text-accent">{i + 1}</span>
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-zinc-800">
                {(t.backdrop_path ?? t.poster_path) && (
                  <Image
                    src={img(t.backdrop_path ?? t.poster_path, "w300")!}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover transition group-hover:scale-110"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold group-hover:text-accent">
                  {titleOf(t)}
                </p>
                <p className="truncate text-[11px] text-accent/80">
                  {genresOf(t, 2)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
