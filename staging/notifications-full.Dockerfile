FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://build_only@127.0.0.1:1/build_only npx prisma generate
RUN DATABASE_URL=postgresql://build_only@127.0.0.1:1/build_only NEXT_TELEMETRY_DISABLED=1 npm run build
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache curl
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/staging/notifications-operator.sql ./staging/notifications-operator.sql
EXPOSE 3000
# Real Next routing/authentication, no custom production server or workers.
CMD ["node","node_modules/next/dist/bin/next","start","--hostname","0.0.0.0"]
