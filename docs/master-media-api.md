# PinFlix Master Media API v1

**Route:** `GET /api/media/master`

This feature separates title metadata from delivery of media that the operator is
authorized to stream. CineplexBD research informed the distinction between movie
catalog pages, nested HLS paths, direct MP4 assets and time-limited URLs; **none of
the CineplexBD URLs are copied, guessed or treated as an authorized CDN**.

## API requests

```http
GET /api/media/master?type=movie&id=123
GET /api/media/master?type=tv&id=456&season=1&episode=2
```

The server validates the title type, positive numeric TMDB ID, and TV season and
episode numbers (1 to 999). A missing source is a normal 200 response:

```json
{
  "schema": "pinflix.media.v1",
  "key": "movie:123",
  "selection": { "type": "movie", "id": "123" },
  "status": "unavailable",
  "defaultSourceId": null,
  "sources": []
}
```

With a real operator-configured source and an explicit host allowlist:

```json
{
  "schema": "pinflix.media.v1",
  "key": "tv:456:s1e2",
  "selection": { "type": "tv", "id": "456", "season": 1, "episode": 2 },
  "status": "ready",
  "defaultSourceId": "source-1",
  "sources": [{
    "id": "source-1",
    "label": "My licensed origin",
    "kind": "hls",
    "url": "https://media.example.org/series/s1e2/master.m3u8",
    "delivery": "direct",
    "playbackUrl": "https://media.example.org/series/s1e2/master.m3u8"
  }]
}
```

The `playbackUrl` of a permitted HTTP origin is a same-origin
`/api/media-proxy?url=...` URL; HTTPS media remains direct. No HTTP origins
work unless both the source and proxy allowlists include the hostname.

## Catalog setup

1. Acquire media distribution rights and store licensed MP4 or packaged HLS
   content on an origin or CDN you control, e.g. an HTTPS bucket/CDN backed by
   Cloudflare R2.
2. Add explicit source URLs to `data/own-sources.json` keyed by `movie:123`
   or `tv:456:s1e2`. Alternatively configure the remote owner-run resolver
   with `MEDIA_CATALOG_URL`.
3. Configure `MEDIA_SOURCE_ALLOWED_HOSTS` with exact media hostnames, even for
   locally registered sources. Do not put URL schemes or ports in this value.
4. For **licensed HTTP-only** origins, configure
   `MEDIA_PROXY_ALLOWED_HOSTS` with exact allowed hostnames, and acknowledge
   the proxy costs/bandwidth and limited scalability.
5. Ensure the media server returns correct MIME types, HLS playlist/segment
   links, CORS headers and byte-range support. Test Android and iOS browsers.

A remote catalog must return a JSON object with a `sources` array:

```json
{
  "sources": [
    { "label": "CDN edge A", "url": "https://media.example.org/movie/123/master.m3u8" },
    { "label": "CDN edge B", "url": "https://backup.example.org/movie/123.mp4" }
  ]
}
```

The existing server-only resolver calls `MEDIA_CATALOG_URL` with `key`,
`type`, `tmdbId`, and optional `season`/`episode`, and authenticates via
`MEDIA_CATALOG_TOKEN` when configured. The bearer token never appears in
the master API response. If the catalog returns signed URLs, provide fresh,
authorized URLs rather than inventing an `md5` or `expires` signature.

## Required server-side environment variables

| Name | Meaning |
| --- | --- |
| `MEDIA_CATALOG_URL` | Optional HTTPS endpoint owned by the operator |
| `MEDIA_CATALOG_TOKEN` | Optional bearer token for remote catalog |
| `MEDIA_SOURCE_ALLOWED_HOSTS` | Required comma-separated exact media hostnames |
| `MEDIA_PROXY_ALLOWED_HOSTS` | Optional comma-separated exact HTTP proxy origins |
| `ENABLE_ARCHIVE_SOURCES` | Keep `false` unless individual media rights have been cleared |

No media assets or CDN storage are provisioned by this API alone. A new
Cloudflare R2 bucket or Worker needs an explicit storage setup, valid origin
credentials, and licensed content files.

## Security and operational notes

- The master API only reads owner-configured catalogs; it never crawls
  `cineplexbd.net` or extrapolates category/filename patterns.
- Unapproved media hosts and local/private hosts are rejected by the master
  response. The proxy also checks its own allowlist, including redirects.
- Responses are marked `private, no-store` to limit caching of signed URLs.
- API consumers should treat `status: unavailable` as no licensed stream.
- Uploading demo videos under unrelated TMDB movie IDs misrepresents titles;
  the old hardcoded entries were deliberately removed.
- Full CDN deployment requires an authorized asset library and origin hosting.
- The existing `/api/sources` route remains for backward compatibility;
  the video player now prefers `/api/media/master`.
- For robust production SSRF protection, additionally enforce network egress
  controls at the infrastructure layer, not only hostname checks.

## Smoke tests

```bash
curl -i 'https://<your-project-host>/api/media/master?type=movie&id=123'
curl -i 'https://<your-project-host>/api/media/master?type=tv&id=456&season=1&episode=2'
curl -i 'https://<your-project-host>/api/media/master?type=tv&id=456&season=0&episode=2'
```

The last request must return HTTP 400. The first two return either an available
configured source or a clear unavailable result—never guessed titles or videos.
