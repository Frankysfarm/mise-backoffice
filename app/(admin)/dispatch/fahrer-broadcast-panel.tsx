'use client';

import { useEffect, useState } from 'react';
import { Radio, Send, Users, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

type Priority = 'normal' | 'urgent';

interface BroadcastResult {
  driverId: string;
  driverName: string | null;
  status: 'sent' | 'failed' | 'offline';
}

export function DispatchFahrerBroadcastPanel({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sentCount: number; results: BroadcastResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const charLeft = 500 - message.length;

  const send = async () => {
    if (!locationId || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/delivery/admin/driver-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, message: message.trim(), priority }),
      });
      const data = await res.json();
      if (data.ok !== false) {
        setResult({ sentCount: data.sentCount ?? 0, results: data.results ?? [] });
        setMessage('');
      } else {
        setError(data.error ?? 'Fehler beim Senden');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <Radio className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Broadcast</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Nachricht an alle Fahrer</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Priority selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setPriority('normal')}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-xs font-bold border transition-colors',
                priority === 'normal'
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              Normal
            </button>
            <button
              onClick={() => setPriority('urgent')}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-xs font-bold border transition-colors',
                priority === 'urgent'
                  ? 'bg-red-100 border-red-300 text-red-700'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              Dringend
            </button>
          </div>

          {/* Message textarea */}
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Nachricht an alle aktiven Fahrer eingeben…"
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className={cn('absolute bottom-2 right-2 text-[9px] tabular-nums', charLeft < 50 ? 'text-red-500' : 'text-muted-foreground')}>
              {charLeft}
            </span>
          </div>

          {/* Send button */}
          <button
            onClick={send}
            disabled={!message.trim() || sending}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors',
              message.trim() && !sending
                ? priority === 'urgent'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <Send className="h-4 w-4" />
            {sending ? 'Wird gesendet…' : 'An alle Fahrer senden'}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-bold text-matcha-700 mb-1.5">
                <CheckCircle className="h-4 w-4" />
                Gesendet an {result.sentCount} Fahrer
              </div>
              <div className="space-y-0.5">
                {result.results.map((r) => (
                  <div key={r.driverId} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Users className="h-2.5 w-2.5 shrink-0" />
                    <span className="flex-1 truncate">{r.driverName ?? r.driverId}</span>
                    <span className={cn(
                      'font-bold',
                      r.status === 'sent' ? 'text-matcha-600' :
                      r.status === 'offline' ? 'text-amber-500' : 'text-red-500',
                    )}>
                      {r.status === 'sent' ? 'Gesendet' : r.status === 'offline' ? 'Offline' : 'Fehler'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
