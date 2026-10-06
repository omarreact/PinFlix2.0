"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import {
  genresOf,
  img,
  titleOf,
  type MediaType,
  type Title,
} from "@/lib/tmdb";

export type CardVariant = "poster" | "wide" | "top";

export function CardSkeleton({ variant = "poster" }: { variant?: CardVariant }) {
  const w = variant === "wide" ? "w-64 sm:w-72" : "w-36 sm:w-44";
  return (
    <div className={`${w} shrink-0`}>
      <div
        className={`${variant === "wide" ? "aspect-video" : "aspect-[2/3]"} animate-pulse rounded-lg bg-zinc-800`}
      />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
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
  /** fill the parent grid cell instead of fixed carousel width */
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
      className={`group relative z-0 block ${width} shrink-0 transition-transform duration-300 hover:scale-105 hover:z-30 hover:delay-100`}
      draggable={false}
    >
      <div
        className={`relative ${wide ? "aspect-video" : "aspect-[2/3]"} overflow-hidden rounded-lg bg-zinc-800 shadow-lg ring-0 ring-accent transition-all duration-300 group-hover:ring-2`}
      >
        {src ? (
          <Image
            src={src}
            alt={titleOf(item)}
            fill
            sizes="288px"
            draggable={false}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-sm text-zinc-400">
            {titleOf(item)}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black">
            <Play className="h-5 w-5 fill-black" />
          </span>
        </div>
      </div>
      {variant !== "top" && (
        <>
          <h3 className="mt-3 truncate text-xs font-bold text-zinc-100 sm:text-sm">
            {titleOf(item)}
          </h3>
          <p className="truncate text-[11px] text-zinc-400">
            {genresOf(item)}
          </p>
        </>
      )}
    </Link>
  );

  if (variant !== "top") return card;
  return (
    <div className="flex shrink-0 items-end">
      <span className="outline-num -mr-4 select-none font-display text-[7rem] font-bold leading-[0.8] sm:text-[9rem]">
        {rank}
      </span>
      {card}
    </div>
  );
}
