import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { cleanMediaName, parseDirectory } from '../lib/ingest-directory.ts';

const root = new URL(process.env.BDIX_ROOT_URL || 'http://cds3.cineplexbd.net/index.php');
if (!['http:', 'https:'].includes(root.protocol) || root.hostname !== 'cds3.cineplexbd.net' || root.username || root.password || root.port) throw new Error('BDIX_ROOT_URL must use the configured Cineplex host');
const token = process.env.TMDB_READ_ACCESS_TOKEN;
const apiKey = process.env.TMDB_API_KEY;
if (!token && !apiKey) throw new Error('Configure TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY before importing');
const file = path.resolve(process.env.MEDIA_REGISTRY_PATH || 'data/bdix-sources.json');
let registry = {};
try { registry = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!registry || Array.isArray(registry) || typeof registry !== 'object') throw new Error('Existing registry must be an object');
const blocked = new Set((process.env.MEDIA_DELISTED_KEYS || '').split(',').map(s => s.trim()));
const queue = [root.href], visited = new Set(), videos = [], subtitles = [];
const maxPages = Math.min(2000, Math.max(1, Number(process.env.BDIX_MAX_PAGES) || 200));
while (queue.length && visited.size < maxPages) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (!response.ok) { await response.body?.cancel(); continue; }
    const entries = parseDirectory(await response.text(), url, root.href);
    for (const entry of entries) {
      if (entry.kind === 'directory' && !visited.has(entry.url)) queue.push(entry.url);
      else if (entry.kind === 'video') videos.push(entry);
      else if (entry.kind === 'subtitle') subtitles.push(entry);
    }
  } catch { /* Unreachable directories never remove the existing catalog. */ }
}
if (!videos.length) throw new Error('No playable files found; existing registry was preserved. Run on a host with BDIX access.');
const canonical = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
let matched = 0;
for (const video of new Map(videos.map(v => [v.url, v])).values()) {
  const metadata = cleanMediaName(video.filename);
  const type = metadata.episode !== undefined ? 'tv' : 'movie';
  const search = new URL(`https://api.themoviedb.org/3/search/${type}`);
  search.searchParams.set('query', metadata.title);
  if (apiKey) search.searchParams.set('api_key', apiKey);
  if (metadata.year) search.searchParams.set(type === 'tv' ? 'first_air_date_year' : 'year', String(metadata.year));
  const response = await fetch(search, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`TMDB returned ${response.status}; catalog file was not changed`);
  const results = (await response.json()).results || [];
  const hits = results.filter(item => [item.title, item.original_title, item.name, item.original_name].filter(Boolean).some(title => canonical(title) === canonical(metadata.title)) && (!metadata.year || (item.release_date || item.first_air_date || '').startsWith(String(metadata.year))));
  if (hits.length !== 1 || !Number.isSafeInteger(hits[0].id)) continue;
  const key = `${type}:${hits[0].id}${type === 'tv' ? `:s${metadata.season}e${metadata.episode}` : ''}`;
  if (blocked.has(key)) continue;
  const stem = video.url.replace(/\.(mp4|webm|m3u8)(\?.*)?$/i, '');
  const tracks = subtitles.filter(track => track.url.replace(/\.(srt|vtt)$/i, '').replace(/\.(en|bn)$/i, '') === stem).map(track => ({ label: /\.bn\./i.test(track.url) ? 'Bengali' : 'English', language: /\.bn\./i.test(track.url) ? 'bn' : 'en', url: track.url }));
  const source = { label: 'BDIX · ' + video.filename, url: video.url, kind: /\.m3u8$/i.test(new URL(video.url).pathname) ? 'hls' : 'mp4', ...(tracks.length ? { subtitles: tracks } : {}) };
  const existing = Array.isArray(registry[key]) ? registry[key] : [];
  registry[key] = [...existing.filter(entry => entry.url !== source.url), source];
  matched++;
}
await mkdir(path.dirname(file), { recursive: true });
const temporary = `${file}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(registry, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
await rename(temporary, file);
console.log(JSON.stringify({ pages: visited.size, files: videos.length, matched, truncated: queue.length > 0 }));
