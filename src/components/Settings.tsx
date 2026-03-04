import { useState, useEffect } from 'react';
import { fetchOllamaStatus, API_BASE } from '../lib/api';

const DEFAULTS = {
  ollamaUrl:  'http://localhost:11434',
  model:      'qwen3.5',
  numCtx:     65536,
  temperature:0.6,
  maxTokens:  4096,
  headless:   true,
  streaming:  true,
  systemPrompt: 'You are AxonQwen, an enterprise-grade AI automation agent powered by Qwen3.5. Specialise in browser automation, data extraction, form filling, image analysis, and enterprise workflow orchestration.',
};

export default function Settings() {
  const [cfg, setCfg]         = useState(DEFAULTS);
  const [status, setStatus]   = useState<any>(null);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('axonqwen-settings');
    if (stored) try { setCfg(JSON.parse(stored)); } catch {}
    checkOllama();
  }, []);

  const checkOllama = async () => {
    try { setStatus(await fetchOllamaStatus()); } catch { setStatus({ online: false }); }
  };

  const set = (k: keyof typeof DEFAULTS, v: any) => setCfg(prev => ({ ...prev, [k]: v }));

  const save = () => {
    localStorage.setItem('axonqwen-settings', JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => { setCfg(DEFAULTS); localStorage.removeItem('axonqwen-settings'); };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Settings</h2>
        <p className="text-muted text-sm">Configure Ollama connection, model parameters, and agent defaults.</p>
      </div>

      {/* Connection */}
      <div className="bg-wire border border-dim rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-white text-sm">Ollama Connection</h3>
          <div className={`flex items-center gap-2 text-xs ${status?.online ? 'text-green' : 'text-accent2'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
            {status?.online ? 'Connected' : status ? 'Offline' : 'Checking…'}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Ollama URL</label>
          <div className="flex gap-2">
            <input type="url" value={cfg.ollamaUrl} onChange={e => set('ollamaUrl', e.target.value)} className="field flex-1" />
            <button onClick={checkOllama} className="btn-secondary text-xs px-3">Test</button>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Default Model</label>
          <select value={cfg.model} onChange={e => set('model', e.target.value)} className="field">
            {['qwen3.5','qwen3.5:0.8b','qwen3.5:7b','qwen3.5:14b','qwen3.5:27b','qwen3.5:35b'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {status?.models?.length > 0 && (
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Installed Models</p>
            <div className="flex flex-wrap gap-2">
              {status.models.map((m: any) => (
                <span key={m.name} className="text-[11px] px-2 py-0.5 rounded border border-dim text-muted font-mono">{m.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Model parameters */}
      <div className="bg-wire border border-dim rounded-xl p-6 space-y-5">
        <h3 className="font-display font-bold text-white text-sm">Model Parameters</h3>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Temperature: {cfg.temperature}</label>
          <input type="range" min={0} max={2} step={0.1} value={cfg.temperature} onChange={e => set('temperature', +e.target.value)}
            className="w-full accent-accent" />
          <p className="text-[10px] text-muted mt-1">0 = deterministic, 2 = very creative. Recommended: 0.6</p>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Context Window</label>
          <select value={cfg.numCtx} onChange={e => set('numCtx', +e.target.value)} className="field">
            {[8192,16384,32768,65536,131072,262144].map(n => (
              <option key={n} value={n}>{(n/1024).toFixed(0)}K tokens</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Max Output Tokens: {cfg.maxTokens}</label>
          <input type="range" min={512} max={32768} step={512} value={cfg.maxTokens} onChange={e => set('maxTokens', +e.target.value)}
            className="w-full accent-accent" />
        </div>
      </div>

      {/* System prompt */}
      <div className="bg-wire border border-dim rounded-xl p-6">
        <h3 className="font-display font-bold text-white text-sm mb-4">Default System Prompt</h3>
        <textarea value={cfg.systemPrompt} onChange={e => set('systemPrompt', e.target.value)}
          rows={4} className="field resize-none leading-relaxed" />
      </div>

      {/* Toggles */}
      <div className="bg-wire border border-dim rounded-xl p-6 space-y-3">
        <h3 className="font-display font-bold text-white text-sm">Agent Settings</h3>
        {[
          { key: 'headless',  label: 'Headless Browser',    desc: 'Run browser in headless mode (no visible window)' },
          { key: 'streaming', label: 'Streaming Responses',  desc: 'Stream chat responses token-by-token' },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer group py-1">
            <div>
              <p className="text-white text-sm group-hover:text-accent transition-colors">{label}</p>
              <p className="text-muted text-xs mt-0.5">{desc}</p>
            </div>
            <div className={`relative w-10 h-5 rounded-full border transition-all ${(cfg as any)[key] ? 'bg-accent/20 border-accent/30' : 'bg-dim border-dim'}`}
              onClick={() => set(key as any, !(cfg as any)[key])}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${(cfg as any)[key] ? 'left-[calc(100%-18px)] bg-accent' : 'left-0.5 bg-muted'}`} />
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary">
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
        <button onClick={reset} className="btn-secondary text-xs">Reset Defaults</button>
      </div>
    </div>
  );
}
