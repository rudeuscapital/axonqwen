/**
 * src/lib/client.ts
 * ──────────────────────────────────────────────────────────────
 * Browser-only API client.
 * Calls Astro API routes (same origin) for server tasks,
 * and user's local Ollama directly for AI operations.
 * ──────────────────────────────────────────────────────────────
 */

import { ollamaStatusDirect, ollamaStreamDirect } from './ollama-client';

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

export interface ChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

// ── REST helpers ───────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(msg);
  }
  return r.json();
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: 'DELETE' });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

// ── Public API ─────────────────────────────────────────────────

export const api = {
  health:        ()                              => get<any>('/api/health'),
  ollamaStatus:  ()                              => ollamaStatusDirect(),
  tasks:         ()                              => get<{ tasks: Task[]; total: number }>('/api/tasks'),
  task:          (id: string)                    => get<Task>(`/api/tasks/${id}`),
  deleteTask:    (id: string)                    => del<{ success: boolean }>(`/api/tasks/${id}`),
  monitors:      ()                              => get<any>('/api/monitors'),
  deleteMonitor: (id: string)                    => del<any>(`/api/monitor/${id}`),

  runBrowser: (url: string, instruction: string, headless = true) =>
    post<{ taskId: string }>('/api/browser/run', { url, instruction, headless }),

  runScraper: (url: string, fields?: string) =>
    post<{ taskId: string }>('/api/scraper/run', { url, fields }),

  analyzeVision: (imageBase64: string, instruction?: string) =>
    post<{ taskId: string; result: string; duration: string }>('/api/vision/analyze', { imageBase64, instruction }),

  startMonitor: (url: string, condition?: string, intervalMinutes = 30) =>
    post<{ monitorId: string }>('/api/monitor/start', { url, condition, intervalMinutes }),
};

// ── Streaming chat (browser → local Ollama directly) ─────────

export async function* streamChat(
  messages:  ChatMessage[],
  opts?: {
    model?:        string;
    temperature?:  number;
    maxTokens?:    number;
    numCtx?:       number;
    systemPrompt?: string;
  }
): AsyncGenerator<string> {
  yield* ollamaStreamDirect({
    messages,
    model:        opts?.model,
    temperature:  opts?.temperature,
    num_predict:  opts?.maxTokens,
    num_ctx:      opts?.numCtx,
    systemPrompt: opts?.systemPrompt,
  });
}

// ── WebSocket ──────────────────────────────────────────────────

type WSMessage = Record<string, unknown>;
type WSListener = (msg: WSMessage) => void;

let   _ws:       WebSocket | null = null;
const _listeners = new Set<WSListener>();
let   _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWS(): WebSocket {
  if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) return _ws;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  _ws = new WebSocket(`${proto}//${location.host}/_ws`);

  _ws.onopen = () => {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  };

  _ws.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data) as WSMessage;
      _listeners.forEach(fn => fn(msg));
    } catch { /* ignore */ }
  };

  _ws.onclose = () => {
    _ws = null;
    // Auto-reconnect after 3 s
    _reconnectTimer = setTimeout(() => getWS(), 3000);
  };

  _ws.onerror = () => _ws?.close();

  return _ws;
}

export function subscribeWS(fn: WSListener): () => void {
  getWS();
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Utilities ──────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return Math.floor(diff / 60_000)     + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000)  + 'h ago';
  return                        Math.floor(diff / 86_400_000)  + 'd ago';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res((r.result as string).split(',')[1]!);
    r.onerror = () => rej(new Error('FileReader failed'));
    r.readAsDataURL(file);
  });
}
