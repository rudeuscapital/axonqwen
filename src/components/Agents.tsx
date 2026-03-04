import { useState, useEffect } from 'react';
import { fetchTasks, type Task } from '../lib/api';

const AGENTS = [
  { id: 'browser-rpa', name: 'Browser RPA',  icon: '⬟', desc: 'Playwright-powered browser automation with Qwen3.5 vision', href: '/app/browser', color: 'accent' },
  { id: 'scraper',     name: 'Scraper',       icon: '◉', desc: 'AI-powered structured data extraction from any URL',         href: '/app/scraper', color: 'green'  },
  { id: 'vision',      name: 'Vision',        icon: '◑', desc: 'Image analysis, OCR, and document data extraction',           href: '/app/vision',  color: 'gold'   },
  { id: 'monitor',     name: 'Monitor',       icon: '⊕', desc: 'Scheduled URL monitoring with natural language conditions',   href: '/app/monitor', color: 'accent2' },
  { id: 'chat',        name: 'Chat (OpenClaw)',icon: '◈', desc: 'Streaming conversation with persistent memory via OpenClaw', href: '/app/chat',    color: 'accent' },
];

const COLORS: Record<string, string> = {
  accent:  'text-accent  border-accent/20  bg-accent/10',
  green:   'text-green   border-green/20   bg-green/10',
  gold:    'text-gold    border-gold/20    bg-gold/10',
  accent2: 'text-accent2 border-accent2/20 bg-accent2/10',
};

export default function Agents() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks().then(r => setTasks(r.tasks || [])).catch(() => {});
  }, []);

  const countFor = (id: string) => tasks.filter(t => t.agent === id).length;
  const successFor = (id: string) => tasks.filter(t => t.agent === id && t.status === 'success').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Agents</h2>
        <p className="text-muted text-sm">Five purpose-built AI agents, all backed by your local Qwen3.5 model.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENTS.map(agent => {
          const total = countFor(agent.id);
          const success = successFor(agent.id);
          const c = COLORS[agent.color];
          return (
            <div key={agent.id} className="bg-wire border border-dim rounded-xl p-6 hover:border-dim/80 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 dark-grid-bg opacity-20 rounded-xl" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${c}`}>
                    {agent.icon}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
                    Active
                  </div>
                </div>
                <h3 className="font-display font-bold text-white text-lg mb-2">{agent.name}</h3>
                <p className="text-muted text-xs leading-relaxed mb-5">{agent.desc}</p>
                <div className="flex items-center justify-between text-xs mb-4">
                  <span className="text-muted">{total} tasks · {success} succeeded</span>
                  {total > 0 && <span className="text-green">{Math.round(success/total*100)}% success</span>}
                </div>
                <a href={agent.href} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition-all ${c} hover:opacity-80`}>
                  Open Agent →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
