# ADR 0006: Billing placement and payment provider

- Status: accepted (provider comparison and plan prices finalised in F10)
- Date: 2026-11-27

## Context

Plans (Free, Pro, Business) carry limits: storage, transcoding minutes, seats,
active share links, max upload size, leak tracing. Customers can be anywhere,
so sales tax and VAT must be handled. No new service. Stripe accounts for new
Indian businesses are invite-only.

## Options (placement)

1. Billing in `auth`: plans and subscriptions next to companies and seats.
2. Billing in `media-service`: next to the usage it enforces.

## Decision

Placement: `auth`.

- The gateway's per-plan rate limits need `plan` in the access token, which auth issues.
- Seats and company suspension are enforced at login, in auth.
- media-service enforces storage, minutes, links and upload size using entitlements from an internal auth endpoint (cached 60 s) and its own usage counters, because it owns those facts.
- Plans are flat tiers, so no usage is reported to the payment provider.
- Until F10, every company's `plan` is `free`.

Provider: Paddle (merchant of record: collects and remits sales tax/VAT
worldwide), in sandbox mode, behind a small provider interface so it can be
swapped. Webhooks verified by signature and processed idempotently.

## Consequences

- Billing code is Python; Paddle's webhook signature scheme is implemented with the standard library (HMAC).
- Going live requires Paddle's seller verification and business details; listed for the owner in F10 with links.

Sources: [Stripe: opening an account in India](https://support.stripe.com/questions/how-can-i-open-a-stripe-account-in-india).
