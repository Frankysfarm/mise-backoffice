'use client';

import { useEffect, useState, useTransition } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  AlertTriangle, ArrowUp, Clock, Flame, Gauge, List, Loader2,
  RefreshCw, Zap,
} from 'lucide-react';

type QueueOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  priority: string | null;
  delivery_zone: string | null;
  gesamtbetrag: number | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
  wait_minutes: number;
  queue_score: number;
  dispatch_attempts: number;
  priority_label?: string | null;
  status_label?: string | null;
};

type QueueHealth = {
  total_waiting: number;
  avg_wait_minutes: number;
  max_wait_minutes: number;
  high_priority_count: number;
  escalated_count: number;
  score_buckets: { low: number; medium: number; high: number; critical: number };
  by_zone: Record<string, number>;
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-red-500' :
    score >= 50 ? 'bg-orange-500' :
    score >= 25 ? 'bg-amber-400' : 'bg-matcha-500';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={cn(
        'text-[10px] font-black tabular-nums',
        score >= 75 ? 'text-red-600' : score >= 50 ? 'text-orange-500' : score >= 25 ? 'text-amber-600' : 'text-matcha-600',
      )}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export function DispatchQueuePanel({ locationId }: { locationId: string | null }) {
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [boosting, startBoost] = useTransition();
  const [expanded, setExpanded] = useState(true);
  const [lastAt, setLastAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          if (Array.isArray(d.queue)) setQueue(d.queue);
          if (d.health) setHealth(d.health);
          setLastAt(new Date());
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  async function boostOrder(orderId: string, boost: number) {
    if (!locationId) return;
    startBoost(async () => {
      await fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, boost }),
      });
      // Reload
      const res = await fetch(`/api/delivery/admin/dispatch-queue?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.queue)) setQueue(d.queue);
        if (d.health) setHealth(d.health);
      }
    });
  }

  if (!locationId) return null;
  if (!health && queue.length === 0 && !loading) return null;
  if (health?.total_waiting === 0 && queue.length === 0) return null;

  const criticalOrders = queue.filter((o) => o.queue_score >= 75);
  const highOrders = queue.filter((o) => o.queue_score >= 50 && o.queue_score < 75);

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition rounded-xl"
      >
        <List className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Dispatch-Prioritäts-Queue</span>
        {health && (
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
            {health.total_waiting} wartend
          </span>
        )}
        {criticalOrders.length > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            ⚠ {criticalOrders.length} kritisch
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Health row */}
          {health && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kritisch', value: health.score_buckets.critical, color: health.score_buckets.critical > 0 ? 'text-red-600' : 'text-muted-foreground' },
                { label: 'Hoch', value: health.score_buckets.high, color: health.score_buckets.high > 0 ? 'text-orange-600' : 'text-muted-foreground' },
                { label: 'Mittel', value: health.score_buckets.medium, color: health.score_buckets.medium > 0 ? 'text-amber-600' : 'text-muted-foreground' },
                { label: 'Niedrig', value: health.score_buckets.low, color: 'text-matcha-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border bg-muted/20 px-2 py-1.5">
                  <div className={cn('text-lg font-black tabular-nums', color)}>{value}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Health stats strip */}
          {health && (
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ø Wartezeit: <span className="font-bold text-foreground ml-0.5">{Math.round(health.avg_wait_minutes)} Min</span>
              </span>
              {health.max_wait_minutes > 0 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  Max: <span className={cn('font-bold ml-0.5', health.max_wait_minutes >= 20 ? 'text-red-600' : 'text-foreground')}>
                    {Math.round(health.max_wait_minutes)} Min
                  </span>
                </span>
              )}
              {health.escalated_count > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {health.escalated_count} eskaliert
                </span>
              )}
              {lastAt && (
                <span className="ml-auto tabular-nums opacity-60">
                  {lastAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Queue list */}
          {queue.length > 0 ? (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground grid grid-cols-[1fr_auto_auto_auto] gap-2">
                <span>Bestellung</span>
                <span>Warten</span>
                <span>Score</span>
                <span className="text-right">Boost</span>
              </div>
              <div className="divide-y max-h-72 overflow-y-auto">
                {queue.map((order) => {
                  const isCritical = order.queue_score >= 75;
                  const isHigh = order.queue_score >= 50 && order.queue_score < 75;
                  const isEscalated = order.dispatch_attempts >= 3;
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2',
                        isCritical ? 'bg-red-50' : isHigh ? 'bg-orange-50/60' : '',
                      )}
                    >
                      {/* Order info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold truncate">{order.kunde_name ?? order.bestellnummer}</span>
                          {order.delivery_zone && (
                            <span className="shrink-0 rounded px-1 py-0 text-[8px] font-bold bg-muted text-muted-foreground">
                              Zone {order.delivery_zone}
                            </span>
                          )}
                          {isEscalated && (
                            <span className="shrink-0 text-[8px] font-bold text-red-600 animate-pulse">⚠ Eskaliert</span>
                          )}
                          {order.priority === 'express' && (
                            <span className="shrink-0 rounded-full bg-amber-100 text-amber-700 px-1 py-0 text-[8px] font-black">
                              <Zap className="h-2 w-2 inline" /> Express
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {order.kunde_adresse ?? order.bestellnummer}
                          {order.gesamtbetrag != null && (
                            <span className="ml-1 text-foreground font-semibold">{euro(order.gesamtbetrag)}</span>
                          )}
                        </div>
                      </div>

                      {/* Wait time */}
                      <span className={cn(
                        'shrink-0 text-[11px] font-black tabular-nums',
                        order.wait_minutes >= 20 ? 'text-red-600' : order.wait_minutes >= 10 ? 'text-orange-500' : 'text-muted-foreground',
                      )}>
                        {Math.round(order.wait_minutes)}m
                      </span>

                      {/* Score bar */}
                      <ScoreBar score={order.queue_score} />

                      {/* Boost button */}
                      <button
                        onClick={() => boostOrder(order.id, 20)}
                        disabled={boosting}
                        className="shrink-0 flex items-center gap-0.5 rounded-lg bg-matcha-100 text-matcha-700 hover:bg-matcha-200 transition px-1.5 py-1 text-[9px] font-black disabled:opacity-50"
                        title="Priorität boosten (+20)"
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                        +20
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-[11px] text-muted-foreground">
              Keine wartenden Bestellungen
            </div>
          )}

          {/* Zone breakdown */}
          {health && Object.keys(health.by_zone).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Zonen:</span>
              {Object.entries(health.by_zone)
                .sort(([, a], [, b]) => b - a)
                .map(([zone, count]) => (
                  <span key={zone} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                    Zone {zone}
                    <span className="ml-0.5 rounded-full bg-foreground/10 px-1 text-[9px] font-black">{count}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
