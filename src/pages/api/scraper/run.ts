// src/pages/api/scraper/run.ts
import type { APIRoute } from 'astro';
import { createTask, updateTask, elapsed, log, broadcast } from '../../../lib/server';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, fields } = body;
  if (!url) return Response.json({ error: 'url is required' }, { status: 400 });

  const task = createTask(`Scrape: ${url}`, 'scraper');
  updateTask(task.id, { status: 'running' });
  const t0 = Date.now();
  const resp = Response.json({ taskId: task.id, status: 'running' });

  setTimeout(async () => {
    let browser: import('playwright').Browser | null = null;
    try {
      const { chromium } = await import('playwright');
      log('INFO', `[${task.id}] Scraping: ${url}`);
      broadcast({ type: 'scraper_progress', taskId: task.id, step: 'chromium' });

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await (await browser.newContext()).newPage();

      broadcast({ type: 'scraper_progress', taskId: task.id, step: 'navigating' });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(500);

      broadcast({ type: 'scraper_progress', taskId: task.id, step: 'scraping' });
      const text  = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 12_000) : '');
      const title = await page.title();
      await browser.close(); browser = null;

      const dur = elapsed(t0);
      updateTask(task.id, {
        status:   'awaiting_ai',
        duration: dur,
        result:   { pageText: text, pageTitle: title, url, fieldsRequested: fields ?? 'all' },
      });
      broadcast({
        type:     'scraper_data_ready',
        taskId:   task.id,
        pageText: text,
        pageTitle: title,
        url,
        fields:   fields ?? 'all relevant data',
      });
      log('OK', `[${task.id}] Page scraped in ${dur} — awaiting client-side AI extraction`);

    } catch (err: any) {
      if (browser) { try { await browser.close(); } catch {} }
      const dur = elapsed(t0);
      updateTask(task.id, { status: 'failed', duration: dur, error: err.message });
      log('ERROR', `[${task.id}] Scraping failed: ${err.message}`);
    }
  }, 0);

  return resp;
};
