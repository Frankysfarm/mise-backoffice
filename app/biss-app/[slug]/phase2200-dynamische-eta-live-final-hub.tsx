'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, MapPin, CheckCircle2, Loader2, Bike } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'in_lieferung' | 'geliefert' | string;

type TrackingData = {
  status: OrderStatus;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  driver_name: string | null;
  stop_reihenfolge: number | null;
  total_stops: number | null;
};

type Phase = {
  key: OrderStatus[];
  label: string;
  icon: React.ReactNode;
};

const PHASES: Phase[] = [
  { key: ['neu'], label: 'Bestellung eingegangen', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: ['bestätigt', 'in_zubereitung'], label: 'Wird zubereitet', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  { key: ['fertig'], label: 'Fertig zur Abholung', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: ['in_lieferung'], label: 'Unterwegs zu dir', icon: <Bike className="h-4 w-4" /> },
  { key: ['geliefert'], label: 'Geliefert!', icon: <CheckCircle2 className="h-4 w-4" /> },
];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(targetIso: string | null): string {
  const [display, setDisplay] = useState('—');
  useEffect(() => {
    if (!targetIso) return;
    const update = () => {
      const diff = Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000);
      if (diff <= 0) { setDisplay('Jeden Moment'); return; }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setDisplay(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  return display;
}

export function BissPhase2200DynamischeEtaLiveFinalHub({ orderId }: { orderId: string | null }) {
  const supabase = createClient();
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const load = async () => {
      const { data: order } = await supabase
        .from('customer_orders')
        .select('status, bestellt_am, geschaetzte_zubereitung_min, eta_earliest, eta_latest')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return;

      // Try to get driver info from active delivery stop
      const { data: stop } = await supabase
        .from('delivery_stops')
        .select('reihenfolge, batch:delivery_batches(fahrer_id, employee:employees(vorname, nachname)), batch_id')
        .eq('order_id', orderId)
        .maybeSingle();

      let driverName: string | null = null;
      let stopReihenfolge: number | null = null;
      let totalStops: number | null = null;

      if (stop) {
        const batch = (stop as any).batch;
        if (batch?.employee) {
          driverName = `${batch.employee.vorname} ${batch.employee.nachname}`;
        }
        stopReihenfolge = stop.reihenfolge ?? null;

        if ((stop as any).batch_id) {
          const { count } = await supabase
            .from('delivery_stops')
            .select('id', { count: 'exact', head: true })
            .eq('batch_id', (stop as any).batch_id);
          totalStops = count ?? null;
        }
      }

      setData({
        status: order.status,
        bestellt_am: order.bestellt_am,
        geschaetzte_zubereitung_min: order.geschaetzte_zubereitung_min,
        eta_earliest: order.eta_earliest,
        eta_latest: order.eta_latest,
        driver_name: driverName,
        stop_reihenfolge: stopReihenfolge,
        total_stops: totalStops,
      });
    };

    load();
    const iv = setInterval(load, 15_000);

    // Realtime subscription for status updates
    const sub = supabase
      .channel(`order-track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, () => load())
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(sub);
    };
  }, [orderId]);

  const countdown = useCountdown(data?.eta_latest ?? data?.eta_earliest ?? null);

  if (!data || !orderId) return null;

  const activePhaseIdx = PHASES.findIndex(p => p.key.includes(data.status));
  const isDelivered = data.status === 'geliefert';

  // Compute ETA window display
  const eta_min_val = data.geschaetzte_zubereitung_min ?? 30;
  const etaTarget = data.eta_latest
    ? data.eta_latest
    : data.bestellt_am
    ? new Date(new Date(data.bestellt_am).getTime() + eta_min_val * 60_000).toISOString()
    : null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-matcha-50 to-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-matcha-600" />
            <span className="text-[12px] font-black uppercase tracking-widest text-stone-500">Live-Tracking</span>
          </div>
          {!isDelivered && etaTarget && (
            <div className="flex items-center gap-1.5 bg-matcha-100 rounded-full px-3 py-1">
              <Clock className="h-3 w-3 text-matcha-700" />
              <span className="text-[12px] font-black text-matcha-700 tabular-nums">{countdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* Phase timeline */}
      <div className="px-4 py-3">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-stone-100" />

          <div className="space-y-3">
            {PHASES.map((phase, i) => {
              const isDone = i < activePhaseIdx || isDelivered;
              const isActive = i === activePhaseIdx && !isDelivered;
              return (
                <div key={i} className="flex items-center gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                    isDone ? 'bg-matcha-600 text-white' :
                    isActive ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400' :
                    'bg-stone-100 text-stone-300'
                  }`}>
                    {phase.icon}
                  </div>
                  <span className={`text-[11px] font-bold ${
                    isDone ? 'text-matcha-700' :
                    isActive ? 'text-stone-800' :
                    'text-stone-300'
                  }`}>
                    {phase.label}
                    {isActive && data.status === 'in_zubereitung' && data.geschaetzte_zubereitung_min && (
                      <span className="ml-2 text-[10px] font-medium text-stone-400">
                        (~{data.geschaetzte_zubereitung_min} min)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ETA window */}
      {!isDelivered && (data.eta_earliest || data.eta_latest || etaTarget) && (
        <div className="mx-3 mb-3 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-600 mb-1">Voraussichtliche Ankunft</div>
          <div className="text-[14px] font-black text-matcha-800">
            {data.eta_earliest && data.eta_latest
              ? `${fmtTime(data.eta_earliest)} – ${fmtTime(data.eta_latest)} Uhr`
              : `ca. ${fmtTime(etaTarget)} Uhr`}
          </div>
          {data.driver_name && data.status === 'in_lieferung' && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-matcha-600">
              <Bike className="h-3 w-3" />
              <span>
                {data.driver_name}
                {data.stop_reihenfolge !== null && data.total_stops !== null && (
                  <> · Stopp {data.stop_reihenfolge + 1} von {data.total_stops}</>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Delivered state */}
      {isDelivered && (
        <div className="mx-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
          <div className="text-[13px] font-black text-emerald-800">Guten Appetit!</div>
          <div className="text-[10px] text-emerald-600">Deine Bestellung wurde erfolgreich geliefert.</div>
        </div>
      )}
    </div>
  );
}
