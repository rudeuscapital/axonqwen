/**
 * server/store.ts
 * ──────────────────────────────────────────────────────────────
 * Server-side singleton module for Express API server.
 * Exports: task store, monitor store, WebSocket broadcaster.
 * ──────────────────────────────────────────────────────────────
 */
import type { WebSocket } from 'ws';

// ── Types ──────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'running' | 'awaiting_ai' | 'success' | 'failed';

export interface Task {
  id:          string;
  description: string;
  agent:       string;
  status:      TaskStatus;
  startedAt:   string;
  duration:    string | null;
  result:      unknown   | null;
  error:       string    | null;
}

export interface Monitor {
  id:              string;
  url:             string;
  condition:       string;
  intervalMinutes: number;
  startedAt:       string;
  timer:           ReturnType<typeof setInterval>;
}

// ── In-memory stores ───────────────────────────────────────────
// Declared on `globalThis` so hot-reload keeps state in dev mode
declare global {
  var __aq_tasks:      Map<string, Task>    | undefined;
  var __aq_monitors:   Map<string, Monitor> | undefined;
  var __aq_seq:        number               | undefined;
  var __aq_ws_clients: Set<WebSocket>       | undefined;
}

globalThis.__aq_tasks      ??= new Map<string, Task>();
globalThis.__aq_monitors   ??= new Map<string, Monitor>();
globalThis.__aq_seq        ??= 100;
globalThis.__aq_ws_clients ??= new Set();

export const tasks     = globalThis.__aq_tasks!;
export const monitors  = globalThis.__aq_monitors!;
export const wsClients = globalThis.__aq_ws_clients!;

// ── WebSocket broadcast ────────────────────────────────────────
export function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  wsClients.forEach(ws => {
    if ((ws as any).readyState === 1 /* OPEN */) {
      try { ws.send(msg); } catch { /* ignore closed */ }
    }
  });
}

// ── Logger ─────────────────────────────────────────────────────
export type LogLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR';

export function log(level: LogLevel, msg: string): void {
  const time = new Date().toTimeString().slice(0, 8);
  const sym  = { INFO: 'i', OK: '+', WARN: '!', ERROR: 'x' } as const;
  console.log(`[${time}] [${sym[level] ?? level}] ${msg}`);
  broadcast({ type: 'log', level, msg, time });
}

// ── Task helpers ───────────────────────────────────────────────
export function createTask(description: string, agent: string): Task {
  const id   = 'T-' + String(++globalThis.__aq_seq!).padStart(3, '0');
  const task: Task = {
    id, description, agent,
    status:    'pending',
    startedAt: new Date().toISOString(),
    duration:  null,
    result:    null,
    error:     null,
  };
  tasks.set(id, task);
  broadcast({ type: 'task_created', task });
  return task;
}

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const t = tasks.get(id);
  if (!t) return null;
  Object.assign(t, patch);
  broadcast({ type: 'task_updated', task: t });
  return t;
}

export function elapsed(t0: number): string {
  return ((Date.now() - t0) / 1000).toFixed(1) + 's';
}
