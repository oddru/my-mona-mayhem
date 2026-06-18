# Contributions Proxy

This document describes the server-side contributions proxy used by the workshop site.

Endpoint

- Path: /api/contributions/{username}
- Server route: src/pages/api/contributions/[username].ts
- Purpose: proxy GitHub's public contributions JSON endpoint to bypass CORS and apply caching.

Upstream (.contribs) summary

- Upstream URL: https://github.com/{username}.contribs
- Schema: upstream returns JSON (opaque to this project) containing contribution metadata and per-day contribution counts. Consumers should treat the payload as an opaque JSON object and not rely on a strict internal schema; typical fields include arrays of contributions keyed by date and summary totals.

Behavior & responses

- Validates username (alphanumeric and dashes, 1–39 chars). 400 returned for invalid usernames.
- Returns 404 if upstream returns 404 (user not found).
- Returns 429 if upstream rate-limits (passes Retry-After when available).
- Returns 502 for upstream errors or invalid JSON.

Caching

- Default in-memory cache with optional Redis adapter.
- Configurable via environment variables (see below).
- Cache semantics:
  - "hit": fresh cached value returned (X-Cache: hit). Response includes X-Cache-UpdatedAt (epoch ms).
  - "stale": stale cached value returned while a background refresh is attempted (X-Cache: stale). Background refresh is best-effort and failures are ignored.
  - "miss": no cache present; response returns upstream body and sets cache (X-Cache: miss). Responses include X-Upstream-Status with the upstream HTTP status.

Environment variables

- GITHUB_TOKEN (optional): If set, the proxy sends an Authorization header as `token {GITHUB_TOKEN}` to the upstream. This increases upstream rate limits.
- CACHE_TTL_SECONDS (optional): TTL for cache entries in seconds. Default: 300 (5 minutes).
- CACHE_MAX_ENTRIES (optional): Maximum in-memory entries before evicting oldest. Default: 1000.
- CACHE_ADAPTER (optional): "memory" (default) or "redis". When "redis" is selected the app attempts to use ioredis dynamically; if unavailable or Redis is unreachable it falls back to memory.

Debugging examples

- Basic curl (no token):

  curl -i "http://localhost:4321/api/contributions/octocat"

- Request with token in header:

  curl -i -H "Authorization: token $GITHUB_TOKEN" "http://localhost:4321/api/contributions/octocat"

- Interpret X-Cache header:
  - X-Cache: hit — fresh cached response served (fast).
  - X-Cache: stale — stale cached response returned; server has triggered a background refresh.
  - X-Cache: miss — upstream was fetched now and cache updated.

Notes

- The proxy returns upstream JSON verbatim when successful. Clients should handle the payload as an opaque JSON structure.
- The Redis adapter is optional and implemented to avoid a hard dependency; set CACHE_ADAPTER=redis and provide a reachable Redis server and ioredis if you want a distributed cache.

