"use client";

import Image from "next/image";
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
        className={`${variant === "wide" ? "aspect-video" : "aspect-[2/3]"} animate-pulse rounded-2xl bg-white/[0.055]`}
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
      className={`group relative z-0 block ${width} shrink-0 transition duration-300 hover:z-30 hover:-translate-y-1`}
      draggable={false}
    >
      <div
        className={`relative ${wide ? "aspect-video" : "aspect-[2/3]"} overflow-hidden rounded-2xl bg-[#111311] ring-1 ring-white/[0.07] transition duration-300 group-hover:ring-accent/55 group-hover:shadow-[0_18px_45px_rgba(0,0,0,0.42)]`}
      >
        {src ? (
          <Image
            src={src}
            alt={titleOf(item)}
            fill
            sizes={wide ? "288px" : "176px"}
            draggable={false}
            className="object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm font-semibold text-white/40">
            {titleOf(item)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/5 to-transparent opacity-70 transition group-hover:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-accent text-[#071005] shadow-[0_10px_30px_rgba(117,242,60,0.24)] transition group-hover:scale-100">
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
          <h3 className="truncate text-[13px] font-extrabold tracking-[-0.015em] text-white sm:text-sm">
            {titleOf(item)}
          </h3>
          <p className="mt-1 truncate text-[10px] font-semibold text-white/38 sm:text-[11px]">
            {genresOf(item) || (t === "tv" ? "TV Series" : "Movie")}
          </p>
        </div>
      )}
    </Link>
  );

  if (variant !== "top") return card;

  return (
    <div className="flex shrink-0 items-end pr-1">
      <span className="outline-num -mr-4 select-none font-display text-[7rem] font-bold leading-[0.8] tracking-[-0.08em] sm:text-[9rem]">
        {rank}
      </span>
      {card}
    </div>
  );
}
