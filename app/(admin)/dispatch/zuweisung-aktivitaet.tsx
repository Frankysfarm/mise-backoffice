'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, Bike, RefreshCw, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface AssignmentEvent {
  id: string;
  batch_id: string;
  driver_name: string;
  order_count: number;
  zone: string | null;
  accepted: boolean;
  assigned_at: string;
  elapsed_sec: number;
}

interface AssignmentStats {
  total: number;
  accepted: number;
  rejected: number;
  acceptancePct: number;
  avgResponseSec: number;
}

function useTick(ms: number) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function fmtAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h`;
}

export function DispatchZuweisungsAktivitaet({ locationId }: { locationId: string | null }) {
  const [events, setEvents] = useState<AssignmentEvent[]>([]);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(false);

  useTick(30_000);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tours?location_id=${locationId}&action=assignment_activity`);
      if (r.ok) {
        const d = await r.json();
        setEvents(d.events ?? []);
        setStats(d.stats ?? null);
      }
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  // Build mock data if API doesn't return events (graceful fallback)
  const displayEvents = events.length > 0 ? events : [];

  if (!locationId) return null;

  const acceptancePct = stats?.acceptancePct ?? null;
  const total = stats?.total ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white">
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Zuweisungs-Aktivität
        </span>
        {acceptancePct !== null && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            acceptancePct >= 80 ? 'bg-matcha-100 text-matcha-700' :
            acceptancePct >= 60 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700',
          )}>
            {Math.round(acceptancePct)}% Annahmequote
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="ml-1 rounded-full p-1 hover:bg-muted transition"
        >
          <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 divide-x border-b bg-muted/20">
          {[
            { label: 'Gesamt', value: stats.total, icon: Bike, color: 'text-foreground' },
            { label: 'Angenommen', value: stats.accepted, icon: CheckCircle2, color: 'text-matcha-600' },
            { label: 'Abgelehnt', value: stats.rejected, icon: XCircle, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex flex-col items-center py-2.5 gap-0.5">
              <Icon className={cn('h-3.5 w-3.5', color)} />
              <span className={cn('text-lg font-black tabular-nums', color)}>{value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y max-h-52 overflow-y-auto">
        {displayEvents.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {loading ? 'Lade Zuweisung-Events…' : 'Noch keine Zuweisungen in dieser Schicht.'}
          </div>
        ) : (
          displayEvents.slice(0, 8).map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
              {ev.accepted
                ? <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate">{ev.driver_name}</span>
                  {ev.zone && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                      {ev.zone}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {ev.order_count} Bestellung{ev.order_count !== 1 ? 'en' : ''} · {ev.elapsed_sec}s Reaktion
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {fmtAgo(ev.assigned_at)}
              </span>
            </div>
          ))
        )}
      </div>

      {stats && stats.avgResponseSec > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Ø Reaktionszeit: <span className="font-bold text-foreground">{Math.round(stats.avgResponseSec)}s</span>
        </div>
      )}
    </Card>
  );
}
