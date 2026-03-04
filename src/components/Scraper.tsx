import { useState, useEffect } from 'react';
import { runScraper, subscribeWS } from '../lib/api';

export default function Scraper() {
  const [url, setUrl]         = useState('');
  const [fields, setFields]   = useState('');
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId]   = useState<string | null>(null);
  const [result, setResult]   = useState<unknown>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    return subscribeWS((msg: any) => {
      if (msg.type === 'task_result' && msg.taskId === taskId) {
        setResult(msg.result); setRunning(false);
      }
      if (msg.type === 'task_updated' && msg.task?.id === taskId && msg.task?.status === 'failed') {
        setError(msg.task.error); setRunning(false);
      }
    });
  }, [taskId]);

  const run = async () => {
    if (!url) return;
    setRunning(true); setResult(null); setError(null);
    try {
      const r = await runScraper(url, fields || undefined);
      setTaskId(r.taskId);
    } catch (e: any) { setError(e.message); setRunning(false); }
  };

  const examples = [
    { url: 'https://quotes.toscrape.com', fields: 'quote text, author, tags' },
    { url: 'https://books.toscrape.com', fields: 'title, price, rating, availability' },
    { url: 'https://news.ycombinator.com', fields: 'title, url, points, comment count' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Scraper Agent</h2>
        <p className="text-muted text-sm">Navigate any URL with real Chromium and extract structured JSON data powered by Qwen3.5.</p>
      </div>
      <div className="bg-wire border border-dim rounded-xl p-6 space-y-4">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">URL to Scrape</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="field" />
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Fields to Extract (optional)</label>
          <input type="text" value={fields} onChange={e => setFields(e.target.value)}
            placeholder="e.g. title, price, rating — or leave blank to extract all" className="field" />
        </div>
        <button onClick={run} disabled={running || !url} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          {running ? <><span className="animate-spin">⟳</span> Scraping…</> : '◉ Run Scraper'}
        </button>
      </div>

      <div className="bg-wire border border-dim rounded-xl p-5">
        <p className="text-[10px] text-muted uppercase tracking-widest mb-3">Examples</p>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <button key={i} onClick={() => { setUrl(ex.url); setFields(ex.fields); }}
              className="w-full text-left px-4 py-3 rounded-lg border border-dim hover:border-accent/30 hover:bg-dim/50 transition-all group">
              <div className="text-xs text-accent font-mono mb-0.5">{ex.url}</div>
              <div className="text-xs text-muted">Fields: {ex.fields}</div>
            </button>
          ))}
        </div>
      </div>

      {running && (
        <div className="bg-wire border border-accent/20 rounded-xl p-5 flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <div>
            <p className="text-accent text-sm font-mono">Task {taskId} running…</p>
            <p className="text-muted text-xs mt-1">Loading page in Chromium → extracting content → Qwen3.5 structuring data…</p>
          </div>
        </div>
      )}
      {error && <div className="bg-accent2/10 border border-accent2/20 rounded-xl p-5"><p className="text-accent2 text-sm font-mono">{error}</p></div>}
      {result && (
        <div className="bg-wire border border-dim rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dim">
            <span className="text-white text-sm font-bold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green" /> Result</span>
            <button onClick={() => navigator.clipboard.writeText(typeof result === 'string' ? result : JSON.stringify(result, null, 2))} className="text-xs text-muted hover:text-accent font-mono">Copy JSON</button>
          </div>
          <pre className="p-5 text-[12px] text-[#9ab0c8] font-mono leading-relaxed overflow-auto max-h-[480px] whitespace-pre-wrap">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
