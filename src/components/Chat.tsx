import { useState, useRef, useEffect, useCallback } from 'react';
import { streamChat, type ChatMessage } from '../lib/api';

const QUICK_ACTIONS = [
  'List steps to scrape a product listing page',
  'Generate a Playwright script to fill a login form',
  'Extract all tables from a given URL as JSON',
  'Write an automation to monitor a price change',
  'Describe how to analyse an invoice image',
];

function escapeHtml(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text: string) {
  const safe = escapeHtml(text);
  return safe
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/40 rounded p-3 my-2 text-[12px] overflow-x-auto text-[#9ab0c8] leading-relaxed">$2</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/40 px-1.5 py-0.5 rounded text-accent text-[12px]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\n/g, '<br/>');
}

function loadSettings() {
  try {
    const stored = localStorage.getItem('axonqwen-settings');
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export default function Chat() {
  const settings = loadSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [model, setModel]       = useState(settings?.model || 'qwen3.5');
  const [temp, setTemp]         = useState(settings?.temperature ?? 0.6);
  const [sysPrompt, setSysPrompt] = useState(settings?.systemPrompt || '');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || streaming) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setStreaming(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      for await (const chunk of streamChat(newMsgs, { model, temperature: temp, systemPrompt: sysPrompt || undefined })) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `**Error:** ${e.message}. Make sure the AxonQwen server is running.` };
        return copy;
      });
    }
    setStreaming(false);
  }, [input, messages, streaming, model, temp, sysPrompt]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-6xl">◈</div>
              <div className="text-center">
                <h3 className="font-display font-bold text-white text-xl mb-2">AxonQwen Chat</h3>
                <p className="text-muted text-sm max-w-sm">Powered by Qwen3.5 running locally via Ollama. Ask anything about automation.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                {QUICK_ACTIONS.map((qa, i) => (
                  <button key={i} onClick={() => send(qa)}
                    className="text-left text-xs text-muted px-4 py-3 rounded-lg border border-dim hover:border-accent/30 hover:text-accent hover:bg-dim/50 transition-all font-mono">
                    {qa}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-[10px] font-bold mr-2 mt-1 flex-shrink-0">AQ</div>
              )}
              <div
                className={msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) || (streaming && i === messages.length - 1 ? '<span class="opacity-50 animate-pulse">▋</span>' : '') }}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-dim p-4">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message AxonQwen… (Enter to send, Shift+Enter for newline)"
              disabled={streaming}
              rows={2}
              className="field flex-1 resize-none leading-relaxed"
            />
            <button onClick={() => send()} disabled={streaming || !input.trim()}
              className="btn-primary px-6 self-end disabled:opacity-40 disabled:cursor-not-allowed">
              {streaming ? '⟳' : '↑'}
            </button>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="mt-2 text-[11px] text-muted hover:text-accent2 transition-colors font-mono">
              ✕ Clear conversation
            </button>
          )}
        </div>
      </div>

      {/* Settings sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-dim p-5 space-y-5 overflow-y-auto hidden xl:block">
        <h3 className="font-display font-bold text-white text-sm">Settings</h3>

        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Model</label>
          <select value={model} onChange={e => setModel(e.target.value)} className="field text-xs">
            {['qwen3.5','qwen3.5:7b','qwen3.5:14b','qwen3.5:27b','qwen3.5:35b'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">Temperature: {temp}</label>
          <input type="range" min="0" max="2" step="0.1" value={temp} onChange={e => setTemp(+e.target.value)}
            className="w-full accent-accent" />
        </div>

        <div>
          <label className="text-[10px] text-muted uppercase tracking-widest block mb-2">System Prompt</label>
          <textarea value={sysPrompt} onChange={e => setSysPrompt(e.target.value)}
            placeholder="Optional system prompt…" rows={5} className="field text-xs resize-none" />
        </div>

        <div className="pt-2 border-t border-dim space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted">Messages</span>
            <span className="text-white">{messages.length}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted">Status</span>
            <span className={streaming ? 'text-accent animate-pulse' : 'text-green-400'}>{streaming ? 'Streaming…' : 'Ready'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
