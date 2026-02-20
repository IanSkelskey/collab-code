<p align="center">
  <img src="public/logo.svg" alt="Collab Code Logo" width="96" />
</p>

<h1 align="center">Collab Code — Collaborative Java IDE</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta-blue?style=flat&labelColor=555" alt="Version 1.0.0-beta" />
</p>

<p align="center">
  <a href="https://github.com/IanSkelskey/collab-code/deployments/github-pages"><img src="https://img.shields.io/github/deployments/IanSkelskey/collab-code/github-pages?style=for-the-badge&label=Client&logo=github&logoColor=white&color=059669" alt="Client" /></a>
  <a href="https://github.com/IanSkelskey/collab-code/deployments/master%20-%20collab-code-sync"><img src="https://img.shields.io/github/deployments/IanSkelskey/collab-code/master%20-%20collab-code-sync?style=for-the-badge&label=Server&logo=node.js&logoColor=white&color=059669" alt="Server" /></a>
</p>

A collaborative Java development environment for real-time pair programming. Share a link, code together with live cursors, and execute Java — all from the browser. Built for classroom/campus use with a lightweight WebSocket relay server.

## Features

- **Real-time collaborative editing** — Multiple users edit the same code simultaneously with live cursors and selections powered by [Yjs](https://github.com/yjs/yjs) CRDTs
- **Multi-file workspace** — Full virtual filesystem with file explorer, tab bar, and directory support — all synced across peers
- **Drag-and-drop file management** — Move files and folders visually in the explorer, or use the `mv` command in the terminal
- **Peer presence indicators** — See who's editing which file via colored avatar dots on tabs and live cursor labels in the editor
- **Interactive Java execution** — Compile and run multi-file Java projects with real-time stdin/stdout streaming via WebSocket
- **Inline diagnostics** — Compiler errors and warnings display as red/yellow underlines in the editor with hover tooltips
- **Integrated terminal** — Resizable, hideable xterm.js terminal with a full set of shell commands (`ls`, `cd`, `mkdir`, `touch`, `rm`, `mv`, `cat`, `pwd`) and command history (Up/Down arrow)
- **Keyboard shortcuts** — `Ctrl+Enter` run, `Ctrl+S` save file, `Ctrl+Shift+S` save all as .zip, `Alt+N` new file, `Alt+Shift+N` new folder, `Ctrl+B` toggle explorer, `` Ctrl+` `` toggle terminal
- **Save & export** — Download the current file or the entire workspace as a `.zip` via a dropdown menu
- **Destructive action safety** — Undo toast for single-file deletions (5 s window) and confirmation dialog for non-empty directory deletions
- **Offline persistence** — Files are saved locally in IndexedDB and sync on reconnect
- **One-click sharing** — Room ID is embedded in the URL hash. Click "Share" to copy the invite link
- **Responsive design** — Adapts to mobile and desktop with resizable panels, collapsible explorer, and touch support

## Tech Stack

| Component | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Collaboration | Yjs + y-websocket + y-indexeddb + y-monaco |
| Java execution | Interactive via WebSocket (server-side `javac`/`java`), Judge0 CE fallback |
| Terminal UI | xterm.js (`@xterm/xterm`) |
| Styling | Tailwind CSS v4 |
| Zip export | JSZip |
| Frontend hosting | GitHub Pages via GitHub Actions |
| Relay server | Node.js on Render (Docker, free tier) |

## Architecture

```
┌──────────────┐       wss://        ┌──────────────────────┐
│   Browser A  │◄────────────────────►│                      │
├──────────────┤                      │   Render Server      │
│   Browser B  │◄────────────────────►│   (y-websocket +     │
├──────────────┤                      │    interactive Java   │
│   Browser C  │◄────────────────────►│    execution)        │
└──────────────┘                      └──────────────────────┘
```

All browsers connect to a single lightweight relay server that:
1. **Syncs Yjs documents** between peers via WebSocket (y-websocket)
2. **Executes Java interactively** — compiles multi-file projects with `javac` and streams stdin/stdout/stderr in real time over a dedicated `/exec` WebSocket endpoint
3. **Syncs output files** — files created or modified by the Java program are sent back to the workspace

## Getting Started

### Run everything locally

```bash
npm install
npm run dev:all
```

This starts both the Vite dev server and the WebSocket relay server (`localhost:4444`).

Open `http://localhost:5173/collab-code/` in your browser.

### Run individually

```bash
# Frontend only (uses VITE_WS_URL from .env for the relay server)
npm run dev

# Relay server only
npm run dev:server
```

### Test collaboration locally

Open two browser tabs to the same URL (e.g. `http://localhost:5173/collab-code/#myroom`). Edits in one tab appear in the other with colored cursors.

## Terminal Commands

| Command | Description |
|---|---|
| `run` | Compile and execute the Java project |
| `ls [dir]` | List files in current or specified directory |
| `cd <dir>` | Change working directory |
| `mkdir <dir>` | Create a directory |
| `touch <file>` | Create an empty file |
| `rm <file>` | Remove a file (with undo toast) |
| `rm -r <dir>` | Remove a directory recursively (with confirmation) |
| `mv <src> <dest>` | Move or rename a file/directory |
| `cat <file>` | Print file contents |
| `pwd` | Print working directory |
| `clear` | Clear the terminal |
| `reset` | Clear room data and reload |
| `help` | Show available commands |

**Tip:** Use Up/Down arrow keys to navigate command history.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run code |
| `Ctrl+S` | Download current file |
| `Ctrl+Shift+S` | Download workspace as .zip |
| `Alt+N` | New file |
| `Alt+Shift+N` | New folder |
| `Ctrl+B` | Toggle file explorer |
| `` Ctrl+` `` | Toggle terminal |

## Deployment

### Frontend (GitHub Pages)

Push to `main` and the included GitHub Actions workflow builds and deploys to GitHub Pages automatically. Make sure GitHub Pages is configured to deploy from **GitHub Actions** in your repo settings.

Set `VITE_WS_URL` in your `.env` to point to the deployed relay server:

```env
VITE_WS_URL=wss://your-server.onrender.com
```

### Relay Server (Render)

The `server/` directory contains a standalone Node.js server with its own `package.json` and `Dockerfile`. Deploy to [Render](https://render.com) using the included `render.yaml` blueprint:

1. Push the repo to GitHub
2. In Render, create a new **Blueprint** pointing to the repo
3. Render reads `render.yaml` and deploys the server automatically

The Docker image includes a JDK so Java compilation and execution happen on the server.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_WS_URL` | WebSocket URL for the relay server | `ws://localhost:4444` |
| `PORT` | Relay server port (server-side) | `4444` |
| `HOST` | Relay server bind address (server-side) | `0.0.0.0` |
| `JUDGE0_HOST` | Judge0 CE hostname — fallback execution (server-side) | `ce.judge0.com` |

## Limitations

- **Java execution requires the server** — Code is compiled and run on the relay server (or proxied to Judge0 CE as fallback)
- **Render free tier** — The relay server spins down after inactivity; first connection after idle takes ~30s
- **Peer limit** — Optimized for 2–10 concurrent collaborators per room
- **No persistent rooms** — If all peers disconnect, the document only survives in each peer's local IndexedDB
