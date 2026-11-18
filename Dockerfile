# Dependencies: the only stage that may use the network (npm registry, and corepack fetching pnpm).
FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod=false

# Build: shared rules, the NestJS API and the Angular app, then a production-only copy of the API with its
# dependencies. None of it may touch the network (fonts are self-hosted in apps/web/public/fonts, and the
# store from the stage above already holds every package), so anything that tries to download fails here
# every time instead of breaking CI or a deploy now and then.
FROM dependencies AS builder
ENV NG_CLI_ANALYTICS=false
COPY . .
RUN --network=none pnpm --filter @grimoire/shared build \
  && pnpm --filter @grimoire/api build \
  && pnpm --filter @grimoire/web build \
  && pnpm --filter @grimoire/api deploy --legacy --prod --offline /out

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 WEB_DIST=/app/web
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 grimoire
COPY --from=builder --chown=grimoire:nodejs /out/package.json ./
COPY --from=builder --chown=grimoire:nodejs /out/node_modules ./node_modules
COPY --from=builder --chown=grimoire:nodejs /out/dist ./dist
COPY --from=builder --chown=grimoire:nodejs /app/apps/web/dist/web/browser ./web
USER grimoire
EXPOSE 3000
CMD ["node", "dist/main.js"]
