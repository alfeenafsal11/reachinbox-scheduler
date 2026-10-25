# ReachInbox — Full-Stack Email Job Scheduler

[![Live Dashboard](https://img.shields.io/badge/HuggingFace_Spaces-Live_Dashboard-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://alfeenafsal-reachinbox-scheduler-ui.static.hf.space)
[![Render Backend](https://img.shields.io/badge/Render-API_Active-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://reachinbox-api-cu2i.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.8-E0234E?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)

A **production-grade, distributed email scheduling service** with a modern React dashboard. Schedule bulk email campaigns, control per-sender rate limits with atomic Redis Lua scripts, and monitor delivery with multi-worker idempotency and startup reconciliation.

---

## 🌐 Live Deployments

| Component | Platform | URL |
|---|---|---|
| **Frontend Dashboard** | Hugging Face Spaces | [alfeenafsal-reachinbox-scheduler-ui.static.hf.space](https://alfeenafsal-reachinbox-scheduler-ui.static.hf.space) |
| **Space Repository** | Hugging Face Hub | [huggingface.co/spaces/alfeenafsal/reachinbox-scheduler-ui](https://huggingface.co/spaces/alfeenafsal/reachinbox-scheduler-ui) |
| **Backend REST API** | Render | [reachinbox-api-cu2i.onrender.com](https://reachinbox-api-cu2i.onrender.com) |
| **Health Check** | Render | [reachinbox-api-cu2i.onrender.com/health](https://reachinbox-api-cu2i.onrender.com/health) |
| **Queue Inspector (Bull Board)** | Render | [reachinbox-api-cu2i.onrender.com/admin/queues](https://reachinbox-api-cu2i.onrender.com/admin/queues) |

---

## ✨ Features & Implementation

| Feature | Implementation Details |
|---|---|
| **Persistent Delayed Queue** | Backed by **BullMQ** on Redis with `--appendonly yes`. Delayed jobs persist across process restarts, container crashes, and redeployments. |
| **Multi-Worker Idempotency** | **3-layer idempotency guard**: (1) Queue-level deduplication via deterministic `jobId = emailId`, (2) Database-level atomic state claim (`UPDATE "Email" SET status = 'processing' WHERE status IN ('scheduled', 'delayed') RETURNING *`), (3) Deterministic `Message-ID` preventing SMTP re-delivery. |
| **Atomic Lua Rate Limiting** | Custom Redis Lua script (`reserveSlot.lua`) calculates and enforces hourly quotas per sender. If the quota is exceeded, it atomically calculates the exact delay for the next available window and re-queues the job with zero race conditions. |
| **Sender Gap Throttling** | Enforces a minimum configurable spacing (e.g. 2000ms) between consecutive sends for each sender key (`SET gap:{senderId} 1 NX PX <MIN_DELAY>`). |
| **Startup Queue Reconciliation** | On every boot, `reconcileQueue()` scans PostgreSQL for orphaned or interrupted jobs from sudden crashes, resets stale `processing` rows, and re-enqueues them into BullMQ. |
| **Automatic Ethereal SMTP & Previews** | Automatically bootstraps Nodemailer Ethereal test accounts. Sent emails store a real web preview link (`previewUrl`) viewable directly in the dashboard. |
| **Full-Text Search with Fallback** | Elasticsearch 8 indexing on email subject, body, and recipient with an automatic, seamless PostgreSQL fallback if Elasticsearch is offline. |
| **Dual Authentication** | JWT with httpOnly cookies + Authorization Bearer header support. Includes **Google OAuth 2.0** and **One-Click Dev Login** for testing. |
| **Slack Webhook Alerts** | Slack OAuth integration with automated webhook notifications when hourly sender rate limits are reached. |
| **Glassmorphism Dark UI** | React 19 + Vite dashboard featuring live delivery stat cards, paginated scheduled/sent tables, CSV upload modal, and search inspector. |
| **Bull Board Dashboard** | Real-time queue visualizer at `/admin/queues` showing active, delayed, waiting, and completed jobs. |

---

## 🏗 System Architecture

```
                            ┌───────────────────────────────────┐
                            │    React Dashboard (Vite 8)       │
                            │  Hugging Face / localhost:5173   │
                            └─────────────────┬─────────────────┘
                                              │ HTTP / JSON (Credentials / Bearer)
                                              ▼
                            ┌───────────────────────────────────┐
                            │      Express API (server.ts)      │
                            │      Render / localhost:4000      │
                            └───┬─────────────┬─────────────┬───┘
                                │             │             │
                1. Create Email │             │             │ 2. Push Delayed Job
                & Campaign Rows │             │             │    (jobId = emailId)
                                ▼             ▼             ▼
                     ┌──────────────┐   ┌───────────┐   ┌─────────────────┐
                     │  PostgreSQL  │   │ Elastic-  │   │  BullMQ Queue   │
                     │ (Neon/Prisma)│   │  search   │   │  (Redis 7 AOF)  │
                     └──────────────┘   └───────────┘   └────────┬────────┘
                                                                 │
                                3. Pull delayed job when due    │
                                                                 ▼
                                                        ┌─────────────────┐
                                                        │  BullMQ Worker  │
                                                        │   (worker.ts)   │
                                                        └────────┬────────┘
                                                                 │
                                          4. Atomic Lua Rate Limit Check
                                          5. Atomic DB Row Claim ('processing')
                                                                 │
                                                                 ▼
                                                        ┌─────────────────┐
                                                        │  Ethereal SMTP  │
                                                        │  (Test Preview) │
                                                        └─────────────────┘
```

### Rate Limiting & Scheduling Workflow:
1. **Schedule**: User submits campaign (start time, delay, hourly limit, recipients). Emails are stored in PostgreSQL with status `scheduled`.
2. **Enqueue**: Each email is added to BullMQ with `delay = startAt + (index * delayMs) - now` and `jobId = email.id`.
3. **Execution**: When delay expires, a worker picks up the job.
4. **Atomic Claim**: Worker executes an atomic SQL update:
   ```sql
   UPDATE "Email"
   SET status = 'processing', attempts = attempts + 1
   WHERE id = :emailId AND status IN ('scheduled', 'delayed')
   RETURNING *;
   ```
   If 0 rows are returned, another worker already claimed it; the job exits safely.
5. **Lua Rate Limit Check**:
   The worker executes `reserveSlot.lua` against Redis. If the current 1-hour window has available slots, it increments the window counter and proceeds. If full, it computes the future timestamp `runAt` and re-delays the job.
6. **Dispatch & Preview**: Nodemailer dispatches through the assigned Ethereal account, saves `sentAt` and `previewUrl`, and marks status `sent`.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Database (PostgreSQL — local or Neon.tech)
DATABASE_URL=postgresql://postgres:password@localhost:5432/scheduler?schema=public

# Redis (local or Upstash Redis URL)
REDIS_URL=redis://localhost:6379

# Elasticsearch (Optional — falls back to PostgreSQL automatically)
ELASTICSEARCH_URL=http://localhost:9200

# Auth & URLs
JWT_SECRET=reachinbox_super_secret_jwt_production_key_32chars
PORT=4000
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

# Google OAuth (Optional — Dev Login works out of the box)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Slack OAuth (Optional)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

# Queue & Worker Settings
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
ETHEREAL_SENDER_COUNT=3
QUEUE_NAME=email-queue
```

---

## 🚀 Local Setup Instructions

### Prerequisites
- Node.js 18+ (tested on Node 20 & 24)
- Redis 5.0+ (local or free [Upstash Redis](https://upstash.com))
- PostgreSQL 14+ (local or free [Neon.tech](https://neon.tech))

### 1. Clone & Install
```bash
git clone https://github.com/alfeenafsal11/reachinbox-scheduler.git
cd reachinbox-scheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Configure Environment & Database
```bash
cp .env.example .env
# Edit .env and enter your DATABASE_URL and REDIS_URL

# Sync Prisma Schema
cd backend
npm run prisma:push
cd ..
```

### 3. Start Infrastructure & Servers

**Option A — Running Locally (Two Terminals):**

*Terminal 1 (Backend API & Worker):*
```bash
cd backend
npm start
# Server + Worker listening on http://localhost:4000
```

*Terminal 2 (Frontend Dashboard):*
```bash
cd frontend
npm run dev
# Dashboard running on http://localhost:5173
```

**Option B — Zero-Install on Windows (No Docker Required):**
```powershell
# Starts embedded Postgres and portable Redis automatically:
npx tsx scripts/start-local-infra.ts

# In separate terminals:
npm --prefix backend run dev:api
npm --prefix backend run dev:worker
npm --prefix frontend run dev
```

Open **http://localhost:5173** and click **Dev Login** to sign in immediately without Google OAuth setup!

---

## ☁️ Cloud Deployment Instructions

### 1. Backend on Render (Web Service)
1. Fork or push this repository to your GitHub account.
2. Sign in to [Render](https://dashboard.render.com) and click **New +** → **Blueprint**.
3. Select this repository (`reachinbox-scheduler`). Render will read [`render.yaml`](render.yaml).
4. Provide the two required environment variables when prompted:
   - `DATABASE_URL`: Connection string from [Neon.tech](https://neon.tech) or Render PostgreSQL.
   - `REDIS_URL`: Connection string from [Upstash](https://upstash.com) (`rediss://...`).
5. Click **Apply**. Render will install, migrate the database schema, compile TypeScript, and boot both the API server and BullMQ background worker!

### 2. Frontend on Hugging Face Spaces (Static Space)
1. Log in to [Hugging Face](https://huggingface.co).
2. Create a new Space:
   - **SDK**: `Static`
   - **License**: `MIT`
3. In `frontend/`, build the production bundle pointing to your live Render backend:
   ```bash
   export VITE_BACKEND_URL="https://your-api.onrender.com"
   npm --prefix frontend run build
   ```
4. Upload the contents of `frontend/dist/` to the root of your Hugging Face Space repository.
5. Your dashboard is instantly live with zero maintenance!

---

## 📡 API Reference

### Auth Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/dev-login` | Instant developer login with `{ "email": "user@example.com", "name": "User" }` |
| `GET` | `/auth/me` | Fetch active authenticated user session |
| `POST` | `/auth/logout` | Clear session cookie and revoke token |
| `GET` | `/auth/google` | Initiate Google OAuth 2.0 flow |
| `GET` | `/auth/google/callback` | Google OAuth callback handler |

### Email & Campaign Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/emails/schedule` | Schedule a campaign (supports array of recipients, delay, hourly limit) |
| `GET` | `/api/emails/scheduled` | List pending/delayed emails with pagination (`?page=1&pageSize=20`) |
| `GET` | `/api/emails/sent` | List delivered and failed emails with Ethereal preview links |
| `GET` | `/api/emails/search` | Full-text search across emails (`?q=keyword&status=sent`) |

### Example Schedule Campaign Request:
```bash
curl -X POST http://localhost:4000/api/emails/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "subject": "Exclusive Launch Invitation",
    "body": "<p>Hello from ReachInbox! Your scheduled demo is ready.</p>",
    "recipients": ["client1@example.com", "client2@example.com"],
    "startAt": "2026-10-25T12:00:00.000Z",
    "delayMs": 2000,
    "hourlyLimit": 100
  }'
```

### System Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check reporting service uptime and status |
| `GET` | `/admin/queues` | Bull Board visual queue inspector (Active / Delayed / Completed) |
| `GET` | `/api/slack/connect` | Connect Slack workspace for rate limit alerts |
| `DELETE` | `/api/slack/disconnect` | Disconnect Slack webhook integration |

---

## 📁 Repository Structure

```
reachinbox-scheduler/
├── backend/                     # Express REST API + BullMQ Worker
│   ├── prisma/                  # PostgreSQL schema definition
│   │   └── schema.prisma
│   └── src/
│       ├── config/              # Prisma, Redis, logger, env validation
│       ├── middleware/          # JWT authentication, error handling
│       ├── modules/
│       │   ├── auth/            # Google OAuth + Dev Login controllers
│       │   ├── emails/          # Email scheduling & listing routes
│       │   ├── search/          # Elasticsearch client & search fallback
│       │   ├── senders/         # Ethereal SMTP account bootstrap
│       │   └── slack/           # Slack OAuth & webhook alerts
│       ├── queue/
│       │   ├── scripts/         # Atomic Lua script (reserveSlot.lua)
│       │   ├── email.queue.ts   # BullMQ persistent queue instance
│       │   ├── email.worker.ts  # Worker processor & atomic DB claim
│       │   ├── rateLimiter.ts   # Lua wrapper & rolling window logic
│       │   └── reconcile.ts     # Startup crash recovery logic
│       ├── server.ts            # HTTP API server & static fallback
│       ├── worker.ts            # Standalone worker bootstrap
│       └── app.ts               # Unified production entrypoint
│
├── frontend/                    # React 19 + Vite 8 Dashboard
│   └── src/
│       ├── api/                 # Fetch API wrappers (client, auth, emails)
│       ├── components/          # EmailsTable, ScheduleModal, StatusBadge
│       ├── context/             # AuthContext (session state)
│       ├── pages/               # LoginPage, DashboardPage
│       └── types.ts             # Shared TypeScript models
│
├── render.yaml                  # Render Infrastructure as Code (Blueprint)
├── docker-compose.yml           # PostgreSQL + Redis + ES local stack
└── README.md                    # Project documentation
```

---

## 📄 License

MIT © [Alfeen Afsal](https://github.com/alfeenafsal11)
