# Bukonzo Teachers SACCO — Management Platform

A Next.js core banking / SACCO (Savings and Credit Cooperative Organisation)
management system built for **Bukonzo Teachers SACCO** (Uganda). It covers
the full member lifecycle — onboarding, savings accounts, shares, fixed
deposits, loans, and cash custody — with role-based dashboards for members,
tellers, agents, loan officers, accountants, branch managers, admins, and
auditors.

> Internally the codebase is still named `next-admin` in `package.json`
> (leftover from the original scaffold) — the product itself is the SACCO
> platform described below.

## Table of Contents

- [What this is](#what-this-is)
- [Core modules](#core-modules)
- [Roles](#roles)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Fingerprint Reader Bridge](#fingerprint-reader-bridge)
- [Scripts Reference](#scripts-reference)
- [Authorization](#authorization)
- [Docker Deployment (Production, Ubuntu VPS)](#docker-deployment-production-ubuntu-vps)

## What this is

A SACCO is a member-owned financial cooperative: members save, buy shares,
take loans against their savings/shares, and staff move physical cash
between a central vault, branch reserves, and individual teller/agent
"floats" over the course of a day. This app is the system of record for
that whole cycle — member accounts and balances, daily teller/agent
transactions, loan disbursement and repayment, and the accounting/reporting
layer (chart of accounts, journal entries, and a large report catalog) that
sits on top of it.

## Core modules

- **Members & accounts** — onboarding/approval workflow, savings accounts
  (voluntary, compulsory, junior), account types, account holds.
- **Deposits & withdrawals** — teller/agent cash transactions, OTP and
  fingerprint-verified withdrawal flows, transaction reversal.
- **Loans** — loan products, applications, disbursement, repayment
  schedules, write-offs, rescheduling, staff advances.
- **Shares & fixed deposits** — share accounts/transfers, fixed deposits
  with automated maturity processing (`lib/cron/fixedDepositMaturity.ts`).
- **Cash custody** — vault management, branch reserve allocation, and
  teller/agent float allocation, plus end-of-day reconciliation.
- **Accounting** — chart of accounts, journal entries, income/expenditure,
  fixed assets, budgets, suspense accounts.
- **Reporting** — a large report catalog (`lib/reports/**`) covering
  savings listings, share/FD reports, trial balance, balance sheet,
  transaction journals, and more, exportable to PDF/Excel.
- **Institutions** — organisational (non-individual) members with their own
  signatories, loans, and accounts.
- **Mobile money & SMS** — deposits/withdrawals/loan repayments via
  Relworx, MTN MoMo, and Pesapal; SMS notifications via Africa's Talking.
- **Biometric verification** — SecuGen fingerprint enrollment/matching for
  member identity checks at the teller counter (see
  [Fingerprint Reader Bridge](#fingerprint-reader-bridge)).

## Roles

Defined by the `UserRole` enum in `prisma/schema.prisma`:

`ADMIN`, `BRANCHMANAGER`, `ACCOUNTANT`, `TELLER`, `AGENT`, `LOANOFFICER`,
`DATA_ENTRANT`, `ACCOUNT_OPENER`, `AUDITOR`, `INSTITUTION`, `MEMBER`.

## Tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Database:** PostgreSQL via Prisma 6 (`@prisma/adapter-pg`) — Neon in
  development
- **Auth:** NextAuth v4 (credentials-based, `@auth/prisma-adapter`)
- **UI:** Tailwind CSS, Radix UI primitives, TanStack Table/Query, Tiptap
  (rich text), Recharts (analytics)
- **Documents:** `@react-pdf/renderer`, `jspdf`, `pdf-lib`, `pdfjs-dist`
  (report/statement PDFs), `exceljs`/`xlsx` (spreadsheet export)
- **Email:** Resend · **File uploads:** UploadThing · **Images:** Cloudinary
- **Integrations:** Relworx, MTN MoMo, Pesapal (mobile money), Africa's
  Talking (SMS)
- **Deployment:** Docker (multi-stage build) on a self-managed Ubuntu VPS

## Prerequisites

- Node.js 18 or later
- PNPM package manager (`pnpm@9.12.0`, pinned via `packageManager`)
- PostgreSQL database (Neon works well for development)
- Git

## Getting Started

1. Clone the repository:

```bash
git clone [your-repo-url]
cd bukonzemergencys
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables (see next section)
4. Push/seed the database (see [Database Setup](#database-setup))
5. Start the development server:

```bash
pnpm dev
```

This runs the Next.js dev server **and** the local fingerprint reader
bridge concurrently — see [Fingerprint Reader Bridge](#fingerprint-reader-bridge)
if you don't have a reader attached and want to skip it.

## Environment Variables

Create a `.env` file in the root directory. `.env.production.example` is the
authoritative list for production; the categories below match it.

### Database & auth

```env
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"
NEXTAUTH_SECRET="your_generated_secret"   # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

### App branding / public config

These drive the white-label name, currency, and country shown in the UI and
in generated documents:

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Bukonzo Teachers SACCO"
NEXT_PUBLIC_CURRENCY="UGX"
NEXT_PUBLIC_COUNTRY_CODE="UG"
```

### Email (Resend)

```env
RESEND_API_KEY="your_api_key"
RESEND_FROM_EMAIL="notifications@yourdomain.com"
```

### File uploads

```env
UPLOADTHING_TOKEN="your_token"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

### SMS (Africa's Talking)

```env
AFRICASTALKING_API_KEY="..."
AFRICASTALKING_USERNAME="..."
AFRICASTALKING_SENDER_ID="..."
```

### Mobile money

```env
# Relworx (collections/disbursements + webhook)
RELWORX_API_KEY="..."
RELWORX_ACCOUNT_NO="..."
RELWORX_BASE_URL="..."
RELWORX_WEBHOOK_KEY="..."
RELWORX_WEBHOOK_URL="..."
RELWORX_STATUS_POLL_AFTER_MS="180000"

# MTN Mobile Money
MOMO_TARGET_ENV="..."
MOMO_TYPE="..."
MOMO_CURRENCY="UGX"
MOMO_COLLECTIONS_SUB_KEY="..."
MOMO_DISBURSEMENTS_SUB_KEY="..."

# Pesapal
PESAPAL_CONSUMER_KEY="..."
PESAPAL_CONSUMER_SECRET="..."
PESAPAL_ENVIRONMENT="sandbox" # or "live"
PESAPAL_IPM_ID="..."
```

### Cron

```env
CRON_SECRET="..."   # required by app/api/cron/** jobs (e.g. Relworx status reconciliation)
```

## Database Setup

1. Push the schema to your database:

```bash
pnpm prisma db push
```

2. Seed the database with demo data:

```bash
pnpm prisma db seed
```

This creates a full set of branches, account types, loan products, and demo
users across every role — the seed script prints each account's email and
password at the end of the run (default password `password123` unless
noted otherwise). **Do not run the seed script against production** — it's
meant for local/staging setup only.

For schema changes going forward, prefer proper migrations over repeated
`db push`:

```bash
pnpm prisma migrate dev      # development
pnpm prisma migrate deploy   # production (see Docker section)
```

## Fingerprint Reader Bridge

`pnpm dev` and `pnpm start` both launch `scripts/start-bridge.js` alongside
the Next.js server. This is a native bridge (`koffi`) to a SecuGen
fingerprint reader's Windows DLL, meant to run **on a teller's local
Windows machine**, not on a server — the app talks to it over
`localhost:8000`/`8001` (see the CSP `connect-src` entries in
`next.config.ts`). It's a no-op / harmless failure if no reader is attached;
you can also run the bridge on its own with `pnpm bridge`. In Docker/Linux
production the bridge is never started — `node server.js` runs directly.

## Scripts Reference

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server + fingerprint bridge |
| `pnpm build` | Production build (`--max-old-space-size=4096` for large builds) |
| `pnpm start` | Production server + fingerprint bridge (local/on-prem use) |
| `pnpm preview` | Build then start, for a local production-like check |
| `pnpm lint` | `next lint` |
| `pnpm bridge` / `pnpm start:bridge` | Run only the fingerprint bridge |
| `pnpm backup:loans` | Snapshot loan data (`scripts/backup-loans.ts`) |
| `pnpm purge:loans` | ⚠️ Destructive — removes loan data (`scripts/purge-loans.ts`) |
| `pnpm reset:members` | ⚠️ Destructive — resets member data. Gated behind `--dry-run` / `--force`; refuses to run without one of those flags |
| `pnpm verify:members` | Verifies the result of a member reset |

The destructive scripts (`purge:loans`, `reset:members`) are built for
controlled data-migration/cleanup work, not routine use — always run with
`--dry-run` first, and take a database backup before using `--force`
against any environment with real member data.

## Authorization

Access control is enforced **server-side, per role**, using the
authenticated session rather than a generic permission-string gate. The
typical pattern in an API route:

```typescript
// app/api/v1/.../route.ts
import { getAuthUser } from "@/config/useAuth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(); // reads the NextAuth session
  if (!user || !["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```

`config/permissions.ts` additionally defines a `module.action` permission
catalog (e.g. `loans.create`, `deposits.read`) used for finer-grained UI
gating in places that need it beyond a plain role check. There is no
central `PermissionGate`/`usePermission` abstraction in the current
codebase — role checks are written directly in each route/page as shown
above.

## Docker Deployment (Production, Ubuntu VPS)

The app ships with a production-ready multi-stage Docker setup that runs on
**port 3002** (ports 3000/3001 on the VPS are already used by other apps).

Files:

- `Dockerfile` — 4-stage build: `deps` → `builder` → `migrator` → `runner`.
  The runtime image uses Next.js `output: "standalone"`, runs as a non-root
  user, and is a few hundred MB instead of a full `node_modules` image.
- `docker-compose.yml` — the `app` service (container name
  `nextjs-frontend`, port `3002:3002`, `restart: unless-stopped`) and a
  `migrate` service (profile `tools`) for running Prisma migrations on
  demand.
- `.dockerignore` — keeps build context small and secrets out of the image.
- `.env.production.example` — copy to `.env.production` and fill in real
  values.
- `Makefile` — shortcuts for every command below.
- `deploy/nginx/bukonze.conf` — example Nginx reverse proxy + SSL config.
- `.github/workflows/deploy.yml` — builds the image, pushes it to GHCR, and
  deploys to the VPS over SSH.

### First-time setup on the VPS

```bash
git clone <your-repo-url> bukonze && cd bukonze
cp .env.production.example .env.production
nano .env.production          # fill in real DATABASE_URL, secrets, etc.

make build                    # docker compose --env-file .env.production build --no-cache
make migrate                  # apply Prisma migrations
make up                       # docker compose --env-file .env.production up -d
make health                   # curl http://localhost:3002/api/health
```

The app is now reachable at `http://SERVER_IP:3002`. Point Nginx at it using
`deploy/nginx/bukonze.conf` (see comments in that file for install steps),
then get a certificate with `certbot --nginx -d your-domain.com`.

### Everyday commands

| Command | What it does |
| --- | --- |
| `make build` | `docker compose build --no-cache` |
| `make up` | `docker compose up -d` |
| `make down` | `docker compose down` |
| `make restart` | `docker compose restart` |
| `make logs` | `docker compose logs -f app` |
| `make migrate` | Run `prisma migrate deploy` against `.env.production`'s `DATABASE_URL` |
| `make migrate-status` | Show pending migrations without applying them |
| `make prune` | `docker image prune -f` |
| `make clean` | `docker system prune -f` |

Or run the underlying `docker compose` commands directly (always with
`--env-file .env.production`, since that file also supplies the
`NEXT_PUBLIC_*` build args):

```bash
git pull
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
docker compose --env-file .env.production down
docker compose --env-file .env.production restart
docker compose --env-file .env.production logs -f
docker image prune -f
docker system prune -f
```

### Verifying a deployment

```bash
docker ps --filter name=nextjs-frontend
docker logs nextjs-frontend
curl http://localhost:3002/api/health
docker inspect nextjs-frontend --format '{{json .State.Health}}'
```

### Updating with minimal downtime

`make deploy` (or `make update` if you already have the code checked out)
does the following in order:

1. `git pull` (deploy only)
2. Rebuild the image (Docker layer caching keeps this fast — only changed
   layers rebuild)
3. Run `prisma migrate deploy` **before** swapping the container, so the
   schema is always compatible with the code that's about to start
4. `docker compose up -d --no-deps --build app` — Docker recreates only the
   `app` container; the old one keeps serving traffic until the new one
   passes its `HEALTHCHECK` and takes over. There's a brief (~1-3s) restart
   gap, not a hard outage window.
5. Waits for `/api/health` to return 200 before finishing

**Rollback:** if a deploy misbehaves, redeploy the previous known-good
commit (`git checkout <previous-sha> && make deploy`), or if you're using
the GHCR-based CI flow, retag and pull the previous image:

```bash
docker pull ghcr.io/OWNER/REPO:<previous-sha>
docker tag ghcr.io/OWNER/REPO:<previous-sha> ghcr.io/OWNER/REPO:latest
docker compose --env-file .env.production up -d --no-deps app
```

If a bad migration shipped, restore from your most recent `pg_dump` backup
(take one before every `make migrate` in a real incident) — Prisma does not
auto-generate down-migrations.

### CI/CD (GitHub Actions → GHCR → VPS)

`.github/workflows/deploy.yml` triggers on push to `main`:

1. Builds the Docker image (`target: runner`) and pushes it to
   `ghcr.io/OWNER/REPO` tagged `latest` and `<commit-sha>`.
2. SSHes into the VPS and runs `docker compose pull`, `migrate deploy`, then
   recreates only the `app` container.

Required repository secrets:

| Secret | Purpose |
| --- | --- |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Private key for that user |
| `VPS_PORT` | SSH port (optional, defaults to 22) |
| `VPS_APP_DIR` | Absolute path to the cloned repo on the VPS |

Required repository **variables** (`Settings → Secrets and variables →
Actions → Variables`) for the public build args:
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_CURRENCY`, `NEXT_PUBLIC_COUNTRY_CODE`.

On the VPS, also set `IMAGE_NAME=ghcr.io/<owner>/<repo>:latest` in
`.env.production` so `docker compose pull` fetches the image GitHub Actions
just pushed (see `.env.production.example`). Without it, `docker-compose.yml`
defaults to building `bukonze-nextjs:latest` locally, which is what plain
`make build` / `docker compose build` do with zero configuration.

### Known issues detected and fixed automatically

- **No `output: "standalone"`** — added to `next.config.ts` so the Docker
  image ships a minimal, self-contained server instead of full
  `node_modules`.
- **No health check endpoint** — added `app/api/health/route.ts`, used by
  both the Docker `HEALTHCHECK` and Nginx.
- **`puppeteer` dependency downloads a bundled Chromium on install**, but
  the package isn't imported anywhere in the app (only mentioned in a code
  comment in `actions/statements.ts`). The Dockerfile sets
  `PUPPETEER_SKIP_DOWNLOAD=true` to skip the ~300MB download.
- **`next/image` is used in 15+ components but `sharp` wasn't installed** —
  added as a production dependency for proper image optimization (Next.js
  falls back to a much slower built-in decoder without it).
- **The existing `pnpm start` script also launches `fingerprint-bridge`**
  (a native Windows DLL bridge for a SecuGen fingerprint reader, per the
  comments in `next.config.ts` — it's meant to run on a teller's local
  Windows machine, not the server, and its `koffi` native binding wouldn't
  load on Linux/Alpine anyway). The Docker image runs `node server.js`
  directly and never invokes `scripts/start-app.js` or the bridge.
- **Both `pnpm-lock.yaml` and `package-lock.json` exist.**
  `package.json`'s `"packageManager": "pnpm@9.12.0"` field makes pnpm
  authoritative; the Docker build only ever reads `pnpm-lock.yaml`. Consider
  deleting the stale `package-lock.json` to avoid confusion.
- **`next@15.1.9` has a known security vulnerability** — pnpm's install
  output flags this version directly
  (see https://nextjs.org/blog/security-update-2025-12-11). This wasn't
  changed automatically since a Next.js version bump can have breaking
  changes; upgrading to the latest patched 15.x release is strongly
  recommended before going to production.
- **Prisma uses the `@prisma/adapter-pg` driver adapter** — the runtime
  image still copies `node_modules/.prisma` and `node_modules/@prisma/client`
  explicitly as a safety net, since Prisma's query engine binary is a common
  gap in Next.js standalone output tracing.

## Contributing

1. Create a feature branch
2. Make changes
3. Write tests
4. Submit PR

## License

MIT
