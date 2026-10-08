import test from "node:test";
import assert from "node:assert/strict";
import {
  playbackKey, setWatchlist, listWatchlist, isSaved, saveProgress,
  getProgress, listHistory, removeHistory,
} from "../lib/library.ts";

const state = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => state.set(key, value),
  },
  dispatchEvent: () => {},
};
globalThis.Event = class Event {
  constructor(type) { this.type = type; }
};

const movie = { type: "movie", id: 123, title: "Example",
  year: "2026", posterPath: null };
const show = { type: "tv", id: 9, title: "Show",
  year: "2026", posterPath: "/poster.jpg" };

test("progress keys distinguish episodes", () => {
  assert.equal(playbackKey(movie), "movie:123");
  assert.equal(playbackKey(show, 1, 2), "tv:9:s1e2");
  assert.notEqual(playbackKey(show, 1, 2), playbackKey(show, 1, 3));
});

test("watchlist can save and remove items", () => {
  setWatchlist(movie, true);
  assert.equal(isSaved(movie), true);
  assert.equal(listWatchlist().length, 1);
  setWatchlist(movie, false);
  assert.equal(isSaved(movie), false);
});

test("progress is saved per episode and supports deletion", () => {
  saveProgress(show, 37, 120, 1, 2);
  saveProgress(show, 7, 80, 1, 3);
  assert.equal(getProgress(show, 1, 2)?.seconds, 37);
  assert.equal(getProgress(show, 1, 3)?.seconds, 7);
  const first = getProgress(show, 1, 2);
  assert.ok(first);
  removeHistory(first);
  assert.equal(getProgress(show, 1, 2), undefined);
  assert.equal(listHistory().length, 1);
});

test("completed titles stay in history", () => {
  saveProgress(movie, 100, 100, undefined, undefined, true);
  assert.equal(getProgress(movie)?.completed, true);
});

test("invalid duration is ignored", () => {
  const before = listHistory().length;
  saveProgress(movie, 3, 0);
  assert.equal(listHistory().length, before);
});
