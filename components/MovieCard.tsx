"use client";

import Image from "@/components/TmdbImage";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import {
  genresOf,
  img,
  titleOf,
  yearOf,
  type MediaType,
  type Title,
} from "@/lib/tmdb";

export type CardVariant = "poster" | "wide" | "top";

export function CardSkeleton({ variant = "poster" }: { variant?: CardVariant }) {
  const w = variant === "wide" ? "w-64 sm:w-72" : "w-36 sm:w-44";
  return (
    <div className={`${w} shrink-0`}>
      <div
        className={`${variant === "wide" ? "aspect-video" : "aspect-[2/3]"} animate-pulse rounded-xl border border-white/10 bg-surface`}
      />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.055]" />
    </div>
  );
}

export default function MovieCard({
  item,
  type,
  variant = "poster",
  rank,
  fluid = false,
}: {
  item: Title;
  type: MediaType;
  variant?: CardVariant;
  rank?: number;
  fluid?: boolean;
}) {
  const t = item.media_type ?? type;
  const wide = variant === "wide";
  const path = wide ? (item.backdrop_path ?? item.poster_path) : item.poster_path;
  const src = img(path, wide ? "w500" : "w342");
  const width = fluid
    ? "w-full"
    : wide
      ? "w-64 sm:w-72"
      : variant === "top"
        ? "w-28 sm:w-36"
        : "w-36 sm:w-44";

  const card = (
    <Link
      href={`/title/${t}/${item.id}`}
      aria-label={`View details for ${titleOf(item)}`}
      className={`group relative z-0 block ${width} shrink-0 transition-colors hover:z-30`}
      draggable={false}
    >
      <div
        className={`relative ${wide ? "aspect-video" : "aspect-[2/3]"} overflow-hidden rounded-xl border border-white/10 bg-surface transition-colors group-hover:border-accent/70 group-focus-visible:border-accent`}
      >
        {src ? (
          <Image
            src={src}
            alt={titleOf(item)}
            fill
            sizes={wide ? "288px" : "176px"}
            draggable={false}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-semibold text-white/40">
            {titleOf(item)}
          </div>
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[#0b100e]">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </div>

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-bold text-white/85 opacity-0 transition group-hover:opacity-100">
          <span>{yearOf(item)}</span>
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
            <Star size={10} className="fill-accent text-accent" />
            {(item.vote_average ?? 0).toFixed(1)}
          </span>
        </div>
      </div>

      {variant !== "top" && (
        <div className="mt-3 px-0.5">
          <h3 className="truncate text-sm font-medium tracking-[-0.015em] text-white sm:text-base">
            {titleOf(item)}
          </h3>
          <p className="mt-1 truncate text-xs text-white/70">
            {yearOf(item)} · {genresOf(item) || (t === "tv" ? "TV series" : "Movie")}
          </p>
        </div>
      )}
    </Link>
  );

  if (variant !== "top") return card;

  return (
    <div className="flex shrink-0 items-end pr-1">
      <span className="outline-num -mr-2 select-none font-display text-[4.5rem] font-medium leading-[1] tracking-[-0.08em] sm:text-[5.5rem]">
        {rank}
      </span>
      {card}
    </div>
  );
}
