# syntax=docker/dockerfile:1

###############################################################################
# base — Node 22 Alpine + pnpm, pinned to the version in package.json's
# "packageManager" field so local, CI, and container installs stay identical.
###############################################################################
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

###############################################################################
# deps — install dependencies once, cached across builds.
###############################################################################
FROM base AS deps
WORKDIR /app

# "puppeteer" is a declared dependency but is not imported anywhere in the
# app (only mentioned in a code comment). Skip its ~300MB Chromium download
# so the image stays small and the build stays fast.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json pnpm-lock.yaml .npmrc ./
# schema.prisma must exist before install: "postinstall" runs "prisma generate".
COPY prisma ./prisma

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

###############################################################################
# builder — produce the Next.js standalone production build.
###############################################################################
FROM base AS builder
WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they must arrive as build args (wired up in docker-compose.yml's "args:").
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_CURRENCY
ARG NEXT_PUBLIC_COUNTRY_CODE
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_CURRENCY=$NEXT_PUBLIC_CURRENCY \
    NEXT_PUBLIC_COUNTRY_CODE=$NEXT_PUBLIC_COUNTRY_CODE

# Build-time-only placeholders so modules that read these at import time
# (e.g. prisma/db.ts, next-auth, and ~15 route handlers that do
# `new Resend(process.env.RESEND_API_KEY!)` at module scope, which throws
# synchronously during "next build"'s page-data collection if unset) don't
# crash "next build". Real secrets are injected at container runtime via
# docker-compose's env_file and are never baked into the image or a layer.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db"
ARG NEXTAUTH_SECRET="build-time-placeholder"
ARG NEXTAUTH_URL="http://localhost:3002"
ARG RESEND_API_KEY="re_build_time_placeholder"
ENV DATABASE_URL=$DATABASE_URL \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    NEXTAUTH_URL=$NEXTAUTH_URL \
    RESEND_API_KEY=$RESEND_API_KEY

RUN pnpm build

###############################################################################
# migrator — full node_modules incl. the Prisma CLI, used only for one-off
# `prisma migrate deploy` runs. Not part of the lean runtime image.
###############################################################################
FROM deps AS migrator
WORKDIR /app
COPY prisma ./prisma
ENTRYPOINT ["pnpm", "exec", "prisma"]
CMD ["migrate", "deploy"]

###############################################################################
# runner — minimal, non-root production image.
###############################################################################
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Safety net: Next.js output-file-tracing usually bundles Prisma's generated
# client automatically for "output: standalone", but the Prisma query-engine
# binary is a well-known tracing edge case — copy it explicitly so the app
# never fails at runtime with "Query Engine could not be found".
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3002/api/health || exit 1

CMD ["node", "server.js"]
