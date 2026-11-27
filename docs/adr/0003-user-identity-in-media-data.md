# ADR 0003: User identity in media data

- Status: accepted
- Date: 2026-11-27

## Context

Users live in the auth service (integer ids scoped by company). StreamFlow's
media tables referenced Keycloak UUIDs and upserted a local `User` row on every
request. Media rows must reference `(company_id, user_id)` from auth. External
share-link recipients (ADR 0001) are not auth users at all.

## Options

1. Local user projection in media-postgres, synced from `user.created` / `user.updated` events.
2. Store ids only; take display data from the token.
3. Call auth synchronously whenever user data is needed.

## Decision

Option 2. Media rows store `company_id` and `uploader_id` (integers, no foreign
key across services) plus an `uploader_display` snapshot (name or email) copied
from token claims at write time. Roles come from the token. Recipients of share
links are stored per link (`recipient_email`, verified-at timestamps) inside
media-service. Video ids are UUIDv7 (time-ordered, index friendly).

## Consequences

- No event plumbing from auth (a Python service) for user data, and no per-request upserts.
- A renamed user keeps the old name on videos uploaded before the rename. Acceptable.
- A deactivated user can no longer obtain tokens (refresh is blocked), so no media-side sync is needed.
- If a future feature needs live user data in bulk (an admin report), add a batch lookup endpoint on auth rather than a projection.
