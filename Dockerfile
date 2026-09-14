# syntax=docker/dockerfile:1.7

# CI runners on flaky networks fail apk/npm with DNS or ECONNRESET errors, so
# every network-touching step retries with a backoff.

# ---------- deps (dev — needed for build) ----------
FROM node:20-alpine AS deps-dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev --omit=peer \
    || (sleep 10 && npm ci --include=dev --omit=peer) \
    || (sleep 30 && npm ci --include=dev --omit=peer)

# ---------- deps (production only) ----------
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --omit=peer \
    || (sleep 10 && npm ci --omit=dev --omit=peer) \
    || (sleep 30 && npm ci --omit=dev --omit=peer)

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_OIDC_ENABLED=true
RUN npx prisma generate \
    || (sleep 10 && npx prisma generate) \
    || (sleep 30 && npx prisma generate)
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl tini \
    || (sleep 5 && apk add --no-cache openssl tini) \
    || (sleep 20 && apk add --no-cache openssl tini)
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
RUN npm install -g tsx \
    || (sleep 10 && npm install -g tsx) \
    || (sleep 30 && npm install -g tsx)

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.scripts.json ./tsconfig.scripts.json

# Entrypoint: run prisma migrations then start
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["npm", "start"]