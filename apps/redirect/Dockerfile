# Build context is the repository root (Forge target rootDirectory: apps/redirect).
FROM oven/bun:1.3.14-slim AS dependencies
WORKDIR /workspace
ENV HUSKY=0
COPY --parents package.json bun.lock legacy/package.json apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --production --ignore-scripts --filter @shortn/redirect

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=dependencies /workspace ./
COPY packages packages
COPY apps/redirect apps/redirect
USER bun
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT ?? '3002') + '/__health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["bun", "apps/redirect/src/index.ts"]
