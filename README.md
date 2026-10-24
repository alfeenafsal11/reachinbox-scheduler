# ReachInbox — Full-Stack Email Job Scheduler

A **production-grade** email scheduling service with a React dashboard. Schedule bulk email campaigns, control per-sender rate limits, and monitor delivery — all backed by BullMQ persistent delayed jobs, Redis, and PostgreSQL.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Persistent Job Scheduling** | BullMQ delayed jobs stored in Redis (`--appendonly yes`) — survives crashes and restarts |
| **Bulk Campaigns** | Schedule thousands of emails at once via CSV upload or text paste |
| **Per-Sender Rate Limiting** | Atomic Redis Lua script enforces configurable hourly limits across multiple workers without race conditions |
| **Minimum Send Gap** | Configurable minimum delay (ms) between consecutive sends per sender |
| **Multi-Worker Safe** | Atomic DB claim prevents duplicate processing even across concurrent workers |
| **Startup Reconciliation** | On boot, re-queues any `scheduled`/`delayed` jobs lost during a crash or Redis eviction |
| **Full-Text Search** | Elasticsearch with graceful DB fallback — ES failures never block scheduling |
| **Real OAuth** | Google OAuth login + Slack OAuth for webhook rate-limit alerts |
| **Bull Board UI** | Visual queue inspector at `/admin/queues` |
| **React Dashboard** | Glassmorphism dark UI — login, stat cards, paginated tables, CSV import, schedule modal |

---

## 🗂 Project Structure

```
PROJECT_ALF/
├── backend/                  # Express API + BullMQ Worker
│   └── src/
│       ├── config/           # env, logger, prisma, redis
│       ├── middleware/        # auth, validation, error handler
│       ├── modules/
│       │   ├── auth/         # Google OAuth + JWT cookies + dev login
│       │   ├── emails/       # Schedule, list, search endpoints
│       │   ├── search/       # Elasticsearch indexer + search routes
│       │   ├── senders/      # Ethereal SMTP sender bootstrap
│       │   └── slack/        # Slack OAuth + webhook notifier
│       ├── queue/            # BullMQ setup, email.queue, reconcile
│       ├── server.ts         # API server entry point
│       └── worker.ts         # BullMQ worker entry point
│
├── frontend/                 # React + Vite + Tailwind v4
│   └── src/
│       ├── api/              # Fetch wrappers (auth, emails)
│       ├── components/       # EmailsTable, ScheduleModal, StatusBadge, Toaster
│       ├── context/          # AuthContext (session management)
│       ├── pages/            # LoginPage, DashboardPage
│       └── types.ts          # Shared TypeScript interfaces
│
├── docs/
│   └── DECISIONS.md          # Architecture & engineering decisions log
├── scripts/
│   └── start-local-infra.ts  # Zero-install Windows local runner
├── tools/                    # Portable Redis binary (Windows)
├── docker-compose.yml        # PostgreSQL + Redis + Elasticsearch
└── .env.example              # All required environment variables
```

---

## 🚀 Quick Start

### Option A — Docker (recommended for Linux/macOS)

```bash
# 1. Clone & configure
cp .env.example .env
# Edit .env — set JWT_SECRET, Google/Slack OAuth keys

# 2. Start infrastructure
docker compose up -d

# 3. Install & migrate backend
cd backend
npm install
npx prisma db push

# 4. Start API server + worker (two terminals)
npm run dev:api
npm run dev:worker

# 5. Start frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

### Option B — Zero-Install on Windows (no Docker required)

This project ships with a **portable Redis** binary and uses **embedded-postgres**, so you can run everything natively on Windows with no external installs.

> [!NOTE]
> Run all commands starting from the project root directory (`PROJECT_ALF`).

```powershell
# 1. Configure environment (from project root)
Copy-Item .env.example .env
# Edit .env if needed (default values work with zero-install)

# 2. Install dependencies
cd backend
npm install
cd ../frontend
npm install
cd ..

# 3. Start local infra (Redis on :6379 + embedded Postgres on :5432)
# Run from project root — will spawn background Redis & Postgres
npx tsx scripts/start-local-infra.ts

# 4. Run DB migrations (from project root)
cd backend
npx prisma db push
cd ..

# 5. In separate terminal windows:
# Terminal 1 — API Server:
cd backend
npm run dev:api       # API on http://localhost:4000

# Terminal 2 — Email Worker:
cd backend
npm run dev:worker    # Background BullMQ worker

# Terminal 3 — Frontend:
cd frontend
npm run dev           # Dashboard on http://localhost:5173
```

> [!TIP]
> **Windows `EPERM` error on `npx prisma db push`?**
> If you get `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`, it means your backend server (`npm run dev:api`) is currently running and Windows has locked the native engine file.
> - **Fix 1**: Stop `npm run dev:api` (press `Ctrl+C`), run `npx prisma db push`, then restart `npm run dev:api`.
> - **Fix 2**: Or run `npx prisma db push --skip-generate` (the database schema syncs without needing to overwrite the locked client file).

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/scheduler?schema=public

# Redis (must have AOF persistence enabled)
REDIS_URL=redis://localhost:6379

# Elasticsearch (optional — app falls back to DB if offline)
ELASTICSEARCH_URL=http://localhost:9200

# Auth
JWT_SECRET=change_me_32_chars_min
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000
PORT=4000

# Google OAuth — https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Slack OAuth — https://api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

# Worker tuning
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
ETHEREAL_SENDER_COUNT=3
```

