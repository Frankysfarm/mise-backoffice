'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Zap, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface PrepOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  confirmed_at: string | null;
  promised_prep_min: number | null;
  typ: string;
}

type AmpelStatus = 'gruen' | 'gelb' | 'rot' | 'fertig';

function getAmpel(order: PrepOrder, nowMs: number): { status: AmpelStatus; elapsedMin: number; remainMin: number | null } {
  const startMs = order.confirmed_at ? new Date(order.confirmed_at).getTime() : nowMs;
  const elapsedMin = Math.floor((nowMs - startMs) / 60_000);
  const prepMin = order.promised_prep_min ?? 15;
  const remainMin = Math.max(0, prepMin - elapsedMin);
  const pct = prepMin > 0 ? remainMin / prepMin : 0;

  if (order.status === 'fertig' || order.status === 'ready') return { status: 'fertig', elapsedMin, remainMin };
  if (pct > 0.5) return { status: 'gruen', elapsedMin, remainMin };
  if (pct > 0.15) return { status: 'gelb', elapsedMin, remainMin };
  return { status: 'rot', elapsedMin, remainMin };
}

const AMPEL_STYLE: Record<AmpelStatus, { bg: string; border: string; dot: string; text: string; label: string }> = {
  gruen:  { bg: 'bg-matcha-50',  border: 'border-matcha-200',  dot: 'bg-matcha-500',  text: 'text-matcha-700',  label: 'Pünktlich'  },
  gelb:   { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Knapp'      },
  rot:    { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     text: 'text-red-700',     label: 'Überfällig' },
  fertig: { bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-400',    text: 'text-blue-700',    label: 'Fertig'     },
};

function fmtTime(min: number) {
  if (min < 1) return '< 1 min';
  return `${min} min`;
}

export function KitchenTimingAmpelLive({ locationId }: { locationId: string }) {
  const [orders, setOrders] = useState<PrepOrder[]>([]);
  const [now, setNow] = useState(Date.now());
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/kitchen/orders?location_id=${encodeURIComponent(locationId)}&status=in_zubereitung,bestätigt,angenommen`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list: PrepOrder[] = Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data)
          ? data
          : [];
        setOrders(list.filter(o => !['geliefert', 'abgebrochen', 'storniert'].includes(o.status)));
      }
    } catch {
      // use existing orders
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [locationId]);

  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, 20_000);
    const tick = setInterval(() => setNow(Date.now()), 10_000);

    const supabase = createClient();
    const ch = supabase
      .channel('timing-ampel-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, fetchOrders)
      .subscribe();

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      supabase.removeChannel(ch);
    };
  }, [fetchOrders]);

  const enriched = orders.map(o => ({ o, ...getAmpel(o, now) }));
  enriched.sort((a, b) => {
    const priority: AmpelStatus[] = ['rot', 'gelb', 'gruen', 'fertig'];
    return priority.indexOf(a.status) - priority.indexOf(b.status);
  });

  const counts = {
    rot: enriched.filter(e => e.status === 'rot').length,
    gelb: enriched.filter(e => e.status === 'gelb').length,
    gruen: enriched.filter(e => e.status === 'gruen').length,
    fertig: enriched.filter(e => e.status === 'fertig').length,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-matcha-400 mx-auto mb-2" />
        <div className="text-sm font-bold text-stone-600">Keine aktiven Bestellungen</div>
        <div className="text-xs text-stone-400 mt-0.5">Alle Bestellungen sind fertig oder noch nicht bestätigt.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Timing-Ampel Live</span>
        <div className="ml-auto flex items-center gap-2">
          {counts.rot > 0 && (
            <span className="text-[10px] font-black bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {counts.rot} überfällig
            </span>
          )}
          {counts.gelb > 0 && (
            <span className="text-[10px] font-black bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {counts.gelb} knapp
            </span>
          )}
          {counts.gruen > 0 && (
            <span className="text-[10px] font-black bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5">
              {counts.gruen} ok
            </span>
          )}
          <button
            onClick={fetchOrders}
            className="p-1 rounded-lg hover:bg-stone-200 transition text-stone-400"
            title="Aktualisieren"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y divide-stone-100">
        {enriched.map(({ o, status, elapsedMin, remainMin }) => {
          const st = AMPEL_STYLE[status];
          const prepMin = o.promised_prep_min ?? 15;
          const pct = prepMin > 0 ? Math.min(100, (elapsedMin / prepMin) * 100) : 0;
          return (
            <div key={o.id} className={cn('flex items-center gap-3 px-4 py-3', st.bg)}>
              {/* Dot */}
              <span className={cn('shrink-0 h-2.5 w-2.5 rounded-full', st.dot, status === 'rot' && 'animate-pulse')} />

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800 truncate">
                    #{o.bestellnummer} · {o.kunde_name}
                  </span>
                  <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5', st.text, 'bg-white/70')}>
                    {st.label}
                  </span>
                  {o.typ === 'delivery' && (
                    <span className="text-[9px] font-bold bg-white/70 rounded-full px-1.5 py-0.5 text-stone-500">
                      Lieferung
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      status === 'rot' ? 'bg-red-500' : status === 'gelb' ? 'bg-amber-400' : status === 'fertig' ? 'bg-blue-400' : 'bg-matcha-500',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Countdown */}
              <div className="shrink-0 text-right min-w-[52px]">
                {status === 'fertig' ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-500 ml-auto" />
                ) : remainMin !== null ? (
                  <>
                    <div className={cn('text-base font-black tabular-nums', st.text)}>
                      {remainMin === 0 ? '0' : remainMin}
                    </div>
                    <div className="text-[9px] text-stone-400 leading-tight">min verbl.</div>
                  </>
                ) : (
                  <div className="text-xs text-stone-400">{elapsedMin}m</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <span className="text-[10px] text-stone-400">
          {enriched.length} Bestellung{enriched.length !== 1 ? 'en' : ''} aktiv
        </span>
        <span className="text-[10px] text-stone-400">
          Aktualisiert {new Date(lastRefresh).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
