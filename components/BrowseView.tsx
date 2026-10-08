"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutGrid, Rows3, RotateCcw, Search } from "lucide-react";
import Footer, { CtaBanner } from "@/components/Footer";
import MovieCard from "@/components/MovieCard";
import Navbar from "@/components/Navbar";
import PopularList from "@/components/PopularList";
import { GENRE_OPTIONS, tmdb, titleOf, type Title } from "@/lib/tmdb";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SORTS = [
  { v: "popularity.desc", l: "Popularity" },
  { v: "vote_average.desc", l: "Rating" },
  { v: "primary_release_date.desc", l: "Newest" },
];

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-lg border border-white/15 bg-surface">
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-8 text-xs font-semibold outline-none [&>option]:bg-zinc-900"
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

export default function BrowseView() {
  const { type: raw } = useParams<{ type: string }>();
  const type = raw === "tv" ? "tv" : "movie";
  const [genre, setGenre] = useState(useSearchParams().get("genre") ?? "");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState(SORTS[0].v);
  const [page, setPage] = useState(1);
  const [letter, setLetter] = useState("");
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"poster" | "wide">("poster");
  const [data, setData] = useState<{
    key: string;
    items: Title[];
    total: number;
    pages: number;
  } | null>(null);

  const key = `${type}|${genre}|${year}|${sort}|${page}`;

  useEffect(() => {
    const ac = new AbortController();
    const params: Record<string, string> = {
      sort_by:
        type === "tv" && sort.startsWith("primary_release")
          ? "first_air_date.desc"
          : sort,
      page: String(page),
      "vote_count.gte": "50",
    };
    if (genre) params.with_genres = genre;
    if (year)
      params[type === "tv" ? "first_air_date_year" : "primary_release_year"] =
        year;
    tmdb<{ results: Title[]; total_results: number; total_pages: number }>(
      `/discover/${type}`,
      params,
      ac.signal,
    )
      .then((d) =>
        setData({
          key,
          items: d.results,
          total: d.total_results,
          pages: Math.min(d.total_pages, 500),
        }),
      )
      .catch(() => {});
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = data?.key !== key;
  const items = (data?.items ?? []).filter((t) => {
    const n = titleOf(t).toLowerCase();
    return (
      (!letter || n.startsWith(letter.toLowerCase())) &&
      (!filter || n.includes(filter.toLowerCase()))
    );
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const years = Array.from({ length: 40 }, (_, i) => String(2026 - i));
  const pages = data?.pages ?? 1;
  const pageNums = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-24 sm:px-8">
        <h1 className="font-display text-2xl font-medium sm:text-3xl">
          {type === "tv" ? "TV Shows" : "Movies"}
        </h1>
        <p className="mt-1 text-[11px] text-zinc-400">
          <Link href="/" className="hover:text-accent">
            Home
          </Link>{" "}
          / {type === "tv" ? "TV Shows" : "Movies"}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[245px_1fr]">
          <div className="h-fit space-y-7 rounded-xl border border-white/10 bg-surface p-4">
            <div className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-[#0b100e] px-3 py-2">
              <Search size={14} />
              <input
                value={filter}
                aria-label="Filter titles on this page"
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter this page…"
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-bold">Filter By Letter</h3>
              <div className="grid grid-cols-9 gap-1.5 lg:grid-cols-6">
                {LETTERS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLetter(letter === l ? "" : l)}
                    aria-label={`Filter by letter ${l}`}
                    aria-pressed={letter === l}
                    className={`aspect-square rounded text-[11px] font-bold transition ${
                      letter === l
                        ? "bg-accent text-black"
                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setGenre(""); setYear(""); setSort(SORTS[0].v);
                setPage(1); setLetter(""); setFilter("");
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 transition hover:border-accent hover:text-accent"
            >
              <RotateCcw size={15} aria-hidden="true" /> Clear filters
            </button>
            <div className="hidden border-t border-white/10 pt-6 lg:block">
              <PopularList type={type} />
            </div>
          </div>

          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-zinc-400">
                {loading
                  ? "Loading…"
                  : `Showing ${items.length} of ${data!.total.toLocaleString()} results`}
              </p>
              <div className="flex gap-2">
                <Select label="Genre" value={genre} onChange={reset(setGenre)}>
                  <option value="">Genres</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <Select label="Release year" value={year} onChange={reset(setYear)}>
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
                <Select label="Sort titles" value={sort} onChange={reset(setSort)}>
                  {SORTS.map((s) => (
                    <option key={s.v} value={s.v}>
                      Sort: {s.l}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mb-4 flex justify-end gap-2" role="group" aria-label="Catalog layout">
              <button
                type="button"
                onClick={() => setViewMode("poster")}
                aria-pressed={viewMode === "poster"}
                aria-label="Show poster layout"
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${viewMode === "poster" ? "border-accent bg-accent/10 text-accent" : "border-white/20 bg-surface text-white/75 hover:text-white"}`}
              >
                <LayoutGrid size={16} aria-hidden="true" /> Posters
              </button>
              <button
                type="button"
                onClick={() => setViewMode("wide")}
                aria-pressed={viewMode === "wide"}
                aria-label="Show landscape layout"
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${viewMode === "wide" ? "border-accent bg-accent/10 text-accent" : "border-white/20 bg-surface text-white/75 hover:text-white"}`}
              >
                <Rows3 size={16} aria-hidden="true" /> Landscape
              </button>
            </div>
            <div className={`grid grid-cols-2 gap-x-4 gap-y-6 ${viewMode === "poster" ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-3 xl:grid-cols-4"}`}>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>
                      <div className={`${viewMode === "poster" ? "aspect-[2/3]" : "aspect-video"} animate-pulse rounded-xl bg-surface`} />
                      <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
                    </div>
                  ))
                : items.map((t) => (
                    <MovieCard key={t.id} item={t} type={type} variant={viewMode} fluid />
                  ))}
            </div>
            {!loading && items.length === 0 && (
              <p className="py-16 text-center text-sm text-zinc-500">
                Nothing matches these filters on this page.
              </p>
            )}

            <div className="mt-10 flex items-center justify-center gap-2 text-xs font-bold">
              {page > 1 && (
                <button
                  onClick={() => setPage(page - 1)}
                  aria-label="Previous page"
                  className="rounded bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
                >
                  ‹
                </button>
              )}
              {pageNums.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                  className={`rounded px-3 py-2 ${
                    p === page
                      ? "bg-accent text-black"
                      : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  {p}
                </button>
              ))}
              {page < pages && (
                <button
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                  className="rounded bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
                >
                  »
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
      <CtaBanner />
      <Footer />
    </>
  );
}
