"use client";

import { useEffect, useState } from "react";
import Image from "@/components/TmdbImage";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Clock, Play, Star } from "lucide-react";
import Footer, { CtaBanner } from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PopularList from "@/components/PopularList";
import Row from "@/components/Row";
import { ActionBar, Reviews } from "@/components/Social";
import VideoPlayer from "@/components/VideoPlayer";
import WatchProviders from "@/components/WatchProviders";
import {
  img,
  tmdb,
  titleOf,
  yearOf,
  type Details,
  type Episode,
} from "@/lib/tmdb";

export default function TitleView() {
  const { type, id } = useParams<{ type: "movie" | "tv"; id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const playParam = searchParams.get("play");
  const urlSeason = Number(searchParams.get("season") ?? "1");
  const urlEpisode = Number(searchParams.get("episode") ?? "1");
  const safeNumber = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 999 ? n : 1;
  const [d, setD] = useState<Details | null>(null);
  const [error, setError] = useState(false);
  const showPlayer = playParam === "1";
  const season = safeNumber(urlSeason);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const episode = safeNumber(urlEpisode);

  const updateSelection = (nextSeason: number, nextEpisode: number, play: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type === "tv") {
      params.set("season", String(nextSeason));
      params.set("episode", String(nextEpisode));
    }
    if (play) params.set("play", "1");
    router.replace(`/title/${type}/${id}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (type !== "movie" && type !== "tv") return;
    const ac = new AbortController();
    tmdb<Details>(
      `/${type}/${id}`,
      { append_to_response: "credits,videos" },
      ac.signal,
    )
      .then((x) => {
        setD(x);
        document.title = `${titleOf(x)} · PINFLIX`;
      })
      .catch((e) => e.name !== "AbortError" && setError(true));
    return () => ac.abort();
  }, [type, id]);

  useEffect(() => {
    if (type !== "tv") return;
    const ac = new AbortController();
    tmdb<{ episodes: Episode[] }>(`/tv/${id}/season/${season}`, {}, ac.signal)
      .then((s) => {
        setEpisodes(s.episodes);
      })
      .catch(() => setEpisodes([]));
    return () => ac.abort();
  }, [type, id, season]);

  if (error)
    return (
      <>
        <Navbar />
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <p className="text-zinc-400">Couldn&apos;t load this title.</p>
          <Link
            href="/"
            className="rounded-lg bg-accent px-5 py-2 text-sm font-bold text-black"
          >
            Back home
          </Link>
        </div>
      </>
    );

  if (!d)
    return (
      <>
        <Navbar />
        <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pt-24 sm:px-8">
          <div className="aspect-video w-full max-w-4xl rounded-xl bg-zinc-800" />
          <div className="mt-6 h-10 w-1/2 rounded bg-zinc-800" />
          <div className="mt-4 h-4 w-1/3 rounded bg-zinc-800" />
        </div>
      </>
    );

  const poster = img(d.poster_path, "w500");
  const backdrop = img(d.backdrop_path, "original");
  const runtime = d.runtime ?? d.episode_run_time?.[0];
  const seasons = (d.seasons ?? []).filter((s) => s.season_number > 0);
  const currentEp = episodes.find((e) => e.episode_number === episode);
  const label = type === "tv" ? "TV Shows" : "Movies";
  const director = d.credits?.crew?.find((c) => c.job === "Director");

  return (
    <>
      <Navbar />
      <div className="relative">
        {backdrop && (
          <div className="absolute inset-x-0 top-0 h-[75vh] overflow-hidden">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />
          </div>
        )}

        <main className="relative mx-auto w-full max-w-7xl px-4 pt-20 sm:px-8 sm:pt-24">
          {/* Player + episodes / poster */}
          <div className="animate-fade-up grid gap-6 lg:grid-cols-[1fr_340px]">
            <section
              id="player"
              aria-label="Watch player"
              className="scroll-mt-24 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-4"
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-accent">
                    PinFlix player
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">
                    Watch Now
                  </h2>
                </div>
                <p className="text-xs font-medium text-zinc-400">
                  {type === "tv"
                    ? `Season ${season} · Episode ${episode}`
                    : "Movie"}
                </p>
              </div>
              {showPlayer ? (
                <VideoPlayer
                  type={type}
                  tmdbId={d.id}
                  title={titleOf(d)}
                  year={yearOf(d)}
                  season={type === "tv" ? season : undefined}
                  episode={type === "tv" ? episode : undefined}
                  videos={d.videos?.results ?? []}
                  posterPath={d.poster_path}
                />
              ) : (
                <button
                  onClick={() => updateSelection(season, episode, true)}
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900"
                >
                  {d.backdrop_path && (
                    <Image
                      src={img(d.backdrop_path, "w1280")!}
                      alt=""
                      fill
                      sizes="(min-width:1024px) 800px, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-black shadow-xl transition group-hover:scale-110">
                    <Play size={32} className="fill-black" />
                  </span>
                </button>
              )}
            </section>

            {type === "tv" && seasons.length > 0 ? (
              <aside className="flex min-h-0 flex-col lg:max-h-[calc(56.25vw*0.6)] xl:max-h-[440px]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold">
                    Episodes · {episodes.length}
                  </h2>
                  <div className="relative rounded-md border border-white/15 bg-black">
                    <select
                      value={season}
                      onChange={(e) => {
                        const next = safeNumber(Number(e.target.value));
                        updateSelection(next, 1, showPlayer);
                      }}
                      className="cursor-pointer appearance-none bg-transparent py-1.5 pl-3 pr-7 text-xs font-semibold outline-none [&>option]:bg-zinc-900"
                    >
                      {seasons.map((s) => (
                        <option key={s.season_number} value={s.season_number}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                    />
                  </div>
                </div>
                <ul className="no-scrollbar max-h-96 space-y-2 overflow-y-auto lg:max-h-none">
                  {episodes.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => {
                          updateSelection(season, e.episode_number, true);
                        }}
                        className={`flex w-full gap-3 rounded-lg p-2 text-left transition ${
                          e.episode_number === episode
                            ? "bg-accent/15 ring-1 ring-accent"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-zinc-800">
                          {e.still_path && (
                            <Image
                              src={img(e.still_path, "w300")!}
                              alt=""
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-accent">
                            S{String(season).padStart(2, "0")}E
                            {String(e.episode_number).padStart(2, "0")}
                          </p>
                          <p className="truncate text-xs font-bold">{e.name}</p>
                          <p className="line-clamp-1 text-[11px] text-zinc-500">
                            {e.overview}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : (
              <aside className="hidden lg:block">
                {poster && (
                  <div className="relative mx-auto aspect-[2/3] w-56 overflow-hidden rounded-xl bg-zinc-800 shadow-2xl shadow-black">
                    <Image
                      src={poster}
                      alt={titleOf(d)}
                      fill
                      sizes="224px"
                      className="object-cover"
                    />
                  </div>
                )}
              </aside>
            )}
          </div>

          {/* Info */}
          <section className="mt-8">
            <p className="text-[11px] text-zinc-400">
              <Link href="/" className="hover:text-accent">
                Home
              </Link>{" "}
              /{" "}
              <Link href={`/browse/${type}`} className="hover:text-accent">
                {label}
              </Link>{" "}
              / {titleOf(d)}
              {type === "tv" && currentEp ? ` / ${currentEp.name}` : ""}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-tight sm:text-5xl">
              {titleOf(d)}
            </h1>
            {d.tagline && (
              <p className="mt-2 text-xs italic text-zinc-400">{d.tagline}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-zinc-300">
              <span className="flex items-center gap-1 text-accent">
                <Star size={14} className="fill-current" />
                {d.vote_average.toFixed(1)}
              </span>
              <span>{yearOf(d)}</span>
              {runtime ? (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {runtime >= 60
                    ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
                    : `${runtime}m`}
                </span>
              ) : null}
              {type === "tv" && seasons.length > 0 && (
                <span>{seasons.length} Seasons</span>
              )}
              {d.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-black"
                >
                  {g.name}
                </span>
              ))}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">
              {d.overview}
            </p>
            {director && (
              <p className="mt-3 text-xs text-zinc-400">
                <span className="font-bold text-zinc-200">Director:</span>{" "}
                {director.name}
              </p>
            )}
            <div className="mt-5">
              <ActionBar storageId={`${type}${d.id}`}
                item={{ type, id: d.id, title: titleOf(d), year: yearOf(d),
                  posterPath: d.poster_path }} />
              <WatchProviders type={type} id={d.id} />
            </div>
          </section>

          {/* Cast */}
          {d.credits && d.credits.cast.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 text-sm font-bold">Cast &amp; Crew</h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                {d.credits.cast.slice(0, 15).map((c) => (
                  <div key={c.id} className="w-32 shrink-0 sm:w-40">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-zinc-800">
                      {c.profile_path && (
                        <Image
                          src={img(c.profile_path, "w342")!}
                          alt={c.name}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs font-bold">{c.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {c.character}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      <div className="mt-10">
        <Row
          title={`More ${label} Like This`}
          path={`/${type}/${d.id}/recommendations`}
          type={type}
          variant={type === "tv" ? "wide" : "poster"}
        />
      </div>

      <div className="mx-auto mt-12 grid w-full max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_320px]">
        <Reviews storageId={`${type}${d.id}`} title={titleOf(d)} />
        <PopularList type={type} />
      </div>

      <div className="mt-16">
        <CtaBanner />
      </div>
      <Footer />
    </>
  );
}
