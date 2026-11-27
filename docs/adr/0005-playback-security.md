# ADR 0005: Playback security

- Status: accepted
- Date: 2026-11-27

## Context

StreamFlow's HLS bucket was public: anyone with a URL could watch any video. We
need private storage, playback authorised per viewer (employee or verified link
recipient), short-lived URLs, and per-viewer playlists (ADR 0001 leak tracing
assigns segments per viewer). It must work with S3-compatible storage in dev (SeaweedFS, since MinIO no longer
publishes images) and S3/CloudFront later.

## Options

1. media-service serves playlists and rewrites segment URLs as short-lived presigned URLs.
2. CDN signed cookies (CloudFront) scoped to a video path.
3. A token-checked segment proxy that streams every byte through media-service.

## Decision

Option 1 now, Option 2 later behind the same endpoint.

- `POST /api/media/videos/:id/playback` (employee) or the share-link equivalent (recipient) checks access and returns a master playlist URL with a 5-minute playback token bound to that video and viewer. A query-string token works with Safari's native HLS, which cannot add headers.
- media-service serves master and variant playlists, rewriting each segment line to a presigned GET URL. Segment URL lifetime is about the video duration plus a margin, capped; on a 403 the player reloads the playlist.
- Per-viewer playlists are where leak-tracing segment selection happens (F7b).
- Buckets are private; no object is ever public. Presigning is a local HMAC, so signing hundreds of segments per playlist is cheap.

## Consequences

- Option 3 rejected: all video bytes through Node is a bandwidth and cost bottleneck.
- Moving to CloudFront signed cookies later changes only the URL-signing implementation.
- The presign endpoint must be browser-reachable in dev (separate internal vs public storage endpoint, as StreamFlow did).
- DRM is out of scope; stated in the threat model.
- Implemented in F7; tests must show another tenant and an anonymous user cannot fetch playlists or segments.
