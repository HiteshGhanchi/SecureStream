# ADR 0004: Event pipeline, transactional outbox and Kafka

- Status: accepted
- Date: 2026-11-27

## Context

StreamFlow used Debezium CDC on the `Video` table: the processor reacted to raw
row changes and wrote results back into the backend's table with raw SQL. Errors
were swallowed and offsets committed, so failed videos stayed `uploaded` forever.
We need explicit, versioned events (`video.uploaded`, `video.ready`,
`video.failed`), each service owning its own database, and (per ADR 0001) a
high-volume stream of playback heartbeats feeding analytics and usage metering.

## Options

1. Keep Debezium CDC on the table.
2. Transactional outbox table published by Debezium's outbox event router.
3. Transactional outbox table published by a small relay.
4. Postgres-only job queue (for example pg-boss), no broker.

## Decision

Option 3, with Kafka as the broker.

- media-service writes the domain change and an `outbox` row in one transaction.
- A relay claims rows with `SELECT ... FOR UPDATE SKIP LOCKED`, publishes, marks them sent; at-least-once.
- Envelope: `{id, type, version, company_id, occurred_at, data}`; messages keyed by `video_id`.
- Topics: `video.uploaded`, `video.processing`, `video.ready`, `video.failed`, `video.dlq`, `playback.events`.
- The processor never touches a database: it consumes `video.uploaded` and publishes results; media-service consumes them and updates its own tables.
- Consumers deduplicate with a `processed_events (event_id)` table; output storage keys are deterministic so a replay overwrites rather than duplicates.
- Client library: `@confluentinc/kafka-javascript` (librdkafka, KafkaJS-compatible API). KafkaJS has had no release since February 2023.
- Long transcodes: `max.poll.interval.ms` sized for the longest allowed video, or pause the partition while working.

## Consequences

- Debezium dropped: no extra JVM, no `wal_level=logical`, no replication slot that retains WAL indefinitely while the connector is down, no superuser credentials in a connector config.
- Relay adds ~0.5–1 s publish latency; fine for transcoding and analytics.
- Option 4 is technically enough for the transcode queue alone and much cheaper to host; we keep Kafka because playback analytics is a genuine multi-consumer stream. Publishing and consuming stay behind a small interface so the cloud round can swap brokers (SQS, Pub/Sub) or drop to Postgres if hosting cost demands it.
- Kafka is the heaviest component locally; its memory needs are recorded in DEPLOY_NOTES (F13).

Sources: [Confluent JavaScript client](https://www.confluent.io/blog/introducing-confluent-kafka-javascript/), [Confluent client docs](https://docs.confluent.io/kafka-clients/javascript/current/overview.html).
