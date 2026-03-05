/**
 * server/index.ts
 * ──────────────────────────────────────────────────────────────
 * Express API server + WebSocket for AxonQwen.
 * In production, also serves the Astro static build from ./dist.
 * ──────────────────────────────────────────────────────────────
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { wsClients, log } from './store.js';

import healthRouter   from './routes/health.js';
import tasksRouter    from './routes/tasks.js';
import monitorsRouter from './routes/monitors.js';
import scraperRouter  from './routes/scraper.js';
import browserRouter  from './routes/browser.js';
import visionRouter   from './routes/vision.js';
import ollamaProxy   from './routes/ollama-proxy.js';
import authRouter    from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

const app = express();

// CORS for development (Astro dev server on :4321 → Express on :3000)
if (isDev) {
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json({ limit: '10mb' }));

// API routes
app.use(authRouter);
app.use(healthRouter);
app.use(tasksRouter);
app.use(monitorsRouter);
app.use(scraperRouter);
app.use(browserRouter);
app.use(visionRouter);
app.use(ollamaProxy);

// Production: serve Astro static build
if (!isDev) {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  // Fallback for client-side routes — serve the closest index.html
  app.get('*', (req, res) => {
    // Try exact path first (Astro generates /app/index.html, /app/chat/index.html, etc.)
    const tryPath = path.join(distPath, req.path, 'index.html');
    res.sendFile(tryPath, (err) => {
      if (err) {
        const fallback = path.join(distPath, 'index.html');
        res.sendFile(fallback, (err2) => {
          if (err2) res.status(404).send('Not found');
        });
      }
    });
  });
}

// HTTP server + WebSocket
const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url === '/_ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  wsClients.add(ws as any);
  ws.send(JSON.stringify({ type: 'connected', version: '1.0.0' }));
  ws.on('close', () => wsClients.delete(ws as any));
  ws.on('error', ()  => wsClients.delete(ws as any));
});

httpServer.listen(PORT, () => {
  log('INFO', `[AxonQwen] Express API server on :${PORT}`);
  log('INFO', `[AxonQwen] WebSocket at ws://0.0.0.0:${PORT}/_ws`);
  if (!isDev) log('INFO', `[AxonQwen] Serving static files from ./dist`);
  else log('INFO', `[AxonQwen] Dev mode — Astro serves frontend on :4321`);
});
