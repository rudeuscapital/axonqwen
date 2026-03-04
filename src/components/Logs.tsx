import { useState, useEffect, useRef } from 'react';
import { subscribeWS } from '../lib/api';

interface LogEntry { level: string; msg: string; time: string; }

export function Logs() {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [filter, setFilter]   = useState<string>('ALL');
  const [paused, setPaused]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeWS((msg: any) => {
      if (msg.type === 'log' && !paused) {
        setLogs(prev => [...prev, { level: msg.level, msg: msg.msg, time: msg.time }].slice(-500));
      }
    });
  }, [paused]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, paused]);

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.level === filter);
  const color: Record<string, string> = { INFO: 'log-info', OK: 'log-ok', WARN: 'log-warn', ERROR: 'log-error' };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-display font-bold text-white text-2xl mb-1">Logs</h2>
          <p className="text-muted text-sm">Real-time system log stream via WebSocket.</p>
        </div>
        <div className="flex items-center gap-2">
          {['ALL','INFO','OK','WARN','ERROR'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all border ${filter === f ? 'bg-dim border-accent/30 text-accent' : 'border-dim text-muted hover:text-white'}`}>{f}</button>
          ))}
          <button onClick={() => setPaused(p => !p)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all border ${paused ? 'border-gold/30 text-gold' : 'border-dim text-muted hover:text-white'}`}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => setLogs([])} className="text-xs text-muted hover:text-accent2 transition-colors font-mono px-2">✕ Clear</button>
        </div>
      </div>

      <div className="flex-1 bg-[#02040a] border border-dim rounded-xl p-5 font-mono text-xs overflow-y-auto space-y-1">
        {filtered.length === 0 && <p className="text-muted/30">No logs yet — start the server to see activity here.</p>}
        {filtered.map((l, i) => (
          <div key={i} className={`flex gap-3 ${color[l.level] || 'text-muted'}`}>
            <span className="text-muted/40 flex-shrink-0 w-16">{l.time}</span>
            <span className="flex-shrink-0 w-10">[{l.level}]</span>
            <span className="flex-1">{l.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default Logs;
