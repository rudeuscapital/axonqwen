// src/middleware/index.ts
// ──────────────────────────────────────────────────────────────
// Astro SSR middleware.
// Intercepts HTTP upgrade requests for /_ws and hands them off
// to the `ws` WebSocket server.  All other requests pass through
// to Astro's normal page/API routing.
// ──────────────────────────────────────────────────────────────
import type { MiddlewareHandler } from 'astro';
import { wsClients } from '../lib/server';

// Bootstrap the ws.Server once, attached to the raw http.Server
// that Astro's @astrojs/node adapter exposes on `globalThis`.
declare global {
  var __aq_ws_bootstrapped: boolean | undefined;
}

function bootstrapWS() {
  if (globalThis.__aq_ws_bootstrapped) return;
  globalThis.__aq_ws_bootstrapped = true;

  // @astrojs/node (standalone) exposes the Node HTTP server on
  // `globalThis.__server__` after the first request.
  // We poll briefly until it's available.
  const tryAttach = () => {
    const httpServer = (globalThis as any).__server__;
    if (!httpServer) {
      setTimeout(tryAttach, 200);
      return;
    }

    import('ws').then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ noServer: true });

      httpServer.on('upgrade', (req: any, socket: any, head: any) => {
        if (req.url === '/_ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        } else {
          socket.destroy();
        }
      });

      wss.on('connection', (ws) => {
        wsClients.add(ws as any);
        ws.send(JSON.stringify({
          type:    'connected',
          version: '1.0.0',
        }));
        ws.on('close', () => wsClients.delete(ws as any));
        ws.on('error', ()  => wsClients.delete(ws as any));
      });

      console.log('[AxonQwen] WebSocket server attached at /_ws');
    });
  };

  setTimeout(tryAttach, 500);
}

export const onRequest: MiddlewareHandler = (context, next) => {
  bootstrapWS();
  return next();
};
