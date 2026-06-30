'use client';

import { useEffect, useState } from 'react';
import { Loader2, Flame, Clock, User, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

interface PrioOrder {
  orderId: string;
  bestellnummer: string | null;
  kundeName: string | null;
  itemCount: number;
  status: string;
  priorityScore: number;
  urgencyLevel: UrgencyLevel;
  reasonLabel: string;
  batchStartsInMin: number | null;
  driverEtaMin: number | null;
  waitSinceMin: number;
  zone: string | null;
}

interface ApiResponse {
  ok: boolean;
  orders: PrioOrder[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const urgencyStyle: Record<UrgencyLevel, { row: string; badge: string; label: string; bar: string; score: string }> = {
  critical: { row: 'bg-red-50',    badge: 'bg-red-100 text-red-700',       label: 'Kritisch',  bar: 'bg-red-500',    score: 'text-red-600' },
  high:     { row: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', label: 'Hoch',      bar: 'bg-orange-400', score: 'text-orange-600' },
  medium:   { row: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',   label: 'Mittel',    bar: 'bg-amber-400',  score: 'text-amber-600' },
  low:      { row: 'bg-stone-50',  badge: 'bg-stone-100 text-stone-600',   label: 'Normal',    bar: 'bg-stone-300',  score: 'text-stone-500' },
};

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu', new: 'Neu', bestätigt: 'Bestätigt', confirmed: 'Bestätigt',
  offen: 'Offen', pending: 'Ausstehend',
  in_zubereitung: 'In Zubereitung', preparing: 'In Zubereitung', in_preparation: 'In Zubereitung',
  fertig: 'Fertig', ready: 'Fertig', bereit: 'Fertig',
};

export function KitchenPrioritaetsBoard({ locationId }: Props) {
  const [orders, setOrders] = useState<PrioOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-prioritaet?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setOrders(d.orders ?? []);
        setLastUpdate(d.generatedAt ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && orders.length === 0) return null;

  const criticalCount = orders.filter((o) => o.urgencyLevel === 'critical').length;
  const highCount = orders.filter((o) => o.urgencyLevel === 'high').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Flame className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Küchen-Prioritäten</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {criticalCount > 0 && (
          <span className="ml-2 rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
            {criticalCount} kritisch
          </span>
        )}
        {highCount > 0 && (
          <span className="ml-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-bold">
            {highCount} hoch
          </span>
        )}
        {!loading && criticalCount === 0 && highCount === 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {orders.length} aktiv — alle normal
          </span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Legend */}
          <div className="flex gap-3 px-5 py-2 border-b border-stone-100 bg-stone-50 text-[10px] text-stone-500 flex-wrap">
            {(['critical', 'high', 'medium', 'low'] as UrgencyLevel[]).map((lvl) => {
              const s = urgencyStyle[lvl];
              const cnt = orders.filter((o) => o.urgencyLevel === lvl).length;
              if (cnt === 0) return null;
              return (
                <span key={lvl} className={cn('rounded-full px-2 py-0.5 font-bold', s.badge)}>
                  {s.label}: {cnt}
                </span>
              );
            })}
            {lastUpdate && (
              <span className="ml-auto">
                {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          {/* Order List */}
          <div className="divide-y divide-stone-100 max-h-[420px] overflow-y-auto">
            {orders.map((order, idx) => {
              const s = urgencyStyle[order.urgencyLevel];
              const statusLabel = STATUS_LABELS[order.status] ?? order.status;

              return (
                <div key={order.orderId} className={cn('px-4 py-3 flex items-start gap-3', s.row)}>
                  {/* Rank */}
                  <div className="w-6 shrink-0 mt-0.5 text-center">
                    <span className={cn('text-xs font-black tabular-nums', s.score)}>#{idx + 1}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>
                        {s.label}
                      </span>
                      {order.bestellnummer && (
                        <span className="text-xs font-bold text-foreground">#{order.bestellnummer}</span>
                      )}
                      {order.zone && (
                        <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                          Zone {order.zone}
                        </span>
                      )}
                      <span className="text-[10px] text-stone-400">{statusLabel}</span>
                    </div>

                    {/* Customer + items */}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-600">
                      {order.kundeName && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          {order.kundeName}
                        </span>
                      )}
                      {order.itemCount > 0 && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Package className="h-3 w-3" />
                          {order.itemCount} Pos.
                        </span>
                      )}
                      <span className="flex items-center gap-1 shrink-0 text-stone-400">
                        <Clock className="h-3 w-3" />
                        {order.waitSinceMin} Min
                      </span>
                    </div>

                    {/* Reason + ETA */}
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className={cn('font-bold', s.score)}>{order.reasonLabel}</span>
                      {order.driverEtaMin !== null && (
                        <span className="text-stone-400">· Fahrer ETA {order.driverEtaMin} Min</span>
                      )}
                    </div>

                    {/* Score Bar */}
                    <div className="mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', s.bar)}
                        style={{ width: `${order.priorityScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div className={cn('shrink-0 text-right font-mono font-black text-lg tabular-nums', s.score)}>
                    {order.priorityScore}
                    <div className="text-[8px] font-normal text-stone-400">Score</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
