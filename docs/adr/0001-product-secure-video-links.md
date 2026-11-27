# ADR 0001: Product direction, secure and traceable video links

- Status: accepted
- Date: 2026-11-27

## Context

The starting idea was private video hosting for companies with SSO and tenant
isolation. That market is crowded, and Microsoft Stream is bundled free with
Microsoft 365, which makes "internal video hosting" hard to sell on its own.

People still pay for links (URL shorteners are a business) because a link is how
they send something to someone. Teams regularly send confidential video outside
the company: sales demos to prospects, agency drafts to clients, investor
updates, HR and legal recordings, studio screeners. Today they use a public or
"unlisted" link and lose control of it.

Pieces of a solution exist separately: course platforms offer dynamic visible
watermarks; self-serve forensic watermarking exists for files (Markedfile, video
from its $49.99/month tier); Kinescope bundles a visible per-viewer mark and sells
invisible marking on quote; enterprise vendors (NAGRA, Synamedia) do not publish
prices. We found no product combining company SSO for senders, verified external
recipients, viewer analytics and leak tracing at self-serve prices. That
combination, not any single technique, is the gap.

## Options

1. Internal video hosting (original framing): competes with a free bundle.
2. Secure video links: the share link is the product; internal hosting is the base layer.
3. A vertical product (for example HR investigation evidence vault): narrower market, heavier compliance.

## Decision

Option 2. Senders sign in with their company SSO (tenant isolated as planned).
Each recipient gets their own short link, verifies their email with a one-time
code, and watches with a moving watermark showing their email and the time.
Senders set expiry, view limits and can revoke; they see who watched and how far.
The Business tier adds leak tracing: two subtly marked renditions, with each
viewer's playlist mixing 4-second segments in a pattern unique to that viewer, so
a leaked clip can be decoded back to one recipient.

## Consequences

- F0–F6, F8, F11–F13 are unchanged.
- F7 becomes secure playback plus share links (recipient OTP, scoped viewer token, expiry, revoke).
- New F7b: leak tracing (doubles storage and transcoding for videos that enable it; first to cut).
- F9 centres on links and viewer analytics; F10 plans: Free, Pro (per seat), Business (SSO enforcement, tracing, audit export). Payments via Paddle (see ADR 0006).
- Playback heartbeats become a high-volume event stream, which is a real job for Kafka (ADR 0004).
- Email delivery is required (OTP, magic link); Mailpit in dev.
- The visible watermark is a deterrent, not protection: it is drawn by the player and only survives screen capture, which is how video leaks in practice. Stated in the threat model.

Sources: [Markedfile](https://markedfile.com/), [Kinescope on forensic watermarking](https://kinescope.com/blog/forensic-watermarking), [Muvi forensic watermarking](https://www.muvi.com/one/features/forensic-watermarking/).
