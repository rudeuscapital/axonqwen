# AxonQwen — System Prompt / Project Overview

## What is AxonQwen?

AxonQwen is a fully managed, cloud-hosted AI automation platform at **axonqwen.xyz**. It provides five specialized AI agents — Chat, Browser RPA, Scraper, Vision, and Monitor — all powered by **Qwen3.5** running on dedicated VPS infrastructure via **Ollama**. Users authenticate via crypto wallet (multi-chain: EVM, Solana, TON) and access the dashboard to run automation tasks through a web interface.

---

## Architecture

```
Browser (Static HTML/JS)
    |
    |--- HTTPS ---> Nginx (SSL termination, reverse proxy)
    |                   |
    |                   +---> Express API Server (:3000)
    |                   |         |
    |                   |         +---> /api/* routes (REST)
    |                   |         +---> /_ws (WebSocket)
    |                   |         +---> /ollama/* proxy ---> Ollama (:11434)
    |                   |         +---> Static files (./dist)
    |                   |
    |                   +---> Ollama (:11434) — Qwen3.5 LLM
    |
    +--- /ollama/api/chat ---> Express proxy ---> Ollama (streaming)
```

### Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Frontend     | Astro 4 (static output) + React + Tailwind CSS     |
| Backend      | Express.js + TypeScript (tsx runtime)               |
| AI Engine    | Ollama with Qwen3.5 (local to VPS at 127.0.0.1)    |
| WebSocket    | ws library at `/_ws` for real-time updates          |
| Auth         | Crypto wallet login (JWT tokens, 7-day expiry)      |
| Browser RPA  | Playwright (headless Chromium)                      |
| Deployment   | VPS + PM2 + Nginx + Let's Encrypt SSL               |
| Package Mgr  | npm, ESM (`"type": "module"`)                       |

---

## Project Structure

```
axonqwen-astro/
├── astro.config.mjs          # Astro config: static output, React, Tailwind, Vite proxy
├── tailwind.config.mjs        # Custom theme: ink/paper/accent colors, Syne + JetBrains Mono
├── tsconfig.json              # Strict Astro TS config, React JSX, path alias @/*
├── package.json               # Scripts: dev, build, start
│
├── src/                       # Frontend (Astro static build → ./dist)
│   ├── layouts/
│   │   ├── Base.astro         # Base HTML layout (landing page, login)
│   │   └── AppLayout.astro    # Dashboard layout: sidebar nav, auth guard, Ollama status, WebSocket
│   ├── pages/
│   │   ├── index.astro        # Landing page: hero, features, agents, usage guide, roadmap, token, CTA
│   │   ├── login.astro        # Wallet login: MetaMask/Phantom/Tonkeeper buttons
│   │   └── app/
│   │       ├── index.astro    # Dashboard overview
│   │       ├── chat.astro     # Chat Agent (streaming SSE to Ollama)
│   │       ├── browser.astro  # Browser RPA Agent (Playwright + Vision)
│   │       ├── scraper.astro  # Scraper Agent (Chromium + AI extraction)
│   │       ├── vision.astro   # Vision Agent (image analysis / OCR)
│   │       ├── monitor.astro  # Monitor Agent (scheduled URL checks)
│   │       ├── agents.astro   # Agent overview page
│   │       ├── tasks.astro    # Task history
│   │       ├── logs.astro     # Real-time server logs
│   │       ├── settings.astro # User settings (model, temperature, etc.)
│   │       └── _placeholder.astro
│   ├── lib/
│   │   ├── api.ts             # REST client + WebSocket singleton + streaming chat
│   │   ├── ollama-client.ts   # Browser→Ollama via /ollama proxy (status, chat, stream)
│   │   ├── settings-store.ts  # localStorage settings (ollamaUrl, model, temperature, etc.)
│   │   ├── wallet-auth.ts     # Client-side wallet connection: EVM/Solana/TON, JWT session
│   │   └── client.ts          # Misc client utilities
│   └── styles/
│       └── global.css         # Global styles, CSS variables, activity log, animations
│
├── server/                    # Backend (Express API, runs via tsx)
│   ├── index.ts               # Express app + HTTP server + WebSocket setup
│   ├── store.ts               # In-memory task/monitor stores, WebSocket broadcast, logger
│   ├── routes/
│   │   ├── auth.ts            # POST /api/auth/nonce, POST /api/auth/verify, GET /api/auth/me
│   │   ├── health.ts          # GET /api/health
│   │   ├── tasks.ts           # GET /api/tasks, DELETE /api/tasks/:id
│   │   ├── scraper.ts         # POST /api/scraper/run (Playwright + page text extraction)
│   │   ├── browser.ts         # POST /api/browser/run (Playwright + screenshot + text)
│   │   ├── vision.ts          # POST /api/vision/analyze (task creation, AI runs client-side)
│   │   ├── monitors.ts        # GET /api/monitors, POST /api/monitor/start, DELETE /api/monitor/:id
│   │   └── ollama-proxy.ts    # /ollama/* → 127.0.0.1:11434 (proxy with streaming support)
│   └── middleware/
│       └── auth.ts            # requireAuth middleware (JWT verification)
│
└── dist/                      # Build output (served by Express in production)
```

