# Engineering Architecture & Implementation Decisions

This document records architectural, design, and implementation decisions made while building the ReachInbox Full-Stack Email Job Scheduler.

---

## 1. Monorepo Structure & Process Model

- **Decision**: Organize the project into root infra/scripts, `backend/`, and `frontend/`. Keep the API server and worker as two decoupled entry points (`src/server.ts` and `src/worker.ts`), sharing core configuration, models, rate limiters, and queue logic.
- **Rationale**: Allows independent scaling of API and worker processes. Enables launching multiple concurrent workers without code duplication.

## 2. Queue & Scheduling Engine (BullMQ + Redis)

- **Decision**: Use BullMQ delayed jobs (`delay`, `job.moveToDelayed`) and Redis persistent storage (`--appendonly yes`). Strictly prohibit all cron libraries and `setInterval`/`setTimeout` scheduling.
- **Rationale**: Meets the hard constraint that all scheduling must be persistent, recoverable across crashes and restarts, and cluster-safe across multiple worker processes.

## 3. Idempotency & Concurrency Model

- **Decision**: Multi-layered idempotency:
  1. `jobId = emailId`: BullMQ guarantees at most one job per ID in delayed/waiting state.
  2. Database Atomic Claim: `UPDATE "Email" SET status = 'processing', attempts = attempts + 1 WHERE id = $1 AND status IN ('scheduled', 'delayed') RETURNING *`. If 0 rows return, the worker returns early.
  3. Deterministic `Message-ID: <emailId@reachinbox.local>` on SMTP dispatch.
- **Rationale**: Even with multiple workers or crash recovery, duplicate sends are mathematically prevented.

## 4. Rate Limiting: Atomic Redis Lua Script & Two-Tier Gaps

- **Decision**:
  1. Window-based hourly limit via Redis Lua script (`reserveSlot.lua`) calculating co-located hash tagged keys `rl:{senderId}:{windowStartMs}`.
  2. If the current window is full, reserve a slot in a future window and compute `runAt = windowStart + (position - 1) * MIN_DELAY_BETWEEN_EMAILS_MS` to preserve arrival ordering.
  3. Per-sender gap via `SET gap:{senderId} 1 NX PX MIN_DELAY` in addition to BullMQ queue-level limiter.
- **Rationale**: Redis Lua script guarantees zero race conditions across distributed workers without locking Postgres rows or relying on memory state.

## 5. Startup Reconciliation (`reconcile.ts`)

- **Decision**: Run a reconciliation routine on startup in both API and worker processes (once at boot, not on a timer).
- **Rationale**: Catches any emails marked `scheduled` or `delayed` where the Redis job was lost or evicted, re-queuing them with appropriate remaining delay. Recovers orphaned `processing` records older than 2 minutes.

## 6. Real OAuth Integrations (Google & Slack)

- **Decision**:
  - Google OAuth using official `google-auth-library` and stateful/signed JWT session cookies (`httpOnly`, `SameSite=Lax`).
  - Slack OAuth via Slack `oauth.v2.access` with `incoming-webhook` scope and signed state parameter. Dynamic webhook lookup upon rate-limit hit.
- **Rationale**: Ensures production-grade security and full compliance with OAuth standards without mocks.

## 7. Resilience: Elasticsearch Graceful Fallback

- **Decision**: Wrap Elasticsearch indexing and search in try/catch handlers that log warnings and fallback cleanly to database queries when ES is unavailable.
- **Rationale**: Adheres to the prompt constraint: *"If ES is down, log and continue. ES failures must never block scheduling or sending."*

## 8. Development Environment Portability

- **Decision**: In addition to standard `docker-compose.yml` for production/container environments, provide zero-install local runner capability on Windows using native portable Redis and `embedded-postgres` so tests and verification run out-of-the-box.
- **Rationale**: Guarantees testability and automated verification even in non-containerized Windows shell environments.
