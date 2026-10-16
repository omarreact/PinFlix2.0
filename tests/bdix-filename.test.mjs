import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBdixFilename } from "../lib/bdix-filename.ts";

test("extracts movie title and year without release tags", () => {
  const d = normalizeBdixFilename("The.Matrix.1999.1080p.BluRay.x264.YIFY.mkv");
  assert.equal(d.title, "The Matrix");
  assert.equal(d.year, 1999);
  assert.equal(d.extension, "mkv");
  assert.equal(d.episode, null);
});
test("extracts season and episode from series filename", () => {
  const d = normalizeBdixFilename("/TV/Example.Show.S02E07.720p.WEB-DL.mp4");
  assert.equal(d.season, 2);
  assert.equal(d.episode, 7);
  assert.equal(d.title, "Example Show");
});
test("supports alternate episodes and keeps original source string", () => {
  const raw = "Series.Name.1x04.2025.webm";
  const d = normalizeBdixFilename(raw);
  assert.equal(d.season, 1);
  assert.equal(d.episode, 4);
  assert.equal(d.original, raw);
  assert.equal(d.year, 2025);
});