---

## Authentication Flow

1. User visits `/login` and clicks a wallet button (MetaMask, Phantom, or Tonkeeper)
2. Client detects wallet provider via `window.ethereum` / `window.phantom.solana` / `window.ton`
3. Client requests a nonce: `POST /api/auth/nonce { address, chain }`
4. Server generates a random nonce, stores it with 5-minute expiry, returns a sign message
5. Client asks the wallet to sign the message (`personal_sign` for EVM, `signMessage` for Solana, `ton_rawSign` for TON)
6. Client sends signature for verification: `POST /api/auth/verify { address, chain, signature, message }`
7. Server verifies:
   - **EVM**: `ethers.verifyMessage()` recovers signer address
   - **Solana**: `tweetnacl.sign.detached.verify()` with bs58-decoded pubkey and base64-decoded signature
   - **TON**: Address format validation (simplified; TON Connect proof)
8. Server issues a JWT (7-day expiry) containing `{ address, chain, shortAddress }`
9. Client stores session in `localStorage` under key `axonqwen-auth`
10. `AppLayout.astro` auth guard checks `getSession()` — redirects to `/login` if no valid session

### JWT Details
- Secret: `process.env.JWT_SECRET` or random 32-byte hex (generated at startup)
- Expiry: 7 days
- Payload: `{ address, chain, shortAddress }`
- Client decodes JWT payload (base64url → base64 → atob) to check expiry without server roundtrip

---

## AI Agents

### 1. Chat Agent (`/app/chat`)
- Streaming chat with Qwen3.5 via Ollama
- Browser fetches `POST /ollama/api/chat` (proxied to Ollama) with `stream: true`
- AsyncGenerator (`ollamaStreamDirect`) reads NDJSON stream, yields tokens
- Supports system prompts, temperature, model selection
- Handles Qwen3.5 thinking tokens (`message.thinking`) and content tokens

### 2. Browser RPA Agent (`/app/browser`)
- User provides URL + natural language instruction
- Server launches headless Chromium via Playwright
- Captures screenshot (JPEG base64) + page text
- Broadcasts `browser_data_ready` via WebSocket with screenshot + text
- Client sends screenshot + instruction to Qwen3.5 Vision for analysis
- Progress: chromium → navigating → capturing → AI analysis

### 3. Scraper Agent (`/app/scraper`)
- User provides URL + optional field names
- Server launches headless Chromium, navigates to URL (waits for networkidle)
- Extracts page text (up to 12,000 chars) and title
- Broadcasts `scraper_data_ready` via WebSocket
- Client sends extracted text to Qwen3.5 for structured JSON extraction
- Progress: chromium → navigating → scraping → AI extraction

### 4. Vision Agent (`/app/vision`)
- User uploads an image (converted to base64 client-side)
- Client sends image directly to Ollama as multimodal message (base64 image content)
- Qwen3.5 multimodal extracts text, tables, form fields — no external OCR needed
- Server only creates a task record; all AI processing happens client-side

### 5. Monitor Agent (`/app/monitor`)
- User provides URL + natural language condition + check interval
- Server sets up `setInterval` to periodically fetch the URL
- Each check broadcasts result via WebSocket (`monitor_check` or `monitor_check_error`)
- Client can use Qwen3.5 to evaluate conditions against fetched content
- Monitors persist in-memory (restart clears them)

---

## API Routes

