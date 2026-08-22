'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, X, MessageCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: 'fahrer' | 'kunde' | 'system';
  nachricht: string;
  created_at: string;
}

interface Props {
  orderId: string;
  customerName: string;
  bestellnummer: string;
  onClose: () => void;
}

const QUICK_REPLIES = [
  'Wir haben deine Bestellung erhalten — bestätigen sie gleich.',
  'Wir bereiten alles vor, dauert noch etwa 10 Min.',
  'Leider ist {Produkt} ausverkauft. Sollen wir es austauschen?',
  'Dein Fahrer ist gleich bei dir.',
  'Es dauert etwas länger als erwartet, sorry für die Verspätung!',
];

export function ChatModal({ orderId, customerName, bestellnummer, onClose }: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const { data } = await supabase
        .from('order_messages')
        .select('id, sender, nachricht, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (stopped) return;
      setMessages((data as Message[]) ?? []);
      setLoading(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    })();

    const channel = supabase
      .channel(`inbox-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` },
        (payload: { new: Message }) => {
          const m = payload.new;
          setMessages((prev) => [...prev, m]);
          setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
        },
      )
      .subscribe();

    return () => {
      stopped = true;
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  async function send(content?: string) {
    const msg = (content ?? text).trim();
    if (!msg) return;
    setSending(true);
    setText('');
    try {
      await supabase.from('order_messages').insert({
        order_id: orderId,
        sender: 'fahrer',
        nachricht: msg,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="flex h-[88vh] sm:h-[600px] w-full sm:max-w-md flex-col rounded-t-3xl sm:rounded-3xl bg-white border-2 border-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-700 text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-black truncate">{customerName}</div>
            <div className="text-xs text-zinc-500">#{bestellnummer} · Live-Chat</div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-9 w-9 rounded-full border-2 border-zinc-200 grid place-items-center hover:bg-zinc-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 bg-zinc-50">
          {loading && (
            <div className="grid place-items-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Noch keine Nachricht.</p>
              <p className="text-xs text-zinc-400 mt-1">
                Schreib dem Kunden — er sieht's live auf der Bestätigungs-Seite.
              </p>
            </div>
          )}
          {messages.map((m) => {
            const isMine = m.sender === 'fahrer';
            const isSystem = m.sender === 'system';
            return (
              <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
                    isMine && 'rounded-br-md bg-matcha-700 text-white',
                    isSystem && 'rounded-md border bg-zinc-100 text-xs italic text-zinc-600',
                    !isMine && !isSystem && 'rounded-bl-md bg-white border border-zinc-200',
                  )}
                >
                  <div className="whitespace-pre-wrap">{m.nachricht}</div>
                  <div className={cn('mt-1 text-[10px]', isMine ? 'text-matcha-200' : 'text-zinc-400')}>
                    {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Replies */}
        <div className="border-t bg-white p-2 overflow-x-auto">
          <div className="flex gap-1.5">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={sending}
                className="shrink-0 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 disabled:opacity-50"
              >
                {q.length > 32 ? q.slice(0, 30) + '…' : q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 border-t p-3 bg-white">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Nachricht an den Kunden…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border-2 border-zinc-200 px-3 py-2.5 text-sm focus:border-matcha-500 focus:outline-none focus:ring-2 focus:ring-matcha-500/20 max-h-32"
          />
          <button
            onClick={() => send()}
            disabled={sending || !text.trim()}
            className="h-11 w-11 grid place-items-center rounded-2xl bg-matcha-700 text-white hover:bg-matcha-800 disabled:opacity-50 shadow"
            aria-label="Senden"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
