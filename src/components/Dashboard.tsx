import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, fetchHealth, subscribeWS, relativeTime, type Task } from '../lib/api';

function StatCard({ label, value, sub, color = 'accent' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    accent: 'text-accent', green: 'text-green-400', gold: 'text-gold', red: 'text-accent2',
  };
  return (
    <div className="stat-card">
      <div className="absolute inset-0 dark-grid-bg opacity-30 rounded-xl" />
      <div className="relative z-10">
        <p className="text-[10px] text-muted uppercase tracking-widest mb-3">{label}</p>
        <p className={`font-display font-extrabold text-4xl leading-none mb-1 ${colors[color]}`}>{value}</p>
        {sub && <p className="text-xs text-muted mt-2">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  success: 'badge badge-success',
  running: 'badge badge-running',
  failed:  'badge badge-failed',
  pending: 'badge badge-pending',
};

export default function Dashboard() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [health, setHealth]     = useState<any>(null);
  const [logs, setLogs]         = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([fetchTasks(), fetchHealth()]);
      setTasks(t.tasks || []);
      setHealth(h);
    } catch { /* server may be offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeWS((msg: any) => {
      if (msg.type === 'task_created' || msg.type === 'task_updated' || msg.type === 'task_result') {
        load();
      }
      if (msg.type === 'log') {
        setLogs(prev => [`[${msg.time}] [${msg.level}] ${msg.msg}`, ...prev].slice(0, 50));
      }
    });
    return unsub;
  }, [load]);

  const stats = {
    total:   tasks.length,
    success: tasks.filter(t => t.status === 'success').length,
    failed:  tasks.filter(t => t.status === 'failed').length,
    running: tasks.filter(t => t.status === 'running').length,
  };
  const rate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Loading…
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks"    value={stats.total}           sub={`${stats.running} running now`}        color="accent"  />
        <StatCard label="Success Rate"   value={`${rate}%`}            sub={`${stats.success} succeeded`}          color="green"   />
        <StatCard label="Failed Tasks"   value={stats.failed}          sub="needs attention"                        color="red"     />
        <StatCard label="Ollama Model"   value={health?.model || '—'}  sub={health?.status === 'ok' ? 'Online ✓' : 'Offline'}  color="gold" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent tasks */}
        <div className="lg:col-span-2 bg-wire border border-dim rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dim">
            <h2 className="font-display font-bold text-sm text-white">Recent Tasks</h2>
            <a href="/app/tasks" className="text-xs text-muted hover:text-accent transition-colors">View all →</a>
          </div>
          <div className="divide-y divide-dim/50">
            {tasks.length === 0 && (
              <div className="px-5 py-8 text-center text-muted text-sm">
                No tasks yet — run an agent to get started.
              </div>
            )}
            {tasks.slice(0, 8).map(task => (
              <div key={task.id} className="task-row">
                <span className="text-[11px] text-muted/60 font-mono w-14 flex-shrink-0">{task.id}</span>
                <span className="flex-1 text-white text-xs truncate">{task.description}</span>
                <span className="text-[10px] text-muted flex-shrink-0 hidden md:block">{relativeTime(task.startedAt)}</span>
                <span className={`${STATUS_COLORS[task.status]} flex-shrink-0`}>
                  {task.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />}
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live log */}
        <div className="bg-wire border border-dim rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dim">
            <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse-dot" />
              Live Activity
            </h2>
          </div>
          <div className="p-4 font-mono text-xs space-y-1.5 overflow-y-auto max-h-72">
            {logs.length === 0 && (
              <p className="text-muted/50">Waiting for events…</p>
            )}
            {logs.map((l, i) => {
              const level = l.includes('[OK]') ? 'text-green' : l.includes('[WARN]') ? 'text-gold' : l.includes('[ERROR]') ? 'text-accent2' : 'text-muted';
              return <p key={i} className={level}>{l}</p>;
            })}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-wire border border-dim rounded-xl p-6">
        <h2 className="font-display font-bold text-sm text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { href: '/app/chat',    label: 'Chat Agent',  icon: '◈' },
            { href: '/app/browser', label: 'Browser RPA', icon: '⬟' },
            { href: '/app/scraper', label: 'Scraper',     icon: '◉' },
            { href: '/app/vision',  label: 'Vision',      icon: '◑' },
            { href: '/app/monitor', label: 'Monitor',     icon: '⊕' },
          ].map(a => (
            <a key={a.href} href={a.href}
               className="flex items-center gap-2 px-4 py-3 rounded-lg bg-dim hover:bg-[#1a2038] border border-dim hover:border-accent/20 transition-all text-sm text-muted hover:text-white group">
              <span className="text-lg group-hover:text-accent transition-colors">{a.icon}</span>
              <span className="text-[13px]">{a.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
