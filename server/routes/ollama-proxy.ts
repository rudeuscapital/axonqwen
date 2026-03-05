/**
 * Proxy /ollama/* → VPS Ollama (127.0.0.1:11434)
 * Browser → https://axonqwen.xyz/ollama/api/chat → Express → 127.0.0.1:11434/api/chat
 */
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

router.all('/ollama/*', async (req: Request, res: Response) => {
  // Strip /ollama prefix → /api/tags, /api/chat, etc.
  const ollamaPath = req.url.replace(/^\/ollama/, '');
  const targetUrl = `${OLLAMA_URL}${ollamaPath}`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const fetchOpts: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const ollamaRes = await fetch(targetUrl, fetchOpts);

    // Set response headers
    res.status(ollamaRes.status);
    const ct = ollamaRes.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    // Stream the response (for streaming chat)
    if (ollamaRes.body) {
      const reader = (ollamaRes.body as any).getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      };
      await pump();
    } else {
      const text = await ollamaRes.text();
      res.send(text);
    }
  } catch (e: any) {
    res.status(502).json({ error: `Cannot connect to Ollama: ${e.message}` });
  }
});

export default router;
