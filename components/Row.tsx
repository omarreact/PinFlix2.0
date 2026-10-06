"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard, { CardSkeleton, type CardVariant } from "./MovieCard";
import { tmdb, type MediaType, type Title } from "@/lib/tmdb";

export default function Row({
  title,
  path,
  type,
  params = {},
  variant = "poster",
  href,
  limit,
}: {
  title: string;
  path: string;
  type: MediaType;
  params?: Record<string, string>;
  variant?: CardVariant;
  href?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<Title[] | null>(null);
  const [error, setError] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  useEffect(() => {
    const ac = new AbortController();
    tmdb<{ results: Title[] }>(path, params, ac.signal)
      .then((d) => setItems(d.results))
      .catch((e) => e.name !== "AbortError" && setError(true));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // fade-in on scroll
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollBy = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      left: dir * scroller.current.clientWidth * 0.8,
      behavior: "smooth",
    });

  const onDown = (e: React.MouseEvent) => {
    const s = scroller.current!;
    drag.current = { down: true, x: e.pageX, left: s.scrollLeft, moved: false };
  };
  const onMove = (e: React.MouseEvent) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.pageX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    scroller.current!.scrollLeft = d.left - dx;
  };
  const end = () => (drag.current.down = false);

  if (error) return null;

  const shown = (items ?? [])
    .filter((i) => (variant === "wide" ? i.backdrop_path : i.poster_path))
    .slice(0, limit ?? 20);

  return (
    <section ref={section} className="reveal group/row relative">
      <div className="mb-1 flex items-end justify-between px-4 sm:px-8">
        <h2 className="text-sm font-bold sm:text-base">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-xs text-zinc-400 transition hover:text-accent"
          >
            All {type === "tv" ? "Shows" : "Movies"} ›
          </Link>
        )}
      </div>
      <div className="relative">
        <button
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="glass absolute left-2 top-[35%] z-40 hidden h-10 w-10 items-center justify-center rounded-full opacity-0 transition group-hover/row:opacity-100 hover:bg-accent hover:text-black md:flex"
        >
          <ChevronLeft />
        </button>
        <div
          ref={scroller}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={end}
          onMouseLeave={end}
          onClickCapture={(e) => {
            if (drag.current.moved) {
              e.preventDefault();
              e.stopPropagation();
              drag.current.moved = false;
            }
          }}
          className="no-scrollbar flex cursor-grab gap-4 overflow-x-auto px-4 py-4 active:cursor-grabbing sm:px-8"
        >
          {items
            ? shown.map((i, n) => (
                <MovieCard
                  key={i.id}
                  item={i}
                  type={type}
                  variant={variant}
                  rank={n + 1}
                />
              ))
            : Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} variant={variant} />
              ))}
        </div>
        <button
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="glass absolute right-2 top-[35%] z-40 hidden h-10 w-10 items-center justify-center rounded-full opacity-0 transition group-hover/row:opacity-100 hover:bg-accent hover:text-black md:flex"
        >
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}
