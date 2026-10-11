# Build context is the repository root (Forge target rootDirectory: apps/web).
FROM oven/bun:1.3.14-slim AS dependencies
WORKDIR /workspace
ENV HUSKY=0
COPY --parents package.json bun.lock legacy/package.json apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM node:24-trixie-slim AS build
WORKDIR /workspace
COPY --from=dependencies /workspace /workspace
COPY packages packages
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# The build needs no runtime secrets (env is parsed on first use); only the
# public asset origin is read at build time, from the target's env.
RUN --mount=type=secret,id=forge-env,required=false \
  if [ -f /run/secrets/forge-env ]; then set -a; . /run/secrets/forge-env; set +a; fi; \
  cd apps/web && node node_modules/next/dist/bin/next build

FROM node:24-trixie-slim AS runtime
WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
