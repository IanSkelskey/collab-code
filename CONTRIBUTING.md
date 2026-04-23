# Contributing to Collab Code

This document covers local development, contributor workflow, architecture, deployment, and a few user-facing references that are helpful while working on the project.

## Prerequisites

- Node.js 20+
- npm
- A JDK available on `PATH` if you want interactive Java execution locally (`javac` and `java`)
- Python 3 with `venv` support available on `PATH` if you want interactive Python execution locally (`python3 -m venv --help` or equivalent)

## Local Development

### Run everything

```bash
npm install
npm run dev:all
```

This starts:

- the Vite frontend
- the local WebSocket relay / Java execution server on port `4444`

Open:

`http://localhost:5173/collab-code/`

### Run services individually

```bash
# Frontend only
npm run dev

# Relay server only
npm run dev:server
```

If you run the frontend by itself against a non-local relay server, set `VITE_WS_URL` in `.env`.

## Scripts

| Command                  | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Start the Vite frontend                                              |
| `npm run dev:server`     | Start the local relay / Java execution server                        |
| `npm run dev:all`        | Start frontend and server together                                   |
| `npm run build`          | Type-check and build the frontend                                    |
| `npm run typecheck`      | Run `tsc -b --noEmit` without emitting output                        |
| `npm run lint`           | Run ESLint                                                           |
| `npm run format`         | Format the repo with Prettier (writes changes)                       |
| `npm run prettier-check` | Check formatting without writing (used by `verify` and CI)           |
| `npm run verify`         | Run prettier-check → lint → typecheck → build. Required before a PR. |
| `npm run preview`        | Preview the production frontend build                                |
| `npm run start:server`   | Start the relay server without Vite                                  |

## Environment Variables

| Variable      | Description                        | Default               |
| ------------- | ---------------------------------- | --------------------- |
| `VITE_WS_URL` | WebSocket URL for the relay server | `ws://localhost:4444` |
| `PORT`        | Relay server port                  | `4444`                |
| `HOST`        | Relay server bind address          | `0.0.0.0`             |

## Local Collaboration Testing

To test live collaboration locally:

1. Run `npm run dev:all`.
2. Open two browser tabs to the same room URL, for example `http://localhost:5173/collab-code/#demo-room`.
3. Edit in one tab and confirm that cursors, selections, workspace changes, and execution output stay in sync.

## Architecture Overview

At a high level:

- the frontend lives in `src/`
- the relay / execution server lives in `server/`
- Yjs documents are synced over WebSocket room connections
- Java execution is handled through a dedicated `/exec` WebSocket endpoint

The relay server does three main jobs:

1. Sync Yjs workspace documents between peers.
2. Compile and run Java code, or create isolated Python virtual environments and execute Python code.
3. Stream stdin, stdout, stderr, and generated output files back to the browser workspace.

## Repo Map

| Path              | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `src/components/` | UI components                               |
| `src/hooks/`      | stateful UI / app hooks                     |
| `src/services/`   | pure-ish business logic and helpers         |
| `src/context/`    | React context contracts                     |
| `src/providers/`  | app/provider composition                    |
| `src/config/`     | language and app configuration              |
| `src/lib/`        | shared low-level utilities                  |
| `src/types/`      | shared TypeScript types                     |
| `server/`         | relay server and interactive Java execution |

## User-Facing Reference

### Terminal commands

| Command           | Description                                      |
| ----------------- | ------------------------------------------------ |
| `run`             | Run the current Java or Python target            |
| `ls [dir]`        | List files in the current or specified directory |
| `cd <dir>`        | Change working directory                         |
| `mkdir <dir>`     | Create a directory                               |
| `touch <file>`    | Create an empty file                             |
| `rm <file>`       | Remove a file                                    |
| `rm -r <dir>`     | Remove a directory recursively                   |
| `mv <src> <dest>` | Move or rename a file or directory               |
| `cp <src> <dest>` | Copy a file                                      |
| `cat <file>`      | Print file contents                              |
| `pwd`             | Print working directory                          |
| `clear`           | Clear the terminal                               |
| `reset`           | Clear room data and reload                       |
| `help`            | Show available commands                          |

When running Python, the relay creates a fresh virtual environment for each execution. If a `requirements.txt` exists alongside the selected entry file or in one of its parent folders, it is installed into that temporary environment before the script starts.

### Keyboard shortcuts

| Shortcut       | Action                       |
| -------------- | ---------------------------- |
| `Ctrl+Enter`   | Run code                     |
| `Ctrl+S`       | Download current file        |
| `Ctrl+Shift+S` | Download workspace as `.zip` |
| `Ctrl+Shift+F` | Search workspace             |
| `Alt+N`        | Start creating a new file    |
| `Alt+Shift+N`  | Start creating a new folder  |
| `Alt+Shift+F`  | Format the current document  |
| `Ctrl+B`       | Toggle the file explorer     |
| `` Ctrl+` ``   | Toggle the terminal          |

## Deployment Notes

### Frontend

The frontend is deployed to GitHub Pages with a base path of `/collab-code/`.

Release tags with a `v*` prefix are intended to be used for release/deploy flows. Make sure GitHub Pages is configured to deploy from GitHub Actions.

### Relay server

The relay server is set up for Render using `render.yaml`, with the Docker build defined in `server/Dockerfile`.

The Docker image installs a JDK plus Python virtual-environment support so Java compilation and isolated Python execution are available in production.

## Contribution Workflow

- Open an issue for bugs, regressions, or feature ideas when possible.
- Keep changes scoped and avoid bundling unrelated refactors together.
- Run `npm run verify` before opening a PR. It chains `prettier-check`, `lint`, `typecheck`, and `build` — the same set the CI workflow (`.github/workflows/`) runs on every push and pull request against `master`, so a green local run closes the loop before you push.
- If formatting fails, run `npm run format` to fix it, then re-run `npm run verify`.
- If you touch collaboration, execution, explorer, or editor behavior, test with at least two tabs in the same room.

## Releasing

When shipping a tagged release:

1. Make sure `master` is green in CI and `npm run verify` passes locally.
2. Bump `version` in `package.json` (and `package-lock.json` via `npm install`) to the target release, as a standalone `chore: release vX.Y.Z` commit.
3. Smoke-test the production build: `npm run build` and then `npm run preview`. Open a room, run some code, join from a second tab, and confirm sync still works.
4. Push the release commit, then tag it: `git tag vX.Y.Z && git push --tags`.
5. On GitHub, draft a new release from the tag. Copy the block from [`.github/RELEASE_TEMPLATE.md`](./.github/RELEASE_TEMPLATE.md) into the release body and fill in the placeholders: lead paragraph, "What's New", "Fixes & Internal", and a "Full changelog" link to the GitHub compare view against the previous tag. The release body on GitHub is the canonical copy — there are no tracked release notes in the repo itself.
6. Confirm the GitHub Pages deploy from the tag completes successfully and the hosted app loads.
