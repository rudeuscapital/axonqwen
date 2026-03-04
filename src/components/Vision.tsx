import { useState, useRef } from 'react';
import { analyzeVision, toBase64 } from '../lib/api';

function escapeHtml(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text: string) {
  const safe = escapeHtml(text);
  return safe
    .replace(/```[\s\S]*?```/g, m => `<pre class="bg-black/40 rounded p-3 my-2 overflow-x-auto">${m.slice(3,-3).trim()}</pre>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\n/g, '<br/>');
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export default function Vision() {
  const [imgB64, setImgB64]       = useState<string | null>(null);
  const [imgPreview, setPreview]  = useState<string | null>(null);
  const [instruction, setInst]    = useState('');
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }
    const b64 = await toBase64(file);
    setImgB64(b64);
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const analyze = async () => {
    if (!imgB64) return;
    setRunning(true);
    setError(null);
    try {
      const r = await analyzeVision(imgB64, instruction || undefined);
      setResult(r.result);
    } catch (e: any) {
      setError(e.message);
    }
    setRunning(false);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="font-display font-bold text-white text-2xl mb-1">Vision Agent</h2>
        <p className="text-muted text-sm">Upload any image — invoice, contract, screenshot, form. Qwen3.5 extracts all text, tables, and structured data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-dim hover:border-accent/40 rounded-xl p-8 text-center cursor-pointer transition-colors group min-h-[200px] flex flex-col items-center justify-center"
          >
            {imgPreview ? (
              <img src={imgPreview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <>
                <div className="text-4xl mb-4 text-muted group-hover:text-accent transition-colors">◑</div>
                <p className="text-muted text-sm mb-1">Drop an image here or click to upload</p>
                <p className="text-muted/50 text-xs">JPEG, PNG, WebP — any size</p>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div>
            <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Instruction (optional)</label>
            <textarea value={instruction} onChange={e => setInst(e.target.value)}
              placeholder="What should I extract? e.g. 'Get all invoice line items as JSON'"
              rows={3} className="field resize-none" />
          </div>

          <button onClick={analyze} disabled={running || !imgB64} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed justify-center">
            {running ? <><span className="animate-spin">⟳</span> Analysing…</> : '◑ Analyse Image'}
          </button>
        </div>

        {/* Result */}
        <div className="bg-wire border border-dim rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-dim flex items-center justify-between">
            <h3 className="font-display font-bold text-white text-sm">Extracted Data</h3>
            {result && (
              <button onClick={() => navigator.clipboard.writeText(result)}
                className="text-xs text-muted hover:text-accent font-mono transition-colors">Copy</button>
            )}
          </div>
          <div className="flex-1 p-5 overflow-y-auto max-h-[420px]">
            {!result && !error && !running && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <span className="text-4xl text-muted/30">◑</span>
                <p className="text-muted/50 text-sm">Upload an image to begin</p>
              </div>
            )}
            {running && (
              <div className="flex items-center gap-3 text-accent text-sm">
                <span className="animate-spin">⟳</span> Qwen3.5 vision analysing…
              </div>
            )}
            {error && <p className="text-accent2 text-sm font-mono">{error}</p>}
            {result && (
              <div className="text-[13px] text-[#9ab0c8] font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
