# stormm

pnpm monorepo: a React canvas for modeling business processes, and a NestJS API that stores each process as a version-controlled YAML file.

## Stack

- **apps/web** — React + Vite + TypeScript + Tailwind CSS v4
- **apps/api** — NestJS + class-validator; processes are YAML files (Prisma/Postgres is kept only for future accounts)
- **packages/process-model** — the process YAML v1 format: types, canonical writer, parser, validator, diff, derived layout and board edits ([spec](docs/process-yaml-v1.md))

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

## Development

```bash
pnpm dev:web   # http://localhost:5173
pnpm dev:api   # http://localhost:3000 (builds packages/process-model first)
```

The web dev server proxies `/api/*` to the API (override the target with `API_URL`), so the browser never makes cross-origin calls.

## Where processes live

Until GitHub is connected, a local folder stands in for the connected repositories (`STORMM_DATA_DIR`, default `apps/api/.stormm-data`, git-ignored):

```
.stormm-data/
  projects.json                                   # Stormm's side: projects (one repo each)
  repos/<project>/stormm/processes/<process>.yaml # the agreed process — the only record of it
  repos/_no-project/stormm/processes/…            # processes outside any project
```

Every save sends the whole YAML plus the version it was based on (the file's git blob SHA, as GitHub's contents API uses). The API refuses a save based on an old version (409) or with validation errors (422), and stores the file in canonical form.

`pnpm --filter api export:db` copies processes from the old Postgres tables into this folder (positions dropped; existing files are never overwritten).

## What works

- **Processes** — create, rename (click the header title), delete, move between projects; each has a shareable `#/p/<id>` URL.
- **Canvas** — add blocks from the composer's `+` (connected from the selected block), drag from a block's right port onto another block to connect, click a connector to select it, Delete/Backspace to remove the selection. Scroll to pan, ⌘/Ctrl-scroll or the zoom control to zoom.
- **Layout** — positions are derived from the YAML (columns follow the connections; each connected group gets its own rows). Dragging a block is a personal view preference kept in this browser's localStorage only; **Reset layout** clears it.
- **Inspector** — edit a block's title, actor, hotspots and fields; see what it connects from/to.
- **YAML** — the exact file as stored, its validation errors and warnings, copy and download.

API: `GET/POST /projects`, `PATCH/DELETE /projects/:id`, `GET/POST /processes`, `GET/PUT/PATCH/DELETE /processes/:id` (`PUT` = `{ yaml, baseVersion }`, `PATCH` = `{ projectId }`).

## Other scripts

- `pnpm build` — build all apps
- `pnpm lint` — lint all apps
- `pnpm --filter @stormm/process-model test` — format tests
- `pnpm --filter api test:e2e` — API tests (against a temporary data folder)
