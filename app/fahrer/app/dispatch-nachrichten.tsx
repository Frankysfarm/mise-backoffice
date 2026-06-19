'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'urgent';
  created_at: string;
  read?: boolean;
}

const BORDER_COLOR: Record<string, string> = {
  urgent:  'border-l-red-400',
  warning: 'border-l-amber-400',
  info:    'border-l-blue-400',
};

export function FahrerDispatchNachrichten() {
  const [messages, setMessages] = useState<Broadcast[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/driver/messages');
      if (res.ok) {
        const data = await res.json();
        const raw: Broadcast[] = data.broadcasts ?? data.messages ?? [];
        setMessages(raw);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 30_000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  async function markRead(broadcastId: string) {
    setMessages((ms) => ms.map((m) => (m.id === broadcastId ? { ...m, read: true } : m)));
    await fetch('/api/delivery/driver/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcast_id: broadcastId }),
    }).catch(() => {});
  }

  if (loading || messages.length === 0) return null;

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="relative flex-shrink-0">
          <Megaphone className="w-5 h-5 text-matcha-600" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold leading-none">
              {unread}
            </span>
          )}
        </div>
        <span className="flex-1 text-sm font-semibold text-gray-800">Dispatch-Nachrichten</span>
        <span className="text-xs text-gray-400 mr-1">{messages.length}</span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'px-4 py-3 flex gap-3 items-start border-l-4',
                BORDER_COLOR[msg.priority] ?? 'border-l-gray-300',
                msg.read && 'opacity-60',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 leading-snug">{msg.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{msg.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!msg.read && (
                <button
                  onClick={() => markRead(msg.id)}
                  aria-label="Als gelesen markieren"
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <Check className="w-3.5 h-3.5 text-gray-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
