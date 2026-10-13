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

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/scripts/sms-schema-bootstrap.mjs ./scripts/sms-schema-bootstrap.mjs
COPY --from=builder /app/scripts/webhook-provider-bootstrap.mjs ./scripts/webhook-provider-bootstrap.mjs
COPY --from=builder /app/scripts/booking-recovery-deduplicate.mjs ./scripts/booking-recovery-deduplicate.mjs
COPY --from=builder /app/src/lib/scheduler-result.mjs ./src/lib/scheduler-result.mjs
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http:'+'//127.0.0.1:3000/api/health',{cache:'no-store'}).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
