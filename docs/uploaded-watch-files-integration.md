# Uploaded watch-file integration (8 October 2026)

This is a **presentation-only** adaptation of the four supplied files,
not a replacement of PinFlix 2.0's existing movie and TV playback flow.

| Uploaded file | Decision | Existing behavior preserved |
| --- | --- | --- |
| `next.config.ts` | Apply TMDB `/t/p/**` image pattern and explicit strict TypeScript builds. | Existing TMDB poster and backdrop requests. |
| `page(1).tsx` | Adapt the `Watch Now` panel into `components/TitleView.tsx`. | TMDB fetching, `/title/[type]/[id]`, episodes, list actions, recommendations and navigation. |
| `watch-player.tsx` | Adapt loading spinner, on-hover title/format presentation, and stream count/labels into `components/VideoPlayer.tsx`. | Configured source selection, HLS.js and MP4, failover, resume, trailer fallback and retry. |
| `route(1).ts` | **Not installed.** It replaces source lookup with an unverified third-party endpoint and spoofed headers. | Existing licensed-source API and server-side host allowlists. |

The sample page includes mocked titles, nonfunctional Play/List buttons,
and unsupported offline/4K promises. PinFlix already provides actual
TMDB details and working app-specific controls, so those mock behaviors
were not imported.

The sample player advertises DASH playback with an ordinary HTML5 `<video>`
element, which is not a portable DASH implementation. No DASH support or
unknown iframe providers were added.

All existing routes, component public props, API response contracts,
player callbacks and browser storage keys remain unchanged.

## Verification

- `npm ci`
- `npm test`
- `npm run lint`
- `npm run build`

Review the GitHub Actions checks and Vercel preview before merging.
