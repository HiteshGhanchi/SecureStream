# StreamFlow import (F1)

StreamFlow code was copied into this repository as a plain copy (no history),
from https://github.com/HiteshGhanchi/StreamFlow at commit
`3d081f3cdc6706a3c637873811bed51c4eb7c0fd` (2026-05-05). Nothing was changed in
the copied code, so later commits show every change made while porting it.

| StreamFlow path | Lands at | State |
|---|---|---|
| `core-backend/` | `media-service/streamflow-core-backend/` | Verbatim. Ported into `media-service/src/` in F4, then this folder is deleted. Excluded from media-service lint, build and Docker image. |
| `video-processor/` | `video-processor/` | Verbatim. Builds and CI added in F2; hardened in F5. |
| `frontend/` | `frontend/` | Verbatim. Does not build yet (8 TypeScript errors); fixed in F2, rebuilt as the product UI in F9. |
| `keycloak/realm-export.json` | not copied | Secrets were masked and it had no users, so it could not run as a tenant. A minimal `keycloak/import/companya-realm.json` replaces it. |
| `keycloak/Dockerfile.prod` | `docs/reference/streamflow/keycloak/` | Reference for the cloud round. |
| `k8s/` | `docs/reference/streamflow/k8s/` | Reference only. AWS account id replaced with `<AWS_ACCOUNT_ID>`; secrets are placeholders. |
| `.github/workflows/deploy-frontend.yml` | `docs/reference/streamflow/deploy-frontend.yml` | Reference only (moved out of `.github/` so it never runs). |
| `docker-compose.yml`, `README.md`, `CONFIGURATION.md` | `docs/reference/streamflow/` | Reference. Kafka is re-added to the main compose file; Debezium is dropped (ADR 0004); MinIO is replaced by SeaweedFS because MinIO no longer publishes images. |
