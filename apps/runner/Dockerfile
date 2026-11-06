FROM node:22-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/runner/package.json apps/runner/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/arkiv/package.json packages/arkiv/package.json
COPY packages/intent/package.json packages/intent/package.json
COPY packages/chain/package.json packages/chain/package.json
COPY packages/solver-sdk/package.json packages/solver-sdk/package.json
COPY scripts/package.json scripts/package.json
COPY solver-template/package.json solver-template/package.json

RUN pnpm install --frozen-lockfile --filter @rival/runner...

COPY specs specs
COPY apps/runner apps/runner
COPY packages packages
COPY tsconfig.base.json tsconfig.base.json

FROM node:22-slim

RUN groupadd --gid 1001 runner \
  && useradd --uid 1001 --gid runner --create-home --shell /usr/sbin/nologin runner \
  && mkdir -p /data \
  && chown runner:runner /data

WORKDIR /app
COPY --from=build --chown=runner:runner /app /app

USER runner
WORKDIR /app/apps/runner
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/server.ts"]
