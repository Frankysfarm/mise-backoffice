'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

const WELCOME: Msg = {
  role: 'assistant',
  content: 'Hi! Ich bin Mise-AI. Frag mich alles zu Kasse, Lieferdienst, TSE, DSFinV-K, Einrichtung. Auf Deutsch.',
};

const SUGGESTIONS = [
  'Wie lege ich ein Tablet als Kasse an?',
  'Was ist eine TSE und wie richte ich sie ein?',
  'Wie kann ich einen Bon stornieren?',
  'Wie funktioniert der Auto-Dispatch?',
  'Was ist DSFinV-K?',
];

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || pending) return;

    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setPending(true);

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `⚠️ Mise-AI gerade offline. Versuch's nochmal oder schreib an support@mise.app.\n\n(${data.error ?? 'Fehler'})`,
        }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '⚠️ Netzwerk-Fehler. Bist du offline?',
      }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-matcha-900 text-matcha-50 shadow-2xl flex items-center justify-center hover:bg-matcha-800 hover:scale-105 transition"
          aria-label="Hilfe-Chat öffnen"
        >
          <Bot className="h-6 w-6" />
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-matcha-900 text-[8px] font-bold grid place-items-center">
            AI
          </div>
        </button>
      )}

      {/* Chat-Fenster */}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border">
          {/* Header */}
          <header className="flex items-center gap-3 p-4 border-b bg-gradient-to-br from-matcha-900 to-matcha-700 text-white">
            <div className="h-10 w-10 rounded-full bg-accent text-matcha-900 grid place-items-center">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display font-bold flex items-center gap-1.5">
                Mise-AI
                <Sparkles className="h-3 w-3 text-accent" />
              </div>
              <div className="text-[10px] opacity-70 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Online · Antwortet in Sekunden
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 rounded-full hover:bg-white/10 grid place-items-center"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-2xl p-3 text-sm',
                  m.role === 'user'
                    ? 'ml-auto bg-matcha-900 text-white rounded-br-sm'
                    : 'mr-auto bg-gray-100 text-gray-900 rounded-bl-sm',
                )}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            ))}
            {pending && (
              <div className="mr-auto bg-gray-100 rounded-2xl rounded-bl-sm p-3 text-sm inline-flex items-center gap-2 text-gray-600">
                <Loader2 className="h-3 w-3 animate-spin" /> denkt nach…
              </div>
            )}

            {/* Suggestions */}
            {messages.length === 1 && !pending && (
              <div className="pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Häufige Fragen
                </div>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left rounded-xl border bg-white hover:bg-matcha-50 hover:border-matcha-300 p-2.5 text-xs leading-relaxed transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <footer className="p-3 border-t">
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-1 border focus-within:border-matcha-500">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Frag mich etwas …"
                disabled={pending}
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || pending}
                className="h-9 w-9 rounded-full bg-matcha-900 text-matcha-50 grid place-items-center disabled:opacity-50 hover:bg-matcha-800"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-[10px] text-gray-500 text-center mt-1.5">
              KI kann Fehler machen — bei Wichtigem: <a href="/help" className="underline">Docs</a> oder support@mise.app
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
