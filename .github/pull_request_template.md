## What and why

<!-- One paragraph: what changes, and the problem it solves. Link the feature (F0–F13) or bug. -->

## How to test

<!-- Exact commands, e.g. `make up && make test`, plus any manual steps. -->

## Screenshots

<!-- Required for UI changes; delete otherwise. -->

## Checklist

- [ ] Tests added or updated (unit, plus integration where a database/broker is involved)
- [ ] Cross-tenant access still denied (when touching tenant data)
- [ ] Docs updated (README, service README, ADR if a decision changed)
- [ ] Migrations included and reversible (Alembic / Prisma Migrate)
- [ ] New env vars added to the matching `.env.example`
- [ ] No secrets, `.env` files, build output or `node_modules` committed
- [ ] Rebased on `main`, no merge commits
