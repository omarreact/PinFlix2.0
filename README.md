# PinFlix 2.0

A responsive movie/TV discovery interface built with Next.js 16 (App Router), React 19,
TMDB metadata, and an authorized HLS/MP4 player. Playback is separate from metadata:
**TMDB IDs and trailers do not grant access to movies or episodes.**

## Features

- Dynamic TMDB trending, search, details, cast, seasons, episodes and recommendations.
- Region-aware **Where to watch legally** availability sourced from TMDB/JustWatch.
- HLS.js and native MP4 playback for configured authorized media sources.
- Automatic switch to the next configured source when a media source fails.
- Watch position, recent episodes and watchlist stored privately in browser localStorage.
- Shareable TV links: `/title/tv/123?play=1&season=2&episode=5`.
- `/my-list` watchlist and continue-watching history.
- YouTube previews clearly labeled as **trailers**, not full movies.

## Development

Node.js 22 or later is recommended.

```bash
npm ci
cp .env.example .env.local
npm run dev
npm run lint
npm test
npm run build
```

Set `TMDB_API_KEY` on the Vercel project (server-only, **not** NEXT_PUBLIC).
Only add media from an origin you own or have a license to distribute.

## Ad-free native playback

PinFlix's Watch Now area uses a browser-native video element for owner-provided MP4
and HLS streams. It does not automatically play third-party iframe embeds or
claim to remove ads from someone else's video service. Multiple permitted
sources can be selected manually, and the player tries another listed source
when one fails.

**Default limitation:** The included `data/own-sources.json` contains only a
placeholder, and the deployed project needs `MEDIA_CATALOG_URL` and a
permitted source-host allowlist to discover full-length content dynamically.
Without a real licensed media catalog, movies and episodes show a clear
unavailable message with an official trailer option rather than pretending
that TMDB metadata provides video.

`HTTPS` HLS streams must allow browser CORS access (including segments and keys).
`HTTP` is routed through `/api/media-proxy` and requires explicit
`MEDIA_PROXY_ALLOWED_HOSTS`; that path uses Vercel transfer bandwidth.
The player does not insert third-party iframe ads, although the media origin
is responsible for any ads baked into the stream itself.

## Configuring full-length playback

PinFlix has two authorized media source registries:

### 1. Built-in registry

Edit `data/own-sources.json`, using TMDB numeric IDs:

```json
{
  "movie:123": [
    { "label": "My licensed CDN", "url": "https://media.example.org/movie/master.m3u8" }
  ],
  "tv:456:s1e2": [
    { "label": "Episode 2", "url": "https://media.example.org/series/s01e02.mp4" }
  ]
}
```

To avoid hard-coding source URLs in Git, prefer an owner-controlled API.

### 2. Dynamic licensed catalog API

Set these **server-side** Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `TMDB_API_KEY` | TMDB v3 key or v4 read access token |
| `MEDIA_CATALOG_URL` | HTTPS URL to your licensed media catalog resolver |
| `MEDIA_CATALOG_TOKEN` | Optional Bearer token for this resolver |
| `MEDIA_SOURCE_ALLOWED_HOSTS` | Comma-separated **exact hostnames** permitted for dynamic media (required when using the remote resolver) |
| `MEDIA_PROXY_ALLOWED_HOSTS` | Exact allowlist for the HTTP/HLS proxy origin and child CDN hosts |
| `ENABLE_ARCHIVE_SOURCES` | Disabled by default; only set `true` after individually verifying content rights |

The server calls `MEDIA_CATALOG_URL` with `key`, `type`, `tmdbId`
and, for series, `season` and `episode` query parameters. Example:

```http
GET /resolve?key=tv%3A456%3As1e2&type=tv&tmdbId=456&season=1&episode=2
Authorization: Bearer <configured-server-token>
```

The catalog must return:

```json
{
  "sources": [
    { "label": "Licensed CDN", "url": "https://media.example.org/series/episode.m3u8" }
  ]
}
```

Only `.mp4` and `.m3u8` resources are accepted, with http(s) URLs and
matching allowed hostnames. The remote API and bearer token are never exposed
to browsers. Browser clients receive the resulting playable media URL.

Direct HTTPS playback requires media origin **CORS**, byte-range requests and
correct MIME types. HTTP media, when authorized, uses `/api/media-proxy` and
its separate `MEDIA_PROXY_ALLOWED_HOSTS` allowlist. The proxy does not turn a
restricted or unlicensed source into a licensed one, nor does it guarantee CDN
reachability or Vercel function throughput.

### Why not copy arbitrary iframe providers?

Unknown external embeds can introduce misleading titles, popups, malicious
scripts, unstable content and licensing problems. PinFlix uses its own player
for sources explicitly configured by the operator. The separate official
watch-provider listings direct users to legitimate third-party services.

## Safety and deployment

- Media secrets and TMDB credentials live server-side.
- The source endpoint validates media type, IDs, episodes and hostnames.
- Optional Archive searches are off by default; Archive upload metadata alone
  does not establish copyright or public-domain status.
- A source URL appearing in TMDB metadata does **not** indicate playback permission.
- Browser watchlists and progress are local-only; clearing site data clears them.
- GitHub `main` is connected to the operator's Vercel project; verify preview
  deployment and runtime configuration before merging.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
Provider availability data originates from TMDB/JustWatch and may differ by
country and subscription.
