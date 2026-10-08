# PinFlix 2.0 — Cloudflare Media Edge

The PinFlix frontend remains on Vercel. A standalone Cloudflare Worker
(\`pinflix-media-api\`) reads only explicit objects from a **private** R2 bucket
(\`pinflix-media\`), and no existing LandBD resources are modified.

## Inventory layout

Upload only assets you own or have distribution rights to:

\`\`\`text
pinflix-media/
  catalog/
    movie:123.json
    tv:456:s1e2.json
  media/
    movie/123.mp4
    tv/456/s1e2/master.m3u8
    tv/456/s1e2/segment-001.ts
    tv/456/s1e2/segment-002.ts
\`\`\`

The catalog is private in R2. A sample catalog JSON object:

\`\`\`json
{
  "sources": [
    { "label": "PinFlix HD", "path": "media/movie/123.mp4" }
  ]
}
\`\`\`

Only real, listed MP4/HLS files are returned; the Worker verifies their R2
existence. It never fabricates CineplexBD URLs, scrapes upstream CDNs, or
copies remote content.

## Endpoints

- \`GET /health\` — lightweight readiness JSON
- \`GET /resolve?key=movie%3A123\` — server-side Bearer authenticated catalog API
- \`GET /m/media/movie/123.mp4?exp=...&sig=...\` — time-limited signed playback
- \`GET /m/media/tv/456/s1e2/master.m3u8?exp=...&sig=...\` — signed HLS playlist

The Worker verifies an HMAC-SHA256 signature before reading any media file,
rewrites local HLS rendition/segment/KEY URLs with signatures, supports MP4
Range responses, and returns CORS to explicitly allowed PinFlix origins.

## Secrets

Store \`CATALOG_TOKEN\` and \`SIGNING_KEY\` as **Cloudflare Worker secrets**,
not in GitHub. Store the **same** catalog token as Vercel's encrypted
\`MEDIA_CATALOG_TOKEN\`. Never publish either value.

PinFlix's existing server-side media resolver uses:

\`\`\`text
MEDIA_CATALOG_URL=https://media.pincodeit.com/resolve
MEDIA_CATALOG_TOKEN=<same token as the Worker>
MEDIA_SOURCE_ALLOWED_HOSTS=media.pincodeit.com
\`\`\`

Cloudflare Worker variables:

\`\`\`text
CORS_ORIGINS=https://pin-flix2-0.vercel.app
MEDIA=R2 binding to pinflix-media
CATALOG_TOKEN=<secret>
SIGNING_KEY=<secret>
\`\`\`

For direct HTTPS URLs, \`MEDIA_PROXY_ALLOWED_HOSTS\` is not needed. No secret
is exposed to the user's browser by the resolver itself. Signed playback URLs
are available to the browser for a limited lifetime.

## Deployment

The Worker is deployed from \`cloudflare/pinflix-media-worker.mjs\`.
\`wrangler.pinflix.jsonc\` contains the reproducible configuration; secrets
must be provisioned out-of-band by an administrator.

The R2 bucket should remain private; do not enable \`r2.dev\` public access or
attach a public R2 domain. All authorized delivery goes via the Worker.

The Worker only serves pre-packaged HLS files; it does not transcode MP4 to
HLS. For uploads requiring transcoding, consider Cloudflare Stream separately
after confirming permissions and pricing.

## Security notes

HMAC signed URLs are not DRM: an authorized viewer may still copy an asset.
Apply business-layer authorization before issuing signed links if your media
license requires access controls. Rotate signing keys with care, since rotation
invalidates previously issued URLs.

Never use a Vercel serverless proxy to continuously transfer large video files
where direct signed Cloudflare URLs suffice; doing so increases Vercel bandwidth.
