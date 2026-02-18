# Collab Code — Collaborative Java IDE

A collaborative Java development environment for real-time pair programming. Share a link, code together with live cursors, and execute Java — all from the browser. Built for classroom/campus use with a lightweight WebSocket relay server.

## Features

- **Real-time collaborative editing** — Multiple users edit the same code simultaneously with live cursors and selections powered by [Yjs](https://github.com/yjs/yjs) CRDTs
- **WebSocket sync** — Reliable real-time collaboration through a lightweight y-websocket relay server (works on campus WiFi / NAT)
- **Java execution** — Compile and run Java code via [Judge0 CE](https://ce.judge0.com) through the relay server (free, no signup)
- **Inline diagnostics** — Compiler errors and warnings display as red/yellow underlines in the editor with hover tooltips
- **Integrated terminal** — Resizable, hideable xterm.js terminal panel for viewing compilation output, runtime results, and errors
- **Offline persistence** — Code is saved locally in IndexedDB and syncs on reconnect
- **One-click sharing** — Room ID is embedded in the URL hash. Click "Share" to copy the invite link
- **Copy & save** — Copy code to clipboard or download as a `.java` file

## Tech Stack

| Component | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Collaboration | Yjs + y-websocket + y-indexeddb + y-monaco |
| Java execution | Judge0 CE (proxied through relay server) |
| Terminal UI | xterm.js (`@xterm/xterm`) |
| Styling | Tailwind CSS v4 |
| Frontend hosting | GitHub Pages via GitHub Actions |
| Relay server | Node.js on Render (free tier) |

## Architecture

```
┌──────────────┐       wss://        ┌──────────────────────┐
│   Browser A  │◄────────────────────►│                      │
├──────────────┤                      │   Render Server      │
│   Browser B  │◄────────────────────►│   (y-websocket +     │
├──────────────┤                      │    Judge0 proxy)     │
│   Browser C  │◄────────────────────►│                      │
└──────────────┘                      └──────────┬───────────┘
                                                 │ https
                                          ┌──────▼──────┐
                                          │  Judge0 CE  │
                                          │  (compile   │
                                          │   & run)    │
                                          └─────────────┘
```

All browsers connect to a single lightweight relay server that:
1. **Syncs Yjs documents** between peers via WebSocket (y-websocket)
2. **Proxies code execution** requests to Judge0 CE

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
| `run` | Compile and execute the Java code |
| `clear` | Clear the terminal |
| `help` | Show available commands |

You can also click the **Run** button in the toolbar.

## Deployment

### Frontend (GitHub Pages)

Push to `main` and the included GitHub Actions workflow builds and deploys to GitHub Pages automatically. Make sure GitHub Pages is configured to deploy from **GitHub Actions** in your repo settings.

Set `VITE_WS_URL` in your `.env` to point to the deployed relay server:

```env
VITE_WS_URL=wss://your-server.onrender.com
```

### Relay Server (Render)

The `server/` directory contains a standalone Node.js server with its own `package.json`. Deploy to [Render](https://render.com) using the included `render.yaml` blueprint:

1. Push the repo to GitHub
2. In Render, create a new **Blueprint** pointing to the repo
3. Render reads `render.yaml` and deploys the server automatically

The server runs on the free tier with no additional configuration needed.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_WS_URL` | WebSocket URL for the relay server | `ws://localhost:4444` |
| `PORT` | Relay server port (server-side) | `4444` |
| `JUDGE0_HOST` | Judge0 CE hostname (server-side) | `ce.judge0.com` |

## Limitations

- **Java execution requires internet** — Code is proxied to Judge0 CE for compilation and execution
- **Render free tier** — The relay server spins down after inactivity; first connection after idle takes ~30s
- **Peer limit** — Optimized for 2–10 concurrent collaborators per room
- **No persistent rooms** — If all peers disconnect, the document only survives in each peer's local IndexedDB
