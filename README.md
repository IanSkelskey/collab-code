<p align="center">
  <img src="public/logo.svg" alt="Collab Code Logo" width="96" />
</p>

<h1 align="center">Collab Code</h1>

<p align="center">
  Collaborative coding rooms for classrooms, tutoring sessions, and pair programming.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta--6-blue?style=flat&labelColor=555" alt="Version 1.0.0-beta-5" />
</p>

<p align="center">
  <a href="https://ianskelskey.github.io/collab-code"><img src="https://img.shields.io/badge/Try%20it%20live%20%E2%86%92-059669?style=for-the-badge&logo=rocket&logoColor=white" alt="Try it live" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/Contributing-Guide-111827?style=for-the-badge&logo=github&logoColor=white" alt="Contributing Guide" /></a>
</p>

<p align="center">
  Share a room link, edit the same workspace in Monaco, use one shared terminal session, manage files together, and run Java from the browser through a lightweight relay server.
</p>

## Why Collab Code

Collab Code is built for the "open a link and start coding" workflow. It is meant to feel more like a shared coding room than a demo editor: multiple files, a real explorer, a shared terminal, search, diagnostics, and live collaboration all sit in the same browser-first workspace.

It is especially suited to tutoring, CS education, pair programming, and collaborative walkthroughs where setup friction gets in the way.

## Highlights

| Collaboration | Workspace | Execution |
|---|---|---|
| Live cursors, selections, peer presence, room sharing, shared terminal session | Multi-file explorer, tabs, search/replace, drag-and-drop import, multi-select file actions | Interactive Java run flow, inline diagnostics, shared terminal I/O |

- **Collaborative editor** - Monaco + Yjs with live remote cursors, selections, and per-file awareness.
- **Collaborative terminal** - peers share the same terminal transcript, prompt state, working directory, and run session.
- **Real workspace** - folders, tabs, file icons, context menus, workspace search, export, and drag-and-drop file management.
- **Integrated terminal tools** - browse and modify the virtual filesystem without leaving the app.
- **Classroom-friendly sharing** - create or join a room instantly with no account flow.
- **Offline-friendly persistence** - IndexedDB keeps local workspace state around between reconnects.
- **Responsive UI** - explorer, search, editor, and terminal all adapt across desktop and smaller screens.

## Current Scope

- **Runnable language today:** Java
- **Editor/file support:** Java, TypeScript, JavaScript, Python, JSON, HTML, CSS, Markdown, C, C++, XML, and SQL
- **Best fit:** classrooms, tutoring sessions, collaborative exercises, code reviews, and quick pair-programming rooms

## Quick Start

### Try it live

Open the deployed app:

https://ianskelskey.github.io/collab-code

### Run it locally

```bash
npm install
npm run dev:all
```

Then open:

`http://localhost:5173/collab-code/`

For local development details, environment variables, architecture notes, deployment, and contributor workflow, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## What You Can Do

- Create or join a room from the landing page in a few seconds.
- Edit the same workspace with other people in real time.
- Share one terminal session with other peers, including `cd`, command history, terminal output, and interactive Java stdin/stdout/stderr.
- Search and replace across the entire workspace.
- Manage files with the explorer, drag-and-drop, multi-select actions, and the built-in terminal.
- Compile and run Java projects with streamed stdin, stdout, and stderr in the shared terminal.
- Export a file or the whole workspace when you are done.

## Built With

React, Vite, Monaco Editor, Yjs, xterm.js, and a small Node/WebSocket relay server.

## Contributing

Bug reports, feature ideas, and pull requests are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md).
