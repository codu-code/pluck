# One image for the web app and the worker (hosted or self-hosted). The worker runs the same code with
# `pnpm --filter @pluck/web worker`; see docker-compose.yml.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
# The build imports the server modules; these placeholders satisfy them and are never connected to.
# The runtime stage below starts clean; real values come from docker-compose.yml or your environment.
ENV MONGODB_URI=mongodb://build-only:27017/pluck BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime
COPY . .
RUN pnpm install --frozen-lockfile --filter "@pluck/web..." \
 && pnpm --filter @pluck/web build

FROM node:22-bookworm-slim
RUN corepack enable && useradd --create-home --uid 10001 pluck && mkdir -p /data && chown pluck /data
WORKDIR /app
COPY --from=build --chown=pluck /app /app
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/pluck-entrypoint
USER pluck
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["pluck-entrypoint"]
CMD ["pnpm", "--filter", "@pluck/web", "exec", "next", "start", "-p", "3000"]
