FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npx prisma generate
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    DATABASE_URL=postgresql://build_only@127.0.0.1:1/build_only NEXT_TELEMETRY_DISABLED=1 npm run build

RUN node scripts/notifications/build-tools.mjs

RUN mkdir -p /runtime && \
    mkdir -p /runtime && \
    cp -a /app/.next /runtime/.next && \
    mkdir -p /runtime && \
    cp -a /app/public /runtime/public && \
    mkdir -p /runtime && \
    cp -a /app/dist/notification-tools /runtime/notification-tools && \
    mkdir -p /runtime/ && \
    cp -a /app/package*.json /runtime/ && \
    mkdir -p /runtime && \
    cp -a /app/node_modules /runtime/node_modules && \
    mkdir -p /runtime/ && \
    cp -a /app/next.config.mjs /runtime/ && \
    mkdir -p /runtime && \
    cp -a /app/server.mjs /runtime/server.mjs && \
    mkdir -p /runtime && \
    cp -a /app/driversinfo-pusher.js /runtime/driversinfo-pusher.js && \
    mkdir -p /runtime/src/lib && \
    cp -a /app/src/lib/fleet-lifecycle.mjs /runtime/src/lib/fleet-lifecycle.mjs && \
    mkdir -p /runtime/scripts && \
    cp -a /app/scripts/sms-schema-bootstrap.mjs /runtime/scripts/sms-schema-bootstrap.mjs && \
    mkdir -p /runtime/scripts && \
    cp -a /app/scripts/webhook-provider-bootstrap.mjs /runtime/scripts/webhook-provider-bootstrap.mjs && \
    mkdir -p /runtime/scripts && \
    cp -a /app/scripts/booking-recovery-deduplicate.mjs /runtime/scripts/booking-recovery-deduplicate.mjs && \
    mkdir -p /runtime/scripts && \
    cp -a /app/scripts/crm-effects-worker.mjs /runtime/scripts/crm-effects-worker.mjs && \
    mkdir -p /runtime/src/lib && \
    cp -a /app/src/lib/scheduler-result.mjs /runtime/src/lib/scheduler-result.mjs && \
    mkdir -p /runtime/src && \
    cp -a /app/src/generated /runtime/src/generated && \
    mkdir -p /runtime && \
    cp -a /app/prisma /runtime/prisma && \
    mkdir -p /runtime && \
    cp -a /app/prisma.config.ts /runtime/prisma.config.ts

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /runtime/ ./


EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http:'+'//127.0.0.1:3000/api/health',{cache:'no-store'}).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
