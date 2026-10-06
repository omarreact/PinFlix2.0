export type MediaType = "movie" | "tv";

export interface Title {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids?: number[];
}

const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics",
};
export const GENRE_OPTIONS = Object.entries(GENRES).map(([id, name]) => ({
  id,
  name,
}));
export const genresOf = (t: Title, n = 3) =>
  (t.genre_ids ?? [])
    .map((g) => GENRES[g])
    .filter(Boolean)
    .slice(0, n)
    .join(", ");


export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface Details extends Title {
  runtime?: number;
  episode_run_time?: number[];
  genres: { id: number; name: string }[];
  tagline?: string;
  seasons?: { season_number: number; name: string; episode_count: number }[];
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew?: { id: number; name: string; job: string }[];
  };
  videos?: { results: Video[] };
}

export interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
}

export const img = (path: string | null, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const titleOf = (t: Title) => t.title ?? t.name ?? "Untitled";
export const yearOf = (t: Title) =>
  (t.release_date ?? t.first_air_date ?? "").slice(0, 4);

/** Talks to our own server route, which holds the TMDB key. */
export async function tmdb<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL("/api/tmdb", window.location.origin);
  url.searchParams.set("path", path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}
