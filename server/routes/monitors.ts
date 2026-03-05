import { Router } from 'express';
import { monitors, log, broadcast } from '../store.js';

const router = Router();

// GET /api/monitors
router.get('/api/monitors', (_req, res) => {
  const list = Array.from(monitors.values()).map(
    ({ id, url, condition, intervalMinutes, startedAt }) =>
      ({ id, url, condition, intervalMinutes, startedAt })
  );
  res.json({ monitors: list, total: list.length });
});

// POST /api/monitor/start
router.post('/api/monitor/start', async (req, res) => {
  const { url, condition, intervalMinutes = 30 } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const id = `MON-${Date.now()}`;

  const checkFn = async () => {
    try {
      log('INFO', `[${id}] Checking ${url}`);
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const text = (await r.text()).slice(0, 3000);
      broadcast({
        type: 'monitor_check', id, url, condition,
        statusCode: r.status, contentPreview: text,
        time: new Date().toISOString(),
      });
    } catch (e: any) {
      log('ERROR', `[${id}] Monitor check failed: ${e.message}`);
      broadcast({
        type: 'monitor_check_error', id, url,
        error: e.message, time: new Date().toISOString(),
      });
    }
  };

  checkFn();
  const timer = setInterval(checkFn, intervalMinutes * 60 * 1000);

  monitors.set(id, {
    id, url, condition: condition ?? '', intervalMinutes,
    startedAt: new Date().toISOString(), timer,
  });

  log('INFO', `Monitor ${id} started → ${url} every ${intervalMinutes} min`);
  res.json({ monitorId: id, status: 'running', url, condition, intervalMinutes });
});

// DELETE /api/monitor/:id
router.delete('/api/monitor/:id', (req, res) => {
  const id = req.params.id;
  const m = monitors.get(id);
  if (!m) return res.status(404).json({ error: 'Monitor not found' });
  clearInterval(m.timer);
  monitors.delete(id);
  log('INFO', `Monitor ${id} stopped`);
  res.json({ success: true, id });
});

export default router;
