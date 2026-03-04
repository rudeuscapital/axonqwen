// src/pages/api/monitor/start.ts
import type { APIRoute } from 'astro';
import { monitors, log, broadcast } from '../../../lib/server';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, condition, intervalMinutes = 30 } = body;
  if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

  const id = `MON-${Date.now()}`;

  const checkFn = async () => {
    try {
      log('INFO', `[${id}] Checking ${url}`);
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const text = (await r.text()).slice(0, 3000);

      broadcast({
        type: 'monitor_check',
        id, url, condition,
        statusCode: r.status,
        contentPreview: text,
        time: new Date().toISOString(),
      });
    } catch (e: any) {
      log('ERROR', `[${id}] Monitor check failed: ${e.message}`);
      broadcast({
        type: 'monitor_check_error',
        id, url,
        error: e.message,
        time: new Date().toISOString(),
      });
    }
  };

  checkFn(); // run immediately
  const timer = setInterval(checkFn, intervalMinutes * 60 * 1000);

  monitors.set(id, {
    id, url,
    condition: condition ?? '',
    intervalMinutes,
    startedAt: new Date().toISOString(),
    timer,
  });

  log('INFO', `Monitor ${id} started → ${url} every ${intervalMinutes} min`);
  return Response.json({ monitorId: id, status: 'running', url, condition, intervalMinutes });
};
