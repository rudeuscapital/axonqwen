/**
 * src/lib/settings-store.ts
 * ──────────────────────────────────────────────────────────────
 * Unified browser-side settings store (localStorage).
 * Single source of truth for Ollama URL, model, and preferences.
 * ──────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = 'axonqwen-settings';

export interface AxonQwenSettings {
  ollamaUrl:    string;
  model:        string;
  numCtx:       number;
  temperature:  number;
  maxTokens:    number;
  headless:     boolean;
  streaming:    boolean;
  systemPrompt: string;
}

// Always use the /ollama proxy (Express → VPS Ollama)
function defaultOllamaUrl(): string {
  if (typeof location === 'undefined') return 'http://127.0.0.1:11434';
  return `${location.origin}/ollama`;
}

export const DEFAULTS: AxonQwenSettings = {
  ollamaUrl:    defaultOllamaUrl(),
  model:        'qwen3.5',
  numCtx:       32768,
  temperature:  0.6,
  maxTokens:    4096,
  headless:     true,
  streaming:    true,
  systemPrompt:
    'You are AxonQwen, an enterprise-grade AI automation agent powered by Qwen3.5. ' +
    'Specialise in browser automation, data extraction, form filling, image analysis, ' +
    'and enterprise workflow orchestration. Be precise and professional.',
};

export function getSettings(): AxonQwenSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };

    // Migrate from legacy key
    const legacy = localStorage.getItem('aq-prefs');
    if (legacy) {
      const p = JSON.parse(legacy);
      const migrated: AxonQwenSettings = {
        ...DEFAULTS,
        model:        p.model        ?? DEFAULTS.model,
        temperature:  parseFloat(p.temperature) || DEFAULTS.temperature,
        systemPrompt: p.systemPrompt ?? DEFAULTS.systemPrompt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem('aq-prefs');
      return migrated;
    }
  } catch { /* corrupted storage */ }
  return { ...DEFAULTS };
}

export function saveSettings(patch: Partial<AxonQwenSettings>): void {
  const current = getSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}

export function resetSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('aq-prefs');
}
