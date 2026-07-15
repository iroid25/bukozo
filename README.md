RBAC => https://claude.ai/chat/5f6fe7be-2487-4a32-a466-7d4ba286e735

# Role-Based Access Control (RBAC) NextJS Application
## Added changes
## Made changes

A comprehensive Next.js application with Role-Based Access Control, authentication, and authorization features.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Authentication Setup](#authentication-setup)
- [Usage](#usage)
- [Authorization](#authorization)

## Prerequisites

- Node.js 18 or later
- PNPM package manager
- PostgreSQL database (we're using Neon DB)
- Git

## Getting Started

1. Clone the repository:

```bash
git clone [your-repo-url]
cd [your-repo-name]
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables (see next section)
4. Initialize the database
5. Start the development server:

```bash
pnpm dev
```

## Environment Variables

Create a `.env` file in the root directory and add the following variables:

### Database Configuration

```env
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"
```

To get this:

1. Create an account at [Neon DB](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Replace placeholders with your credentials

### Authentication Providers

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set homepage URL to `http://localhost:3000`
4. Set callback URL to `http://localhost:3000/api/auth/callback/github`
5. Copy credentials and add to `.env`:

```env
GITHUB_CLIENT_ID="your_client_id"
GITHUB_SECRET="your_client_secret"
```

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable OAuth 2.0
4. Configure OAuth consent screen
5. Create credentials (OAuth client ID)
6. Set authorized redirect URI to `http://localhost:3000/api/auth/callback/google`
7. Add to `.env`:

```env
GOOGLE_CLIENT_ID="your_client_id"
GOOGLE_CLIENT_SECRET="your_client_secret"
```

### NextAuth Configuration

Generate a secret using:

```bash
openssl rand -base64 32
```

Add to `.env`:

```env
NEXTAUTH_SECRET="your_generated_secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### Email Service (Resend)

1. Create account at [Resend](https://resend.com)
2. Get API key and add to `.env`:

```env
RESEND_API_KEY="your_api_key"
```

### File Upload (UploadThing)

1. Create account at [UploadThing](https://uploadthing.com)
2. Get API key and add to `.env`:

```env
UPLOADTHING_TOKEN='your_token'
```

## Database Setup

1. Push the schema to your database:

```bash
pnpm prisma db push
```

2. Seed the database with initial data:

```bash
pnpm prisma db seed
```

This will create:

- Default roles (Admin and User)
- Admin user (email: admin@admin.com, password: Admin@2025)
- Regular user (email: user@user.com, password: User@2025)

## Authorization

### Server-Side Protection

```typescript
// In server components
import {
  getServerPermissions,
  PermissionGate,
} from "@/utils/server-permissions";

export default async function ProtectedPage() {
  const { hasPermission } = await getServerPermissions();

  // Direct permission check
  if (!hasPermission("users.read")) {
    return <NotAuthorized />;
  }

  // Using PermissionGate component
  return (
    <div>
      <h1>Users Page</h1>
      <PermissionGate permission="users.create">
        <button>Create User</button>
      </PermissionGate>
    </div>
  );
}
```

### Client-Side Protection

```typescript
// In client components
"use client";
import { usePermission } from "@/hooks/usePermission";

export default function UserTable() {
  const { hasPermission } = usePermission();

  return (
    <div>{hasPermission("users.create") && <button>Create User</button>}</div>
  );
}
```

## Available Permissions

The system includes permissions for:

- Dashboard management
- User management
- Role management
- Sales and orders
- Inventory management
- Settings and configurations
- Reports and analytics

Each module has these permission types:

- `create`: Create new items
- `read`: View items
- `update`: Modify existing items
- `delete`: Remove items

Example: `users.create`, `users.read`, etc.

## Development Guidelines

1. Always use permission checks for protected routes
2. Use server-side checks when possible
3. Client-side checks are for UI elements only
4. Keep permissions consistent with the schema
5. Test both authenticated and unauthenticated states

## Common Issues

1. Database connection issues:

   - Check if your DATABASE_URL is correct
   - Ensure your IP is allowed in Neon DB

2. Authentication issues:

   - Verify callback URLs in OAuth providers
   - Check NEXTAUTH_URL setting

3. Permission issues:
   - Run database seed
   - Check user role assignments
   - Verify permission strings match exactly

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
