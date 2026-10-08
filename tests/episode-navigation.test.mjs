import assert from "node:assert/strict";
import test from "node:test";
import { getNextEpisode } from "../lib/episode-navigation.ts";

test("advances within a season", () => {
  assert.deepEqual(
    getNextEpisode(1, 3, [{ season_number: 1, episode_count: 8 }]),
    { season: 1, episode: 4 },
  );
});

test("advances across season boundaries and skips empty seasons", () => {
  assert.deepEqual(
    getNextEpisode(1, 8, [
      { season_number: 0, episode_count: 1 },
      { season_number: 3, episode_count: 2 },
      { season_number: 2, episode_count: 0 },
      { season_number: 1, episode_count: 8 },
    ]),
    { season: 3, episode: 1 },
  );
});

test("does not advance past the series finale", () => {
  assert.equal(
    getNextEpisode(2, 6, [
      { season_number: 1, episode_count: 10 },
      { season_number: 2, episode_count: 6 },
    ]),
    null,
  );
});

test("rejects invalid or unknown episodes/seasons", () => {
  const seasons = [{ season_number: 1, episode_count: 10 }];
  assert.equal(getNextEpisode(0, 1, seasons), null);
  assert.equal(getNextEpisode(1, 0, seasons), null);
  assert.equal(getNextEpisode(2, 1, seasons), null);
  assert.equal(getNextEpisode(Number.NaN, 1, seasons), null);
});

test("does not mutate TMDB season ordering", () => {
  const seasons = [
    { season_number: 2, episode_count: 5 },
    { season_number: 1, episode_count: 10 },
  ];
  assert.deepEqual(getNextEpisode(1, 10, seasons), { season: 2, episode: 1 });
  assert.deepEqual(seasons.map((season) => season.season_number), [2, 1]);
});
