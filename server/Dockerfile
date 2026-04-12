# syntax=docker/dockerfile:1
# Minimal runtime: production deps only, non-root, pinned major Node Alpine
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
ENV NODE_ENV=production
# Dedicated system user/group (no shell login)
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nodejs
WORKDIR /app
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health',(r)=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1));}).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
