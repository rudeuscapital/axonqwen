# AxonQwen — Astro SSR + React
Enterprise AI Automation Platform · Server-Side Rendered · Zero Express

## Architecture

```
Browser → Astro Dev Server (:4321)
              ↓ SSR pages fetch data before render
              ↓ API routes handle all backend logic
              ↓ WebSocket at /_ws (ws package via middleware)
              ↓
         Ollama (:11434) → Qwen3.5
         Playwright (Chromium, headless)
         OpenClaw Gateway (:8080)
```

**Key design decisions:**
- `output: 'server'` + `@astrojs/node` adapter → standalone Node.js server
- All API endpoints are Astro `.ts` route files (no Express)  
- WebSocket server is attached to the same HTTP server via Astro middleware
- Server state (tasks, monitors, WS clients) lives on `globalThis` — survives hot reload in dev
- React components handle streaming chat and interactive UI

## Project Structure

```
axonqwen-astro/
├── src/
│   ├── pages/
│   │   ├── index.astro              # SSR Landing page + docs
│   │   ├── api/
│   │   │   ├── health.ts            # GET  /api/health
│   │   │   ├── chat.ts              # POST /api/chat (SSE stream)
│   │   │   ├── monitors.ts          # GET  /api/monitors
│   │   │   ├── ollama/status.ts     # GET  /api/ollama/status
│   │   │   ├── tasks/
│   │   │   │   ├── index.ts         # GET  /api/tasks
│   │   │   │   └── [id].ts          # GET/DELETE /api/tasks/:id
│   │   │   ├── browser/run.ts       # POST /api/browser/run
│   │   │   ├── scraper/run.ts       # POST /api/scraper/run
│   │   │   ├── vision/analyze.ts    # POST /api/vision/analyze
│   │   │   └── monitor/
│   │   │       ├── start.ts         # POST /api/monitor/start
│   │   │       └── [id].ts          # DELETE /api/monitor/:id
│   │   └── app/
│   │       ├── index.astro          # SSR Dashboard
│   │       ├── chat.astro           # SSR Chat page
│   │       ├── browser.astro        # SSR Browser RPA page
│   │       ├── scraper.astro        # SSR Scraper page
│   │       ├── vision.astro         # SSR Vision page
│   │       ├── monitor.astro        # SSR Monitor page
│   │       ├── tasks.astro          # SSR Tasks table
│   │       ├── agents.astro         # SSR Agents overview
│   │       ├── logs.astro           # SSR Log viewer
│   │       └── settings.astro       # SSR Settings
│   ├── middleware/
│   │   └── index.ts                 # WebSocket bootstrap
│   ├── lib/
│   │   ├── server.ts                # Server singletons: tasks, monitors, WS, Ollama
│   │   └── client.ts                # Browser API client + WS subscriber
│   ├── layouts/
│   │   ├── Base.astro               # HTML shell for landing
│   │   └── AppLayout.astro          # Dashboard shell with SSR sidebar
│   └── styles/
│       └── global.css               # Tailwind + design tokens
├── astro.config.mjs                 # output:'server', @astrojs/node
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── .env
```

## Setup

### Prerequisites

- **Node.js 18+** (`node --version`)
- **Ollama** — [ollama.ai](https://ollama.ai)
- **Qwen3.5 model** (~9 GB)

### 1. Install Ollama & Qwen3.5

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull the model
ollama pull qwen3.5
```

### 2. Install OpenClaw (optional, for persistent agent memory)

```bash
ollama launch openclaw --model qwen3.5
# OR
npm install -g @openclaw/cli && openclaw gateway start
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Configure environment
cp .env .env.local   # edit if needed

# Development
npm run dev
# → http://localhost:4321

# Production build
npm run build
npm start   # runs dist/server/entry.mjs
```

### 4. Open

| URL | Description |
|-----|-------------|
| `http://localhost:4321` | Landing page + docs |
| `http://localhost:4321/app` | Dashboard |
| `http://localhost:4321/api/health` | Health check |
| `ws://localhost:4321/_ws` | WebSocket events |

## How SSR Works

Each `app/*.astro` page fetches data **server-side** before rendering:

```astro
---
// app/index.astro
import { tasks, ollamaStatus } from '../../lib/server';

// This runs on the Node.js server per request
const allTasks = Array.from(tasks.values());
const ollamaOk = await ollamaStatus().then(() => true).catch(() => false);
---
<AppLayout>
  <!-- HTML rendered with real data, no client-side fetch needed -->
  <p>{allTasks.length} tasks, Ollama: {ollamaOk ? 'online' : 'offline'}</p>
</AppLayout>
```

**WebSocket** connects client-side for real-time updates (task events, logs, monitor alerts). Pages refresh themselves when relevant WS events arrive.

## API Routes

All routes are TypeScript files in `src/pages/api/`. They run server-side.

```typescript
// Example: src/pages/api/tasks/index.ts
import type { APIRoute } from 'astro';
import { tasks } from '../../../lib/server';

export const GET: APIRoute = () => {
  const list = Array.from(tasks.values());
  return Response.json({ tasks: list });
};
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen3.5` | Default model |
| `OPENCLAW_PORT` | `8080` | OpenClaw gateway port |
| `OPENCLAW_TOKEN` | — | OpenClaw auth token |
| `PORT` | `4321` | Dev server port |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Astro 4** — SSR with `output:'server'` |
| Adapter | **@astrojs/node** — standalone Node.js server |
| UI | **React 18** — interactive islands |
| Styling | **Tailwind CSS** |
| Language | **TypeScript** |
| Real-time | **ws** package — WebSocket server in middleware |
| Browser | **Playwright** — Chromium headless automation |
| AI Model | **Qwen3.5** via **Ollama** |
| Agent Runtime | **OpenClaw** |

## License

MIT — 100% local, zero cloud dependency.
