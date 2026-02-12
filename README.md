# Collab Code — Collaborative Java IDE

A serverless collaborative Java development environment that runs entirely in the browser. Share a link, code together in real-time, and execute Java — no backend required. Built for free hosting on GitHub Pages.

## Features

- **Real-time collaborative editing** — Multiple users edit the same code simultaneously with live cursors and selections powered by [Yjs](https://github.com/yjs/yjs) CRDTs
- **Peer-to-peer sync** — No server needed. Peers connect directly via WebRTC using public signaling servers
- **Java execution** — Compile and run Java code via the [Piston API](https://github.com/engineer-man/piston) (free, no signup)
- **Integrated terminal** — xterm.js-based terminal panel for viewing compilation output, runtime results, and errors
- **Offline persistence** — Code is saved locally in IndexedDB and syncs on reconnect
- **One-click sharing** — Room ID is embedded in the URL hash. Click "Share" to copy the invite link

## Tech Stack

| Component | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Collaboration | Yjs + y-webrtc + y-indexeddb + y-monaco |
| Java execution | Piston API (cloud) |
| Terminal UI | xterm.js (`@xterm/xterm`) |
| Styling | Tailwind CSS v4 |
| Deployment | GitHub Pages via GitHub Actions |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173/collab-code/` in your browser.

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

Push to `main` and the included GitHub Actions workflow builds and deploys to GitHub Pages automatically. Make sure GitHub Pages is configured to deploy from **GitHub Actions** in your repo settings.

## Limitations

- **Java execution requires internet** — Code is sent to the Piston API for compilation (5 req/sec rate limit)
- **Signaling servers** — WebRTC peer discovery uses free public signaling servers (`signaling.yjs.dev`) with no SLA
- **Peer limit** — Optimized for 2–5 concurrent collaborators
- **No persistent rooms** — If all peers disconnect, the document only survives in each peer's local IndexedDB
