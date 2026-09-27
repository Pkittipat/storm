# stormm

pnpm monorepo: a React canvas for Event Storming business processes, where each process is a YAML file.

Everything runs in the browser. There is no server: processes and projects are kept in the browser's `localStorage`.

## Stack

- **apps/web** — React + Vite + TypeScript + Tailwind CSS v4
- **packages/process-model** — the process YAML v1 format: types, canonical writer, parser, validator, diff, derived layout and board edits ([spec](docs/process-yaml-v1.md))
- **packages/codegen** — R&D: process model → Go domain code (not used by the app)
- **packages/cli** — `stormm check` / `stormm changes` (plus `explain`, a reading aid for people): helpers for a process YAML; bundled into the plugin by `pnpm --filter @stormm/cli build`
- **plugins/stormm** — Claude Code plugin with the `storm-to-code` skill: process modeling coding: the storm is the domain design (model, interface, usage), and each project's own code decides how it's built ([README](plugins/stormm/README.md)). This repo is its marketplace: `/plugin marketplace add <this repo>` then `/plugin install stormm@stormm`

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)

## Setup

```bash
pnpm install
pnpm dev:web   # http://localhost:5173
```

## Where processes live

In this browser's `localStorage`:

```
stormm:processes     → [{ id, projectId }]   # the list, in creation order
stormm:process:<id>  → the process YAML       # canonical form; the only record of the process
stormm:projects      → [{ id, name }]
stormm:layout:<id>   → dragged block positions (a view preference, never in the YAML)
```

Every edit writes the whole YAML back straight away. Nothing leaves the browser — use **YAML → Download** to keep or share a process. Clearing site data deletes everything.

## What works

- **Processes** — create, rename (click the header title), delete, move between projects; each opens at `#/p/<id>`.
- **Canvas** — add blocks from the composer's `+` (connected from the selected block), drag from a block's right port onto another block to connect, click a connector to select it, Delete/Backspace to remove the selection. Drag on empty canvas to select the blocks inside a box (Shift adds), Shift-click to add or remove one, ⌘/Ctrl-A to select all; dragging a selected block moves the whole selection. ⌘/Ctrl-C copies the selected blocks and the connections between them as storm YAML; ⌘/Ctrl-V pastes them (into any process) with fresh ids. Scroll, Space-drag or middle-drag to pan; ⌘/Ctrl-scroll or the zoom control to zoom.
- **Layout** — positions are derived from the YAML (columns follow the connections; each connected group gets its own rows). Dragging a block is a personal view preference kept in localStorage next to the process; **Reset layout** clears it.
- **Inspector** — edit a block's title, actor, hotspots and fields; see what it connects from/to.
- **YAML** — the exact file as stored, its validation errors and warnings, copy and download.

## Other scripts

- `pnpm build` — build all apps
- `pnpm lint` — lint all apps
- `pnpm --filter @stormm/process-model test` — format tests
