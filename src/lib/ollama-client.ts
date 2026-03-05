/**
 * src/lib/ollama-client.ts
 * ──────────────────────────────────────────────────────────────
 * Browser-only module: fetches Ollama via the /ollama proxy.
 * Browser → origin/ollama → Express → VPS Ollama.
 * ──────────────────────────────────────────────────────────────
 */

import { getSettings } from './settings-store';

// ── Status ────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  size: number;
}

export interface OllamaStatusResult {
  online: boolean;
  models: OllamaModel[];
  url:    string;
}

/** Check Ollama connectivity. Never throws. */
export async function ollamaStatusDirect(): Promise<OllamaStatusResult> {
  const { ollamaUrl } = getSettings();
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const data = await r.json();
    return { online: true, models: data.models ?? [], url: ollamaUrl };
  } catch {
    return { online: false, models: [], url: ollamaUrl };
  }
}

// ── Non-Streaming Chat ────────────────────────────────────────

export async function ollamaChatDirect(opts: {
  messages:     Array<{ role: string; content: string | unknown[] }>;
  model?:       string;
  temperature?: number;
  num_predict?: number;
  num_ctx?:     number;
}): Promise<string> {
  const s = getSettings();
  const body = {
    model:   opts.model      ?? s.model,
    stream:  false,
    options: {
      temperature: opts.temperature ?? s.temperature,
      num_predict: opts.num_predict ?? s.maxTokens,
      num_ctx:     opts.num_ctx     ?? s.numCtx,
    },
    messages: opts.messages,
  };
  const r = await fetch(`${s.ollamaUrl}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`Ollama error: ${r.status} ${await r.text()}`);
  const data = await r.json();
  // Qwen3.5 may return thinking + content
  return data?.message?.content || data?.message?.thinking || '';
}

// ── Streaming Chat (AsyncGenerator) ──────────────────────────

export async function* ollamaStreamDirect(opts: {
  messages:      Array<{ role: string; content: string }>;
  model?:        string;
  temperature?:  number;
  num_predict?:  number;
  num_ctx?:      number;
  systemPrompt?: string;
}): AsyncGenerator<string> {
  const s = getSettings();
  const allMessages = [
    { role: 'system', content: opts.systemPrompt ?? s.systemPrompt },
    ...opts.messages,
  ];
  const body = {
    model:   opts.model      ?? s.model,
    stream:  true,
    options: {
      temperature: opts.temperature ?? s.temperature,
      num_predict: opts.num_predict ?? s.maxTokens,
      num_ctx:     opts.num_ctx     ?? s.numCtx,
    },
    messages: allMessages,
  };
  const r = await fetch(`${s.ollamaUrl}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Ollama stream error: ${r.status}`);
  if (!r.body) throw new Error('No response body');

  const reader  = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        // Qwen3.5 streams thinking tokens before content tokens
        const tok = obj?.message?.content || obj?.message?.thinking || '';
        if (tok) yield tok;
        if (obj?.done) return;
      } catch { /* partial chunk */ }
    }
  }
}
