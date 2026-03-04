import { useState, useEffect } from 'react';
import { startMonitor, fetchMonitors, deleteMonitor, subscribeWS } from '../lib/api';

interface Monitor { id: string; url: string; condition?: string; intervalMinutes: number; startedAt: string; }

export default function Monitor() {
  const [url, setUrl]                   = useState('');
  const [condition, setCond]            = useState('');
  const [checkInterval, setCheckInterval] = useState(30);
  const [monitors, setMonitors]         = useState<Monitor[]>([]);
  const [alerts, setAlerts]             = useState<string[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const load = async () => {
    try { const r = await fetchMonitors(); setMonitors(r.monitors || []); } catch {}
  };

  useEffect(() => {
    load();
    return subscribeWS((msg: any) => {
      if (msg.type === 'monitor_alert') {
        const time = msg.time ? new Date(msg.time).toLocaleTimeString() : new Date().toLocaleTimeString();
        setAlerts(prev => [`[${time}] ${msg.url} — ${msg.reason}`, ...prev].slice(0, 20));
      }
    });
  }, []);

  const start = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      await startMonitor(url, condition || undefined, checkInterval);
      await load();
      setUrl('');
      setCond('');
    } catch (e: any) {
      setError(e.message || 'Failed to start monitor');
    }
    setLoading(false);
  };

  const stop = async (id: string) => {
    try {
      await deleteMonitor(id);
      setMonitors(prev => prev.filter(m => m.id !== id));
    } catch (e: any) {
      setError(e.message || 'Failed to stop monitor');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Monitor Agent</h2>
        <p className="text-muted text-sm">Schedule periodic URL checks with AI-evaluated conditions. Alerts fire in real-time via WebSocket.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-wire border border-dim rounded-xl p-6 space-y-4">
          <h3 className="font-display font-bold text-white text-sm">New Monitor</h3>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">URL to Watch</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="field" />
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Trigger Condition (natural language)</label>
            <textarea value={condition} onChange={e => setCond(e.target.value)}
              placeholder="e.g. 'price drops below $50' or 'any 503 error appears'"
              rows={2} className="field resize-none" />
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Check Interval: {checkInterval} min</label>
            <input type="range" min={5} max={120} step={5} value={checkInterval} onChange={e => setCheckInterval(+e.target.value)}
              className="w-full accent-accent" />
            <div className="flex justify-between text-[10px] text-muted mt-1"><span>5 min</span><span>120 min</span></div>
          </div>
          {error && <p className="text-accent2 text-xs font-mono">{error}</p>}
          <button onClick={start} disabled={loading || !url} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? '⟳ Starting…' : '⊕ Start Monitor'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-wire border border-dim rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-dim flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-sm">Active Monitors ({monitors.length})</h3>
              <button onClick={load} className="text-xs text-muted hover:text-accent font-mono">↻</button>
            </div>
            <div className="divide-y divide-dim/50 max-h-64 overflow-y-auto">
              {monitors.length === 0 && <p className="px-5 py-6 text-center text-muted text-sm">No active monitors</p>}
              {monitors.map(m => (
                <div key={m.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-mono truncate">{m.url}</p>
                    <p className="text-muted text-[11px] mt-0.5">{m.condition || 'Any change'} · every {m.intervalMinutes}min</p>
                  </div>
                  <button onClick={() => stop(m.id)} className="text-muted hover:text-accent2 text-xs flex-shrink-0 transition-colors">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-wire border border-dim rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-dim flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse-dot" />
              <h3 className="font-display font-bold text-white text-sm">Alerts ({alerts.length})</h3>
            </div>
            <div className="p-4 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
              {alerts.length === 0 && <p className="text-muted/50">Waiting for triggered conditions…</p>}
              {alerts.map((a, i) => <p key={i} className="text-gold">{a}</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
