import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMasterMediaResponse, mediaSelectionKey, parseMediaSelection,
} from "../lib/media-master.ts";

const movie = { type: "movie", id: "111814" };
const tv = { type: "tv", id: "456", season: 1, episode: 2 };

test("movie and TV selection validation", () => {
  assert.deepEqual(parseMediaSelection(new URLSearchParams("type=movie&id=111814")), movie);
  assert.deepEqual(parseMediaSelection(new URLSearchParams("type=tv&id=456&season=1&episode=2")), tv);
  assert.equal(mediaSelectionKey(tv), "tv:456:s1e2");
  for (const invalid of [
    "type=movie&id=0", "type=movie&id=abc", "type=tv&id=456&season=0&episode=1",
    "type=tv&id=456&episode=1", "type=movie&id=10&season=1",
    "type=movie&id=123456789012", "type=tv&id=456&season=1&episode=1000",
  ]) assert.equal(parseMediaSelection(new URLSearchParams(invalid)), null, invalid);
});

test("unconfigured master returns unavailable without guessing content paths", () => {
  const output = buildMasterMediaResponse(movie, [], undefined, undefined);
  assert.equal(output.status, "unavailable");
  assert.equal(output.defaultSourceId, null);
  assert.deepEqual(output.sources, []);
});

test("licensed HTTPS HLS and MP4 are accepted only from explicit hostnames", () => {
  const entries = [
    { label: "Primary", url: "https://cdn.example.org/movies/1/index.m3u8?sig=abc", kind: "hls" },
    { label: "Backup", url: "https://cdn.example.org/movies/1/master.mp4", kind: "mp4" },
    { label: "External", url: "https://other.example.org/x.mp4", kind: "mp4" },
  ];
  const r = buildMasterMediaResponse(movie, entries, "cdn.example.org", "");
  assert.equal(r.status, "ready");
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0].id, "source-1");
  assert.equal(r.sources[0].delivery, "direct");
  assert.equal(r.sources[0].playbackUrl, entries[0].url);
  assert.equal(r.sources[1].kind, "mp4");
});

test("HTTP stream requires both media and proxy allowlists", () => {
  const e = [{ label: "Origin", url: "http://vod.example.org:8081/master.m3u8", kind: "hls" }];
  assert.equal(buildMasterMediaResponse(tv, e, "vod.example.org", "").sources.length, 0);
  const yes = buildMasterMediaResponse(tv, e, "vod.example.org", "vod.example.org");
  assert.equal(yes.sources.length, 1);
  assert.equal(yes.sources[0].delivery, "proxy");
  assert.match(yes.sources[0].playbackUrl, /^\/api\/media-proxy\?url=/);
});

test("rejects internal addresses, file extensions, invalid URL, credentials and duplicate URLs", () => {
  const e = [
    { label: "Private", url: "http://127.0.0.1/movie.mp4", kind: "mp4" },
    { label: "Credential", url: "https://a:b@cdn.example.org/master.m3u8", kind: "hls" },
    { label: "Wrong", url: "https://cdn.example.org/route.php", kind: "hls" },
    { label: "Malformed", url: "not-a-url", kind: "mp4" },
    { label: "Good", url: "https://cdn.example.org/movie.mp4", kind: "mp4" },
    { label: "Duplicate", url: "https://cdn.example.org/movie.mp4", kind: "mp4" },
  ];
  const response = buildMasterMediaResponse(movie, e, "cdn.example.org,127.0.0.1", "127.0.0.1");
  assert.equal(response.sources.length, 1);
  assert.equal(response.sources[0].label, "Good");
});
