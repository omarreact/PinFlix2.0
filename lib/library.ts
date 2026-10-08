/**
 * Browser-only library state. Items are metadata references, not media URLs.
 * Versioned keys allow a future authenticated backend to migrate user progress.
 */
export type MediaKind = "movie" | "tv";
export interface LibraryTitle {
  type: MediaKind;
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
}
export interface SavedTitle extends LibraryTitle {
  updatedAt: number;
}
export interface WatchProgress extends SavedTitle {
  season?: number;
  episode?: number;
  seconds: number;
  duration: number;
  completed: boolean;
}

const SAVED_KEY = "pinflix:watchlist:v1";
const HISTORY_KEY = "pinflix:progress:v1";
export const LIBRARY_EVENT = "pinflix:library-changed";

export function playbackKey(item: Pick<LibraryTitle, "type" | "id">,
  season?: number, episode?: number): string {
  return item.type === "tv"
    ? `tv:${item.id}:s${season ?? 1}e${episode ?? 1}`
    : `movie:${item.id}`;
}

function valid(item: Partial<LibraryTitle>): item is LibraryTitle {
  return (item.type === "movie" || item.type === "tv") &&
    Number.isSafeInteger(item.id) && Number(item.id) > 0 &&
    typeof item.title === "string" && item.title.length <= 300 &&
    typeof item.year === "string" &&
    (item.posterPath === null || typeof item.posterPath === "string");
}

function read<T extends LibraryTitle>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter(valid).slice(0, 200) as T[] : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data.slice(0, 200)));
    window.dispatchEvent(new Event(LIBRARY_EVENT));
  } catch { /* Private browsing or storage quota exceeded. */ }
}

export function listWatchlist(): SavedTitle[] {
  return read<SavedTitle>(SAVED_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isSaved(item: Pick<LibraryTitle, "type" | "id">): boolean {
  return listWatchlist().some((v) => v.type === item.type && v.id === item.id);
}

export function setWatchlist(item: LibraryTitle, enabled: boolean) {
  const list = listWatchlist().filter((v) => v.type !== item.type || v.id !== item.id);
  if (enabled) list.unshift({ ...item, updatedAt: Date.now() });
  write(SAVED_KEY, list);
}

export function listHistory(): WatchProgress[] {
  return read<WatchProgress>(HISTORY_KEY)
    .filter((v) => Number.isFinite(v.seconds) && Number.isFinite(v.duration) &&
      v.seconds >= 0 && v.duration > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProgress(item: Pick<LibraryTitle, "type" | "id">,
  season?: number, episode?: number): WatchProgress | undefined {
  const key = playbackKey(item, season, episode);
  return listHistory().find((v) => playbackKey(v, v.season, v.episode) === key);
}

export function saveProgress(item: LibraryTitle, seconds: number, duration: number,
  season?: number, episode?: number, completed = false) {
  if (!valid(item) || !Number.isFinite(seconds) || !Number.isFinite(duration) ||
      duration <= 0) return;
  const key = playbackKey(item, season, episode);
  const previous = listHistory().filter((v) =>
    playbackKey(v, v.season, v.episode) !== key);
  const entry: WatchProgress = {
    ...item,
    season: item.type === "tv" ? season : undefined,
    episode: item.type === "tv" ? episode : undefined,
    seconds: Math.min(Math.max(seconds, 0), duration),
    duration, completed, updatedAt: Date.now(),
  };
  write(HISTORY_KEY, [entry, ...previous]);
}

export function removeHistory(item: WatchProgress) {
  const key = playbackKey(item, item.season, item.episode);
  write(HISTORY_KEY, listHistory().filter((v) =>
    playbackKey(v, v.season, v.episode) !== key));
}