| Method | Endpoint               | Description                              |
| ------ | ---------------------- | ---------------------------------------- |
| POST   | /api/auth/nonce        | Generate sign message with nonce         |
| POST   | /api/auth/verify       | Verify wallet signature, issue JWT       |
| GET    | /api/auth/me           | Validate JWT, return user info           |
| GET    | /api/health            | Server health + uptime + counts          |
| GET    | /api/tasks             | List all tasks (newest first)            |
| DELETE | /api/tasks/:id         | Delete a task record                     |
| POST   | /api/browser/run       | Start Browser RPA task                   |
| POST   | /api/scraper/run       | Start scraping task                      |
| POST   | /api/vision/analyze    | Create vision task record                |
| POST   | /api/monitor/start     | Start URL monitor                        |
| GET    | /api/monitors          | List active monitors                     |
| DELETE | /api/monitor/:id       | Stop and remove a monitor                |
| ALL    | /ollama/*              | Proxy to Ollama (127.0.0.1:11434)        |

### WebSocket (`/_ws`)
- Real-time bidirectional communication
- Server broadcasts: `connected`, `log`, `task_created`, `task_updated`, `scraper_progress`, `scraper_data_ready`, `browser_progress`, `browser_data_ready`, `monitor_check`, `monitor_check_error`
- Client reconnects automatically every 3 seconds on disconnect

---

## Data Flow

### Chat (streaming)
```
Browser → POST /ollama/api/chat (stream:true) → Express proxy → Ollama
       ← NDJSON stream (token by token) ← Express ← Ollama
```

### Scraper / Browser RPA
```
Browser → POST /api/scraper/run → Express → Playwright (headless Chromium)
       ← { taskId } (immediate response)
       ← WebSocket: progress events (chromium, navigating, scraping)
       ← WebSocket: scraper_data_ready { pageText, pageTitle }
Browser → POST /ollama/api/chat { pageText + instruction } → Ollama
       ← AI-extracted structured JSON
```

### Vision
```
Browser → convert image to base64
       → POST /ollama/api/chat { images: [base64], prompt } → Ollama
       ← AI analysis result (OCR, field extraction, etc.)
```

---

## Frontend Details

### Layouts
- **Base.astro**: Minimal HTML shell with Google Fonts (Syne + JetBrains Mono), reveal animations. Used by landing page and login.
- **AppLayout.astro**: Full dashboard chrome — sidebar navigation (10 items), Ollama status pill (auto-checks every 30s), wallet info display, WebSocket badge, auth guard (redirects to `/login` if no session), shared progress helpers (`window.__aq_progress`).

### Design System
- **Theme**: Dark (`#040811` ink) for dashboard, light (`#f5f2eb` paper) for landing
- **Fonts**: Syne (display/headings), JetBrains Mono (body/code)
- **Colors**: accent `#00c8ff` (cyan), accent2 `#ff4444` (red), green `#00e09a`, gold `#e8c84a`
- **Animations**: ticker scroll, pulse dots, fade-up reveals, scan line

### Settings (localStorage)
- Key: `axonqwen-settings`
- Fields: `ollamaUrl`, `model` (default: qwen3.5), `numCtx` (32768), `temperature` (0.6), `maxTokens` (4096), `headless`, `streaming`, `systemPrompt`
- Ollama URL always defaults to `${location.origin}/ollama` (proxied through Express)

---

## Deployment

### Production
```bash
# Build static frontend
npm run build        # → ./dist/

# Start server (serves static + API + WebSocket)
NODE_ENV=production tsx server/index.ts
```

### VPS Setup (axonqwen.xyz)
- **PM2**: Process manager, runs `tsx server/index.ts` on port 3000
- **Nginx**: Reverse proxy on port 80/443, SSL via Let's Encrypt
  - `location /` → `proxy_pass http://127.0.0.1:3000`
  - WebSocket upgrade headers for `/_ws`
- **Ollama**: Running on same VPS at `127.0.0.1:11434`, not exposed publicly
  - Accessed only through Express `/ollama/*` proxy

### Development
```bash
npm run dev          # Concurrently: Astro dev (:4321) + Express API (:3000)
                     # Vite proxies /api/* and /_ws to :3000
```

---

## Key Dependencies

| Package       | Purpose                                           |
| ------------- | ------------------------------------------------- |
| astro         | Static site generator (SSG)                       |
| @astrojs/react| React integration for interactive components      |
| tailwindcss   | Utility-first CSS framework                       |
| express       | HTTP server + API routes                          |
| ws            | WebSocket server                                  |
| playwright    | Headless browser automation (Chromium)            |
| ethers        | EVM signature verification (server-side)          |
| tweetnacl     | Solana Ed25519 signature verification             |
| bs58          | Base58 decoding for Solana public keys            |
| jsonwebtoken  | JWT creation and verification                     |
| cors          | CORS middleware for dev mode                       |
| tsx           | TypeScript executor (runs server without compile)  |

---

## Token ($AXQWEN)

- Placeholder section on landing page and login page
- Contract Address: **Coming Soon**
- Network: Multi-Chain
- Total Supply: TBA
- Tax: 0%
- Liquidity: Locked
- "Buy $AXQWEN" buttons throughout the site (currently link to `#token` section)

---

## Important Notes

1. **All AI processing happens via Ollama** — no external AI API calls. Qwen3.5 runs locally on the VPS.
2. **Ollama is never exposed publicly** — only accessible through the Express `/ollama/*` proxy.
3. **Frontend is fully static** — Astro builds to plain HTML/JS/CSS. No SSR.
4. **Browser-side AI calls**: Chat, Vision, and post-scraping/browser analysis all call Ollama directly from the browser (through the proxy). The server handles Playwright tasks; AI inference is browser-initiated.
5. **In-memory storage**: Tasks and monitors are stored in-memory on `globalThis`. Server restart clears all data.
6. **Wallet session**: Stored in `localStorage` as `axonqwen-auth`. JWT expiry checked client-side (base64url decoded). Disconnect clears the session.
7. **Playwright runs headless** on VPS (no X server). Both scraper and browser routes force `headless: true`.
