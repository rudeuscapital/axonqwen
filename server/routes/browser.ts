import { Router } from 'express';
import { createTask, updateTask, elapsed, log, broadcast } from '../store.js';

const router = Router();

router.post('/api/browser/run', (req, res) => {
  const { url, instruction } = req.body;
  if (!url || !instruction) {
    return res.status(400).json({ error: 'url and instruction are required' });
  }

  const task = createTask(`Browser RPA: ${instruction.slice(0, 60)}`, 'browser-rpa');
  updateTask(task.id, { status: 'running' });
  const t0 = Date.now();

  res.json({ taskId: task.id, status: 'running' });

  setTimeout(async () => {
    let browser: import('playwright').Browser | null = null;
    try {
      const { chromium } = await import('playwright');
      log('INFO', `[${task.id}] Launching Chromium → ${url}`);
      broadcast({ type: 'browser_progress', taskId: task.id, step: 'chromium' });

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();

      broadcast({ type: 'browser_progress', taskId: task.id, step: 'navigating' });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);

      broadcast({ type: 'browser_progress', taskId: task.id, step: 'capturing' });
      page.setDefaultTimeout(15_000);
      const screenshotBuf = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: false });
      const b64           = screenshotBuf.toString('base64');
      const title         = await page.title();
      const pageText      = await page.evaluate(() =>
        document.body ? document.body.innerText.slice(0, 8000) : ''
      );

      const dur = elapsed(t0);
      updateTask(task.id, {
        status: 'awaiting_ai', duration: dur,
        result: { pageTitle: title, url },
      });
      broadcast({
        type: 'browser_data_ready', taskId: task.id,
        screenshot: b64, pageText, pageTitle: title, url, instruction,
      });
      log('OK', `[${task.id}] Page captured in ${dur} — awaiting client-side AI analysis`);
    } catch (err: any) {
      const dur = elapsed(t0);
      updateTask(task.id, { status: 'failed', duration: dur, error: err.message });
      log('ERROR', `[${task.id}] Browser RPA failed: ${err.message}`);
    } finally {
      if (browser) { try { await browser.close(); } catch {} }
    }
  }, 0);
});

export default router;
