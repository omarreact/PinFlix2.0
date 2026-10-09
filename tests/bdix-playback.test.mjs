import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlaybackSource, toWebVtt } from '../lib/playback.ts';
import { cleanMediaName, parseDirectory } from '../lib/ingest-directory.ts';
import { GET, HEAD } from '../lib/media-proxy.ts';

test('resolver delivery URL survives normalization', () => {
  const url = 'http://media.example/movie.mp4';
  const playbackUrl = '/api/media-proxy?url=' + encodeURIComponent(url);
  assert.equal(normalizePlaybackSource({ label: 'BDIX', url, playbackUrl, kind: 'mp4' }).url, playbackUrl);
  assert.equal(normalizePlaybackSource({ label: 'Bad', url: '//evil.example/video.mp4', kind: 'mp4' }), null);
  assert.equal(normalizePlaybackSource({ label: 'Bad', url: 'https://media.example/a.mp4', kind: 'hls' }), null);
});
test('crawler stays inside origin and parses episode filenames', () => {
  const entries = parseDirectory('<a href="../">Parent Directory</a><a href="https://evil.example/x.mp4">x</a><a href="Show.S02E03.2024.1080p.mp4">movie</a><a href="Show.en.srt">sub</a>', 'http://cds3.cineplexbd.net/index.php', 'http://cds3.cineplexbd.net/index.php');
  assert.equal(entries.length, 2);
  assert.deepEqual(cleanMediaName('Show.S02E03.2024.1080p.mp4'), { title: 'Show', year: 2024, season: 2, episode: 3 });
});
test('SRT becomes WebVTT and existing VTT is preserved', () => {
  assert.match(toWebVtt('1\r\n00:00:01,000 --> 00:00:02,500\r\nHello'), /^WEBVTT\n\n1\n00:00:01\.000 --> 00:00:02\.500/);
  assert.equal(toWebVtt('WEBVTT\n\n'), 'WEBVTT\n\n');
});
test('proxy keeps byte range, HEAD and unsatisfiable range behavior', async () => {
  const originalFetch = globalThis.fetch, originalHosts = process.env.MEDIA_PROXY_ALLOWED_HOSTS;
  process.env.MEDIA_PROXY_ALLOWED_HOSTS = 'media.example';
  try {
    let received;
    globalThis.fetch = async (_, init) => { received = init; return new Response('abc', { status: 206, headers: { 'content-range': 'bytes 0-2/10', 'content-length': '3', 'accept-ranges': 'bytes' } }); };
    const address = 'http://localhost/api/media-proxy?url=' + encodeURIComponent('http://media.example/a.mp4');
    const response = await GET(new Request(address, { headers: { range: 'bytes=0-2', 'if-range': 'tag' } }));
    assert.equal(received.headers.get('range'), 'bytes=0-2');
    assert.equal(received.headers.get('if-range'), 'tag');
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-length'), '3');
    assert.equal(await response.text(), 'abc');
    globalThis.fetch = async (_, init) => { received = init; return new Response(null, { headers: { 'content-length': '10' } }); };
    const head = await HEAD(new Request(address)); assert.equal(received.method, 'HEAD'); assert.equal(head.body, null); assert.equal(head.headers.get('content-length'), '10');
    globalThis.fetch = async () => new Response(null, { status: 416, headers: { 'content-range': 'bytes */10' } });
    const invalid = await GET(new Request(address)); assert.equal(invalid.status, 416); assert.equal(invalid.headers.get('content-range'), 'bytes */10');
  } finally { globalThis.fetch = originalFetch; if (originalHosts === undefined) delete process.env.MEDIA_PROXY_ALLOWED_HOSTS; else process.env.MEDIA_PROXY_ALLOWED_HOSTS = originalHosts; }
});
test('proxy rewrites HLS segments and rejects redirects outside allowlist', async () => {
  const originalFetch = globalThis.fetch, originalHosts = process.env.MEDIA_PROXY_ALLOWED_HOSTS;
  process.env.MEDIA_PROXY_ALLOWED_HOSTS = 'media.example';
  try {
    const address = 'http://localhost/api/media-proxy?url=' + encodeURIComponent('http://media.example/path/master.m3u8');
    globalThis.fetch = async () => new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n\nsegment.ts\n');
    const response = await GET(new Request(address)); const body = await response.text();
    assert.ok(body.includes(encodeURIComponent('http://media.example/path/key.bin')));
    assert.ok(body.includes(encodeURIComponent('http://media.example/path/segment.ts')));
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }); };
    assert.equal((await GET(new Request(address))).status, 502); assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; if (originalHosts === undefined) delete process.env.MEDIA_PROXY_ALLOWED_HOSTS; else process.env.MEDIA_PROXY_ALLOWED_HOSTS = originalHosts; }
});

test('subtitle delivery requires explicit media and proxy hosts', async () => {
  const { buildMasterMediaResponse } = await import('../lib/media-master.ts');
  const entry = { label: 'Movie', url: 'https://media.example/a.mp4', kind: 'mp4', subtitles: [
    { label: 'English', language: 'en', url: 'http://media.example/a.srt' },
    { label: 'Foreign', language: 'en', url: 'https://evil.example/a.vtt' },
  ] };
  const ready = buildMasterMediaResponse({ type: 'movie', id: '123' }, [entry], 'media.example', 'media.example');
  assert.equal(ready.sources[0].subtitles.length, 1);
  assert.ok(ready.sources[0].subtitles[0].url.startsWith('/api/media-proxy?url='));
  const directOnly = buildMasterMediaResponse({ type: 'movie', id: '123' }, [entry], 'media.example', '');
  assert.equal(directOnly.sources[0].subtitles, undefined);
});
