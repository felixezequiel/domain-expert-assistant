# syntax=docker/dockerfile:1

# ── Stage 1: build the React/Vite admin SPA (served by the app at /, ADR-023) ──
FROM node:24-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Stage 2: runtime — Node 24 running TypeScript on-the-fly via SWC (no build step) ──
FROM node:24-slim AS runtime
WORKDIR /app
# Dev image: NODE_ENV=development keeps devDependencies (the SWC runtime) installed and the
# session cookie non-Secure, so login works over plain HTTP on localhost.
ENV NODE_ENV=development

COPY package.json package-lock.json ./
# Drop the project's `prepare` (git hooks) — irrelevant in a container — but KEEP dependency
# install scripts so onnxruntime-node (the embedder's native backend, ADR-017) fetches its binary.
RUN npm pkg delete scripts.prepare && npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY --from=web-build /app/web/dist ./web/dist

EXPOSE 3000 4000
# Migrations run automatically on boot (DatabaseFactory.migrator.up()), then the REST + GraphQL
# servers start and the SPA is served from web/dist.
CMD ["npm", "start"]
