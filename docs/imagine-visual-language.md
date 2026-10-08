# PinFlix visual language

The Imagine visual-creation principles supplied for this task are adapted to PinFlix movie and TV discovery. This does not install Claude's widget runtime, a generative AI model, or a new media provider.

## Design conventions

- Restrained mint accent and flat cinematic dark surfaces.
- Semantic CSS tokens in `app/globals.css`.
- Unified borders and rounded cards with readable metadata.
- Clear keyboard focus, accessible form labels, menu disclosure states, and carousel arrow-key navigation.
- Responsive browse page supports poster and landscape layouts with visible selected states and clearable filters.
- Reduced-motion behavior and catalog rows visible without intersection-observer timing.
- No decorative glow, gradient backgrounds, or placeholder help links in refreshed components.

## Functional boundaries

- Keep the featured trailer video ID unchanged.
- Do not modify TMDB APIs, playback source resolution, native HLS/MP4 player, media proxy, episode navigation, watchlist, or resume storage.
- No third-party embed player or ad host is added.

## Regression review

Check homepage/hero, movie and TV browsing, search, filters, layout toggle, pagination, details pages, episodes, library, source selection, full-length authorized playback, seek, trailer, and theater mode across mobile/desktop and reduced-motion settings.
