// ─── API & WebSocket client for AxonQwen frontend ───────────

export const API_BASE = '';
export const WS_URL   = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/_ws`;

// ─── Types ──────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

export interface Task {
  id:          string;
  description: string;
  agent:       string;
  status:      TaskStatus;
  startedAt:   string;
  duration:    string | null;
  result:      unknown | null;
  error:       string | null;
}

export interface LogEntry {
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR';
  msg:   string;
  time:  string;
}

export interface ChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

// ─── Fetch wrapper with error checking ──────────────────────

async function apiFetch<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const body = await r.json(); msg = body.error || body.message || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

// ─── API helpers ────────────────────────────────────────────

export async function fetchHealth() {
  return apiFetch(`${API_BASE}/api/health`);
}

export async function fetchOllamaStatus() {
  const { ollamaStatusDirect } = await import('./ollama-client');
  return ollamaStatusDirect();
}

export async function fetchTasks(): Promise<{ tasks: Task[]; total: number }> {
  return apiFetch(`${API_BASE}/api/tasks`);
}

export async function deleteTask(id: string) {
  return apiFetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
}

export async function runBrowser(url: string, instruction: string, headless = true) {
  return apiFetch<{ taskId: string }>(`${API_BASE}/api/browser/run`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, instruction, headless }),
  });
}

export async function runScraper(url: string, fields?: string) {
  return apiFetch<{ taskId: string }>(`${API_BASE}/api/scraper/run`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, fields }),
  });
}

export async function analyzeVision(imageBase64: string, instruction?: string) {
  return apiFetch<{ result: string }>(`${API_BASE}/api/vision/analyze`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ imageBase64, instruction }),
  });
}

export async function startMonitor(url: string, condition?: string, intervalMinutes = 30) {
  return apiFetch(`${API_BASE}/api/monitor/start`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url, condition, intervalMinutes }),
  });
}

export async function fetchMonitors() {
  return apiFetch<{ monitors: { id: string; url: string; condition?: string; intervalMinutes: number; startedAt: string }[] }>(
    `${API_BASE}/api/monitors`
  );
}

export async function deleteMonitor(id: string) {
  return apiFetch(`${API_BASE}/api/monitor/${id}`, { method: 'DELETE' });
}

// ─── Streaming chat (browser → local Ollama directly) ────────

export async function* streamChat(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; systemPrompt?: string }
) {
  const { ollamaStreamDirect } = await import('./ollama-client');
  yield* ollamaStreamDirect({
    messages,
    model:        opts?.model,
    temperature:  opts?.temperature,
    systemPrompt: opts?.systemPrompt,
  });
}

// ─── WebSocket singleton with reconnection ───────────────────

type WSListener = (msg: unknown) => void;
let ws: WebSocket | null = null;
const listeners = new Set<WSListener>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/_ws`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        listeners.forEach(fn => fn(msg));
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWS();
  }, 3000);
}

export function getWS(): WebSocket | null {
  connectWS();
  return ws;
}

export function subscribeWS(fn: WSListener) {
  connectWS();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ─── Utilities ───────────────────────────────────────────────

export function formatDuration(s: string | null) {
  if (!s) return '—';
  return s;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return Math.floor(diff / 86_400_000) + 'd ago';
}

export function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = () => res((reader.result as string).split(',')[1]);
    reader.onerror = () => rej(new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}
