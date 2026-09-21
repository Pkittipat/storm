# stormm

pnpm monorepo with a React frontend and a NestJS backend.

## Stack

- **apps/web** — React + Vite + TypeScript + Tailwind CSS v4
- **apps/api** — NestJS + Prisma (PostgreSQL) + class-validator

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker (for local Postgres)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up               # starts Postgres in Docker
pnpm prisma:migrate      # applies the Prisma schema
```

## Development

```bash
pnpm dev:web   # http://localhost:5173
pnpm dev:api   # http://localhost:3000
```

## Other scripts

- `pnpm build` — build all apps
- `pnpm lint` — lint all apps
- `pnpm prisma:generate` — regenerate the Prisma client
- `pnpm --filter api prisma:studio` — open Prisma Studio
- `pnpm db:down` — stop Postgres
