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

The web dev server proxies `/api/*` to the API (override the target with `API_URL`), so the browser never makes cross-origin calls.

## What works

- **Processes** — create, rename (click the header title), delete; each has a shareable `#/p/<id>` URL.
- **Canvas** — add blocks from the composer's `+` (a new block continues the flow from the selected one and is auto-connected), drag to move (snaps to a 20px grid), drag from a block's right port onto another block to connect, click a connector to select it, Delete/Backspace to remove the selection. Scroll to pan, ⌘/Ctrl-scroll or the zoom control to zoom.
- **Inspector** — edit a block's title, actor, hotspots and fields; the Flow list shows what it connects from/to; the Code tab previews its generated Go.
- **Generate code** — downloads one `.go` file for the whole process (commands/events/read models → structs, aggregate → struct + a method per incoming command recording its outgoing events + repository interface, policy → handler for its triggering event).

Everything persists to Postgres through the API (`GET/POST /processes`, `GET/PATCH/DELETE /processes/:id`, `POST /processes/:id/blocks`, `PATCH/DELETE /blocks/:id`, `POST /processes/:id/connections`, `DELETE /connections/:id`).

## Other scripts

- `pnpm build` — build all apps
- `pnpm lint` — lint all apps
- `pnpm prisma:generate` — regenerate the Prisma client
- `pnpm --filter api prisma:studio` — open Prisma Studio
- `pnpm db:down` — stop Postgres
