# =============================================================
# Mise Backoffice — Production Dockerfile
# Multi-stage build for minimal image size
# =============================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# ---- Stage 1: Dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Builder ----
# Inherit the dependency layer instead of copying node_modules into a second
# layer. This keeps production builds viable on the intentionally small host
# volume without changing the resulting standalone runtime image.
FROM deps AS builder
COPY . .

# Next.js telemetrie aus
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env-vars (Platzhalter — echte werden per Build-Arg reingereicht)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Build-Gate 1: Leere Build-Args bauen sonst GRÜN durch und Push/Auth sind still tot.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" || (echo "FEHLER: NEXT_PUBLIC_SUPABASE_URL fehlt (Build-Arg)" && exit 1)
RUN test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || (echo "FEHLER: NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (Build-Arg)" && exit 1)
RUN test -n "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" || (echo "FEHLER: NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt (Build-Arg)" && exit 1)

# Build-Gate 2: delivery-kritischer Typecheck (next.config ignoriert Build-Fehler,
# tsconfig.delivery-hardening.json ist das wirksame Gate für den Fahrer-Pfad).
RUN pnpm typecheck:delivery

# Font-Cache persistent über Builds (BuildKit-Cache): next/font lädt Google-Fonts
# zur Build-Zeit — ohne Cache killt jeder CDN-Schluckauf den Deploy (3× passiert).
RUN --mount=type=cache,id=nextfont-cache,target=/app/node_modules/.cache pnpm build

# ---- Stage 3: Runner (production) ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root User
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
