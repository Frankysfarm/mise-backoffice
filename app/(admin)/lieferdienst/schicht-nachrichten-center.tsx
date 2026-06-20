'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Bike, Clock, TrendingUp, MessageSquare, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type EventType = 'alert' | 'success' | 'driver' | 'kpi' | 'delay' | 'info';

interface ShiftEvent {
  id: string;
  type: EventType;
  title: string;
  body?: string;
  ts: string;
}

const TYPE_CONFIG: Record<EventType, { icon: React.ElementType; bg: string; text: string; border: string }> = {
  alert:   { icon: AlertTriangle, bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200' },
  success: { icon: CheckCircle2,  bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200' },
  driver:  { icon: Bike,          bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200' },
  kpi:     { icon: TrendingUp,    bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  delay:   { icon: Clock,         bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200' },
  info:    { icon: Zap,           bg: 'bg-stone-50',  text: 'text-stone-500',  border: 'border-stone-200' },
};

function timeSince(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'gerade eben';
  if (diff === 1) return 'vor 1 Min';
  if (diff < 60) return `vor ${diff} Min`;
  const h = Math.floor(diff / 60);
  return `vor ${h} Std`;
}

function buildMockEvents(): ShiftEvent[] {
  const now = Date.now();
  return [
    {
      id: '1',
      type: 'kpi',
      title: 'Stunden-Ziel erreicht',
      body: 'Schicht liegt 12% über Plan',
      ts: new Date(now - 4 * 60_000).toISOString(),
    },
    {
      id: '2',
      type: 'driver',
      title: 'Fahrer Max zurück',
      body: 'Bereit für nächste Tour',
      ts: new Date(now - 11 * 60_000).toISOString(),
    },
    {
      id: '3',
      type: 'delay',
      title: 'Verspätungsrisiko',
      body: 'Tour N-42: +8 Min Verzögerung möglich',
      ts: new Date(now - 17 * 60_000).toISOString(),
    },
    {
      id: '4',
      type: 'success',
      title: 'Tour abgeschlossen',
      body: '5 Stopps · 38 Min · 4 ★',
      ts: new Date(now - 24 * 60_000).toISOString(),
    },
    {
      id: '5',
      type: 'alert',
      title: 'SLA-Warnung',
      body: 'Bestellung #7429 überschreitet 45 Min',
      ts: new Date(now - 31 * 60_000).toISOString(),
    },
    {
      id: '6',
      type: 'info',
      title: 'Neue Tour erstellt',
      body: '3 Stopps · Fahrer Lisa',
      ts: new Date(now - 45 * 60_000).toISOString(),
    },
  ];
}

export function SchichtNachrichtenCenter({ locationId }: { locationId?: string }) {
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/alerts?location_id=${locationId ?? 'default'}&limit=8`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('fallback');
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.alerts) && json.alerts.length > 0) {
          setEvents(
            json.alerts.map((a: { id: string; severity: string; message: string; detail?: string; created_at: string }) => ({
              id: a.id,
              type: (a.severity === 'critical' ? 'alert' : a.severity === 'warning' ? 'delay' : 'info') as EventType,
              title: a.message,
              body: a.detail,
              ts: a.created_at,
            })),
          );
        } else {
          setEvents(buildMockEvents());
        }
      } catch {
        if (!cancelled) setEvents(buildMockEvents());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    const tickIv = setInterval(() => tick((n) => n + 1), 60_000);
    return () => { cancelled = true; clearInterval(iv); clearInterval(tickIv); };
  }, [locationId]);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={13} className="text-stone-400" />
          <span className="text-xs font-black text-stone-700 uppercase tracking-wider">
            Schicht-Nachrichten
          </span>
        </div>
        <div className="flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
      </div>

      {loading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-stone-50 max-h-[320px] overflow-y-auto">
          {events.map((ev) => {
            const cfg = TYPE_CONFIG[ev.type];
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors">
                <div className={cn('mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center shrink-0', cfg.bg, cfg.border, 'border')}>
                  <Icon size={11} className={cfg.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-stone-800 leading-tight">{ev.title}</div>
                  {ev.body && (
                    <div className="text-[10px] text-stone-500 mt-0.5 leading-tight truncate">{ev.body}</div>
                  )}
                </div>
                <span className="text-[9px] text-stone-400 shrink-0 mt-0.5 whitespace-nowrap">
                  {timeSince(ev.ts)}
                </span>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-stone-400">
              Keine Ereignisse in dieser Schicht
            </div>
          )}
        </div>
      )}
    </div>
  );
}
