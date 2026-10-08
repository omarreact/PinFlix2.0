/**
 * Determine the next available TV episode using TMDB season summaries.
 * Season 0 (specials) and seasons with no listed episodes are skipped.
 * This only navigates to the next episode; it never claims video playback
 * or automatically starts third-party embeds.
 */
export interface SeasonSummary {
  season_number: number;
  episode_count: number;
}

export interface EpisodeSelection {
  season: number;
  episode: number;
}

export function getNextEpisode(
  currentSeason: number,
  currentEpisode: number,
  seasons: readonly SeasonSummary[],
): EpisodeSelection | null {
  if (
    !Number.isSafeInteger(currentSeason) ||
    currentSeason < 1 ||
    !Number.isSafeInteger(currentEpisode) ||
    currentEpisode < 1
  ) {
    return null;
  }

  const available = seasons
    .filter(
      (entry) =>
        Number.isSafeInteger(entry.season_number) &&
        entry.season_number > 0 &&
        Number.isSafeInteger(entry.episode_count) &&
        entry.episode_count > 0,
    )
    .sort((a, b) => a.season_number - b.season_number);

  const current = available.find(
    (entry) => entry.season_number === currentSeason,
  );

  if (!current) return null;

  if (currentEpisode < current.episode_count) {
    return { season: currentSeason, episode: currentEpisode + 1 };
  }

  const following = available.find(
    (entry) => entry.season_number > currentSeason,
  );

  return following ? { season: following.season_number, episode: 1 } : null;
}
