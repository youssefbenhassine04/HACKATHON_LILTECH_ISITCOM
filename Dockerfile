# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the React SPA (type-check + Vite bundle)
# Debian slim (glibc) is used because TypeScript 7 ships native platform
# binaries and musl-based Alpine has no matching build.
# ---------------------------------------------------------------------------
FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — runtime: Express API serves both /api and the built SPA
# ---------------------------------------------------------------------------
FROM node:24-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

# Only production dependencies: `tsx` runs the TypeScript server directly.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Server code; it imports the shared seed data and types from src/.
COPY server ./server
COPY src ./src

# Built SPA from stage 1.
COPY --from=build /app/dist ./dist

USER node

EXPOSE 3001

# Ready once the API answers and the database connection is established.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => r.json()).then(b => process.exit(b.isPostgresConnected ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
