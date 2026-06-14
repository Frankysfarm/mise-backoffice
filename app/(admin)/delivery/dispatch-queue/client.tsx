'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { CheckCircle2, RefreshCw, TrendingUp, Zap } from 'lucide-react';

interface QueueOrder {
  id: string;
  bestellnummer: string;
  status: string;
  priority: string | null;
  delivery_zone: string | null;
  gesamtbetrag: number | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
  dispatch_attempts: number;
  dispatch_priority_boost: number;
  queue_score: number;
  wait_minutes: number;
  eta_latest: string | null;
}

interface QueueHealthMetrics {
  total_waiting: number;
  avg_wait_minutes: number;
  max_wait_minutes: number;
  high_priority_count: number;
  escalated_count: number;
}

interface QueueData {
  queue: QueueOrder[];
  health: QueueHealthMetrics;
}

export function DispatchQueueClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.health) setData(d as QueueData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  const boost = async (orderId: string, boostVal: number) => {
    setBoosting(orderId);
    await fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, boost: boostVal }),
    });
    setBoosting(null);
    load();
  };

  const resetBoost = async (orderId: string) => {
    setBoosting(orderId);
    await fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}&order_id=${orderId}`, { method: 'DELETE' });
    setBoosting(null);
    load();
  };

  const health = data?.health;

  return (
    <div className="space-y-6">
      {/* Health KPIs */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn('rounded-xl border px-4 py-3', (health.total_waiting ?? 0) > 10 ? 'bg-amber-50 border-amber-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Wartend</div>
            <div className={cn('font-display text-2xl font-black', (health.total_waiting ?? 0) > 10 ? 'text-amber-700' : '')}>{health.total_waiting ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Wartezeit</div>
            <div className="font-display text-2xl font-black">{Math.round(health.avg_wait_minutes ?? 0)} Min</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', (health.escalated_count ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Eskaliert</div>
            <div className={cn('font-display text-2xl font-black', (health.escalated_count ?? 0) > 0 ? 'text-red-700' : '')}>{health.escalated_count ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Max. Wartezeit</div>
            <div className="font-display text-2xl font-black">{Math.round(health.max_wait_minutes ?? 0)} Min</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">Auto alle 20 Sek.</span>
      </div>

      {loading && !data && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Dispatch-Queue…</div>}

      {!loading && data && data.queue.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          Keine Bestellungen in der Dispatch-Queue.
        </div>
      )}

      {data && data.queue.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">{data.queue.length} Bestellungen in der Queue</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Bestellung</th>
                  <th className="text-left px-4 py-2">Zone</th>
                  <th className="text-left px-4 py-2">Wartezeit</th>
                  <th className="text-left px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Versuche</th>
                  <th className="text-left px-4 py-2">Boost</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map((order, rank) => (
                  <tr key={order.id} className={cn('border-t border-border', rank === 0 && 'bg-matcha-50/30')}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-[11px] font-black text-muted-foreground">
                        {rank + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-bold">#{order.bestellnummer}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {order.kunde_name ?? '—'}
                        {order.gesamtbetrag !== null ? ` · ${euro(order.gesamtbetrag)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{order.delivery_zone ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-sm font-bold tabular-nums', order.wait_minutes >= 20 ? 'text-red-600' : order.wait_minutes >= 10 ? 'text-amber-600' : 'text-muted-foreground')}>
                        {Math.round(order.wait_minutes)} Min
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-bold tabular-nums">{Math.round(order.queue_score)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{order.dispatch_attempts}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {order.dispatch_priority_boost > 0 && (
                          <span className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5 font-bold">
                            +{order.dispatch_priority_boost}
                          </span>
                        )}
                        <button
                          onClick={() => boost(order.id, 10)}
                          disabled={boosting === order.id}
                          className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-semibold bg-matcha-50 border border-matcha-200 text-matcha-700 hover:bg-matcha-100 transition disabled:opacity-50"
                          title="Priorität um 10 boosten"
                        >
                          <Zap className="h-2.5 w-2.5" />+10
                        </button>
                        {order.dispatch_priority_boost > 0 && (
                          <button
                            onClick={() => resetBoost(order.id)}
                            disabled={boosting === order.id}
                            className="rounded px-1.5 py-1 text-[11px] font-semibold bg-muted border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