> **Note:** Google and Slack OAuth keys are optional for local development. Use the **Dev Login** button on the login page to sign in without OAuth.

---

## 🖥 Dashboard

| Screen | Description |
|---|---|
| **Login** | Dev-mode login (no password) or Google OAuth |
| **Dashboard** | Live stat cards — scheduled, sent, failed counts |
| **Scheduled tab** | Paginated list of pending emails with sender & schedule time |
| **Sent / Failed tab** | Historical delivery records with timestamps |
| **Search tab** | Full-text search across all emails by subject, recipient, or body |
| **New Campaign modal** | Schedule a bulk campaign — paste recipients or upload a CSV |

---

## 📡 API Reference

All endpoints are under `http://localhost:4000`.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/dev-login` | Dev-mode login `{ email, name }` — sets JWT cookie |
| `GET` | `/auth/me` | Returns current user (requires auth cookie) |
| `POST` | `/auth/logout` | Clears session cookie |
| `GET` | `/auth/google` | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | Google OAuth callback |

### Emails

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/emails/schedule` | Schedule a campaign (see body below) |
| `GET` | `/api/emails/scheduled` | List pending emails `?page=1&pageSize=20` |
| `GET` | `/api/emails/sent` | List sent/failed emails `?page=1&pageSize=20` |
| `GET` | `/api/emails/search` | Search emails `?q=text&status=sent&page=1` |

**Schedule request body:**
```json
{
  "subject": "Hello from ReachInbox",
  "body": "Email body (plain text or HTML)",
  "recipients": ["alice@example.com", "bob@example.com"],
  "startAt": "2025-01-15T10:00:00.000Z",
  "delayMs": 60000,
  "hourlyLimit": 50
}
```

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/admin/queues` | Bull Board queue inspector (requires auth) |
| `GET` | `/api/slack/connect` | Start Slack OAuth |
| `GET` | `/api/slack/status` | Slack connection status |
| `DELETE` | `/api/slack/disconnect` | Disconnect Slack |

---

## 🏗 Architecture

```
                ┌──────────────────┐
    Browser     │  React Dashboard │ :5173
                └────────┬─────────┘
                         │ HTTP / Proxy
                ┌────────▼─────────┐
                │   Express API    │ :4000
                │  server.ts       │
                └──┬──────┬────────┘
                   │      │
         ┌─────────▼──┐  ┌▼───────────────┐
         │ PostgreSQL  │  │  BullMQ Queue  │
         │  (Prisma)   │  │  (Redis AOF)   │
         └─────────┬───┘  └──────┬─────────┘
                   │             │
                ┌──▼─────────────▼──┐
                │   BullMQ Worker   │
                │   worker.ts       │
                └───────────────────┘
                          │
                ┌─────────▼────────┐
                │  Ethereal SMTP   │
                │  (fake emails)   │
                └──────────────────┘
```

**Rate Limiting Flow:**
1. Worker picks up a job → calls Redis Lua `reserveSlot.lua`
2. Lua atomically checks the current hourly window for that sender
3. If the window is full → computes `runAt` in a future window → job is re-delayed
4. Otherwise → per-sender gap key `SET gap:{senderId} 1 NX PX <MIN_DELAY>` is set → email is sent

---

## 🔧 Development Scripts

### Backend

```bash
npm run dev:api        # Start API server with hot-reload (tsx watch)
npm run dev:worker     # Start worker with hot-reload
npm run build          # Compile TypeScript to dist/
npm run typecheck      # Type-check without emitting
npx prisma studio      # Open Prisma DB browser
npx prisma db push     # Sync schema to DB
```

### Frontend

```bash
npm run dev            # Start Vite dev server on :5173
npm run build          # Production build to dist/
npm run lint           # Run oxlint
```

---

## 🏛 Key Engineering Decisions

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the full decision log. Summary:

1. **BullMQ + Redis AOF** — all scheduling is persistent, no `setTimeout` or cron
2. **Multi-layer idempotency** — `jobId = emailId` + atomic DB claim + deterministic `Message-ID`
3. **Atomic Lua rate limiting** — zero race conditions across distributed workers
4. **Startup reconciliation** — re-queues orphaned jobs on every boot
5. **ES graceful fallback** — Elasticsearch unavailability never blocks email delivery
6. **Windows-portable infra** — embedded-postgres + portable Redis, no Docker required

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| **API** | Express 4, TypeScript, Zod validation |
| **ORM** | Prisma 5 + PostgreSQL 16 |
| **Queue** | BullMQ 5 + Redis 7 (AOF persistence) |
| **Search** | Elasticsearch 8 (optional, graceful fallback) |
| **Email** | Nodemailer + Ethereal SMTP |
| **Auth** | JWT (httpOnly cookies) + Google OAuth |
| **Alerts** | Slack OAuth + Incoming Webhooks |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4 |
| **Queue UI** | Bull Board (`/admin/queues`) |

---

## 📄 License

MIT
