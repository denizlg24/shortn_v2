# Build context is the repository root (Forge target rootDirectory: legacy).
FROM oven/bun:1.3.14-slim AS dependencies
WORKDIR /workspace
ENV HUSKY=0

COPY --parents package.json bun.lock legacy/package.json apps/*/package.json packages/*/package.json ./
# No --ignore-scripts: canvas fetches its prebuilt native binary in an install script.
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY legacy legacy
COPY packages packages
ENV NEXT_TELEMETRY_DISABLED=1
# The legacy build validates env at import time and reads bio pages from Mongo
# for generateStaticParams, so it needs the target's env during the build.
RUN --mount=type=secret,id=forge-env,required=false \
  if [ -f /run/secrets/forge-env ]; then set -a; . /run/secrets/forge-env; set +a; fi; \
  bun run --cwd legacy build

# glibc runtime: canvas ships glibc prebuilds.
FROM node:24-trixie-slim AS runtime
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /workspace/legacy/.next/standalone ./
COPY --from=build --chown=node:node /workspace/legacy/.next/static ./legacy/.next/static
COPY --from=build --chown=node:node /workspace/legacy/public ./legacy/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api',{redirect:'manual'}).then(r=>process.exit(r.status>=200&&r.status<400?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "legacy/server.js"]
