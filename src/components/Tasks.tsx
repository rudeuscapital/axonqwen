import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, deleteTask, subscribeWS, relativeTime, type Task, type TaskStatus } from '../lib/api';

const STATUS: Record<TaskStatus, string> = {
  success: 'badge badge-success',
  running: 'badge badge-running',
  failed:  'badge badge-failed',
  pending: 'badge badge-pending',
};

export default function Tasks() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [filter, setFilter]       = useState<TaskStatus | 'all'>('all');
  const [selected, setSelected]   = useState<Task | null>(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetchTasks();
      setTasks(r.tasks || []);
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return subscribeWS((msg: any) => {
      if (['task_created','task_updated','task_result','task_deleted'].includes(msg.type)) load();
    });
  }, [load]);

  const del = async (id: string) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* handled by api layer */ }
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const counts = {
    all:     tasks.length,
    success: tasks.filter(t => t.status === 'success').length,
    running: tasks.filter(t => t.status === 'running').length,
    failed:  tasks.filter(t => t.status === 'failed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };

  return (
    <div className="flex gap-5 h-full">
      {/* Left: table */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-white text-2xl">Tasks</h2>
          <button onClick={load} className="text-xs text-muted hover:text-accent transition-colors font-mono">↻ Refresh</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-wire border border-dim rounded-lg p-1 w-fit">
          {(['all','success','running','failed','pending'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${filter === f ? 'bg-dim text-white' : 'text-muted hover:text-white'}`}>
              {f} <span className="opacity-50 ml-1">{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-wire border border-dim rounded-xl overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_100px_90px_90px_50px] gap-0 px-5 py-3 border-b border-dim text-[10px] uppercase tracking-widest text-muted">
            <span>ID</span><span>Description</span><span>Agent</span><span>Duration</span><span>Status</span><span></span>
          </div>
          {loading && <div className="px-5 py-8 text-center text-muted text-sm">Loading…</div>}
          {!loading && filtered.length === 0 && <div className="px-5 py-8 text-center text-muted text-sm">No tasks found.</div>}
          {filtered.map(task => (
            <div key={task.id}
              onClick={() => setSelected(task)}
              className={`grid grid-cols-[80px_1fr_100px_90px_90px_50px] gap-0 px-5 py-3.5 border-b border-dim/50 text-sm cursor-pointer transition-colors
                ${selected?.id === task.id ? 'bg-dim/60' : 'hover:bg-dim/30'}`}>
              <span className="text-muted/60 font-mono text-xs self-center">{task.id}</span>
              <span className="text-white text-xs truncate pr-4 self-center">{task.description}</span>
              <span className="text-muted text-xs self-center font-mono">{task.agent}</span>
              <span className="text-muted text-xs self-center font-mono">{task.duration || '—'}</span>
              <span className="self-center">
                <span className={STATUS[task.status]}>{task.status}</span>
              </span>
              <span className="self-center">
                <button onClick={e => { e.stopPropagation(); del(task.id); }}
                  className="text-muted hover:text-accent2 transition-colors text-xs p-1">✕</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-wire border border-dim rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dim">
            <h3 className="font-display font-bold text-white text-sm">{selected.id}</h3>
            <button onClick={() => setSelected(null)} className="text-muted hover:text-white transition-colors text-xs">✕</button>
          </div>
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Description</p>
              <p className="text-white text-xs leading-relaxed">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Agent',    selected.agent],
                ['Status',   selected.status],
                ['Duration', selected.duration || '—'],
                ['Started',  relativeTime(selected.startedAt)],
              ].map(([k,v]) => (
                <div key={k}>
                  <p className="text-[10px] text-muted uppercase tracking-widest mb-1">{k}</p>
                  <p className="text-white text-xs font-mono">{v}</p>
                </div>
              ))}
            </div>
            {selected.error && (
              <div className="bg-accent2/10 border border-accent2/20 rounded-lg p-3">
                <p className="text-accent2 text-xs font-mono leading-relaxed">{selected.error}</p>
              </div>
            )}
            {selected.result && (
              <div>
                <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Result</p>
                <pre className="text-[11px] text-[#9ab0c8] font-mono leading-relaxed bg-black/40 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                  {typeof selected.result === 'string' ? selected.result : JSON.stringify(selected.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-dim">
            <button onClick={() => del(selected.id)} className="btn-danger w-full justify-center text-xs">
              ✕ Delete Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
