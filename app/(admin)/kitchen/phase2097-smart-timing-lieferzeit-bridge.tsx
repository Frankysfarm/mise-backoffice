'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Truck, ChefHat, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BridgeOrder {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_status: 'cooking' | 'ready' | 'waiting' | 'dispatched';
  prep_remaining_min: number | null;
  driver_eta_min: number | null;
  delivery_eta_min: number | null;
  gap_min: number | null;
  risk: 'ok' | 'warn' | 'late';
}

interface ApiData {
  orders: BridgeOrder[];
  sync_score: number;
  late_count: number;
  warn_count: number;
}

const MOCK: ApiData = {
  sync_score: 84,
  late_count: 1,
  warn_count: 2,
  orders: [
    { order_id: '1', bestellnummer: 'M-0041', kunde_name: 'Schmidt A.', prep_status: 'cooking', prep_remaining_min: 4, driver_eta_min: 8, delivery_eta_min: 22, gap_min: 4, risk: 'ok' },
    { order_id: '2', bestellnummer: 'M-0042', kunde_name: 'Meyer B.', prep_status: 'ready', prep_remaining_min: 0, driver_eta_min: 12, delivery_eta_min: 26, gap_min: 12, risk: 'warn' },
    { order_id: '3', bestellnummer: 'M-0043', kunde_name: 'Klein C.', prep_status: 'cooking', prep_remaining_min: 18, driver_eta_min: 5, delivery_eta_min: 34, gap_min: -13, risk: 'late' },
    { order_id: '4', bestellnummer: 'M-0044', kunde_name: 'Wolf D.', prep_status: 'dispatched', prep_remaining_min: null, driver_eta_min: null, delivery_eta_min: 8, gap_min: null, risk: 'ok' },
  ],
};

interface Props { locationId?: string | null }

function riskColor(risk: BridgeOrder['risk']) {
  if (risk === 'late') return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
  if (risk === 'warn') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
  return { bg: 'bg-matcha-50/60 border-matcha-200', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700' };
}

function prepLabel(s: BridgeOrder['prep_status']) {
  if (s === 'cooking') return { icon: ChefHat, label: 'Kocht', cls: 'text-orange-600' };
  if (s === 'ready') return { icon: CheckCircle2, label: 'Fertig', cls: 'text-matcha-600' };
  if (s === 'dispatched') return { icon: Truck, label: 'Unterwegs', cls: 'text-blue-600' };
  return { icon: Clock, label: 'Wartet', cls: 'text-muted-foreground' };
}

export function KitchenPhase2097SmartTimingLieferzeitBridge({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/timing-bridge?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1_000); return () => clearInterval(t); }, []);

  const syncColor = data.sync_score >= 85 ? 'text-matcha-600' : data.sync_score >= 70 ? 'text-amber-600' : 'text-red-600';
  const hasAlert = data.late_count > 0 || data.warn_count > 0;

  const liveOrders = useMemo(() => data.orders.map(o => ({
    ...o,
    prep_remaining_min: o.prep_remaining_min !== null ? Math.max(0, o.prep_remaining_min - tick / 60) : null,
  })), [data.orders, tick]);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Zap className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-amber-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing · Liefer-Sync</span>
        <span className={cn('ml-1 text-xs font-black tabular-nums', syncColor)}>Score {data.sync_score}</span>
        {data.late_count > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
            {data.late_count} spät
          </span>
        )}
        {data.warn_count > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            {data.warn_count} Risiko
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {liveOrders.map(o => {
            const col = riskColor(o.risk);
            const { icon: Icon, label, cls } = prepLabel(o.prep_status);
            const prepMin = o.prep_remaining_min !== null ? Math.ceil(o.prep_remaining_min) : null;
            const prepSec = o.prep_remaining_min !== null
              ? Math.floor(((o.prep_remaining_min % 1) * 60))
              : null;
            return (
              <div key={o.order_id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', col.bg)}>
                {/* Status dot */}
                <Icon className={cn('h-3.5 w-3.5 shrink-0', cls)} />

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black tabular-nums">{o.bestellnummer}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{o.kunde_name}</span>
                    <span className={cn('ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md', col.badge)}>
                      {label}
                    </span>
                  </div>

                  {/* Timeline bar */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {/* Prep */}
                    <div className="flex items-center gap-1 shrink-0">
                      <ChefHat className="h-2.5 w-2.5 text-orange-500" />
                      <span className="text-[10px] font-mono tabular-nums font-bold text-orange-700">
                        {prepMin !== null
                          ? prepMin > 0 ? `${prepMin}m${prepSec !== null ? `:${String(prepSec).padStart(2, '0')}` : ''}` : '✓'
                          : '—'}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">→</span>
                    {/* Driver ETA */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Truck className="h-2.5 w-2.5 text-blue-500" />
                      <span className="text-[10px] font-mono tabular-nums font-bold text-blue-700">
                        {o.driver_eta_min !== null ? `${o.driver_eta_min}m` : '—'}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">→</span>
                    {/* Delivery */}
                    <div className="flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-2.5 w-2.5 text-matcha-500" />
                      <span className="text-[10px] font-mono tabular-nums font-bold text-matcha-700">
                        {o.delivery_eta_min !== null ? `${o.delivery_eta_min}m` : '—'}
                      </span>
                    </div>
                    {/* Gap */}
                    {o.gap_min !== null && (
                      <span className={cn(
                        'ml-auto text-[10px] font-mono tabular-nums font-black',
                        o.gap_min < 0 ? 'text-red-600' : o.gap_min > 10 ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        {o.gap_min >= 0 ? `+${o.gap_min}m` : `${o.gap_min}m`}
                      </span>
                    )}
                    {o.risk === 'late' && (
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {liveOrders.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-3">
              Keine aktiven Bestellungen
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-matcha-400 mr-1" />ok
              </span>
              <span className="text-[10px] text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />Risiko
              </span>
              <span className="text-[10px] text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />Spät
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground">30s-Update</span>
          </div>
        </div>
      )}
    </div>
  );
}
