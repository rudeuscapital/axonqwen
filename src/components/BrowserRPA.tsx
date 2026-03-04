import { useState, useEffect } from 'react';
import { runBrowser, subscribeWS } from '../lib/api';

function escapeHtml(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text: string) {
  const safe = escapeHtml(text);
  return safe
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/40 rounded p-3 my-2 overflow-x-auto">$2</pre>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\n/g, '<br/>');
}

const EXAMPLES = [
  { url: 'https://example.com', instruction: 'Extract the main heading and description text' },
  { url: 'https://news.ycombinator.com', instruction: 'Get the top 5 story titles and their points' },
  { url: 'https://quotes.toscrape.com', instruction: 'Extract all quotes and authors on the page' },
];

export default function BrowserRPA() {
  const [url, setUrl]           = useState('');
  const [instruction, setInst]  = useState('');
  const [headless, setHeadless] = useState(true);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<unknown>(null);
  const [taskId, setTaskId]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWS((msg: any) => {
      if (msg.type === 'task_result' && msg.taskId === taskId) {
        setResult(msg.result);
        setRunning(false);
      }
      if (msg.type === 'task_updated' && msg.task?.id === taskId && msg.task?.status === 'failed') {
        setError(msg.task.error || 'Task failed');
        setRunning(false);
      }
    });
    return unsub;
  }, [taskId]);

  const run = async () => {
    if (!url || !instruction) return;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const r = await runBrowser(url, instruction, headless);
      setTaskId(r.taskId);
    } catch (e: any) {
      setError(e.message);
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Browser RPA Agent</h2>
        <p className="text-muted text-sm">Describe what to automate. Qwen3.5 vision reads the page and generates a Playwright script.</p>
      </div>

      {/* Form */}
      <div className="bg-wire border border-dim rounded-xl p-6 space-y-4">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Target URL</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com" className="field" />
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Instruction</label>
          <textarea value={instruction} onChange={e => setInst(e.target.value)}
            placeholder="Describe the automation task in plain English…"
            rows={3} className="field resize-none" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={headless} onChange={e => setHeadless(e.target.checked)}
              className="w-4 h-4 accent-accent" />
            <span className="text-sm text-muted">Headless browser</span>
          </label>
          <button onClick={run} disabled={running || !url || !instruction} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {running ? <><span className="animate-spin inline-block">⟳</span> Running…</> : '▶ Run Automation'}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="bg-wire border border-dim rounded-xl p-5">
        <p className="text-[10px] text-muted uppercase tracking-widest mb-3">Quick Examples</p>
        <div className="space-y-2">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => { setUrl(ex.url); setInst(ex.instruction); }}
              className="w-full text-left px-4 py-3 rounded-lg border border-dim hover:border-accent/30 hover:bg-dim/50 transition-all group">
              <div className="text-xs text-accent group-hover:text-accent font-mono mb-0.5">{ex.url}</div>
              <div className="text-xs text-muted">{ex.instruction}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {running && (
        <div className="bg-wire border border-accent/20 rounded-xl p-5 flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <div>
            <p className="text-accent text-sm font-mono">Task {taskId} running…</p>
            <p className="text-muted text-xs mt-1">Launching Chromium → capturing screenshot → querying Qwen3.5 vision…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-accent2/10 border border-accent2/20 rounded-xl p-5">
          <p className="text-accent2 text-sm font-bold mb-1">Error</p>
          <p className="text-accent2/70 text-xs font-mono">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-wire border border-dim rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dim">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green" />
              <span className="text-white text-sm font-bold">Result — {taskId}</span>
            </div>
            <button onClick={() => navigator.clipboard.writeText(typeof result === 'string' ? result : JSON.stringify(result, null, 2))}
              className="text-xs text-muted hover:text-accent transition-colors font-mono">Copy</button>
          </div>
          <div className="p-5 text-[13px] text-[#9ab0c8] font-mono leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: typeof result === 'string'
              ? renderMarkdown(result)
              : escapeHtml(JSON.stringify(result, null, 2)).replace(/\n/g, '<br/>') }}
          />
        </div>
      )}
    </div>
  );
}
