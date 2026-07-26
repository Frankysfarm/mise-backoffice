'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, AlertTriangle, Bike, ChefHat, Package, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type OrderPhase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

interface TrackData {
  order_id: string;
  status: OrderPhase;
  eta_ms: number | null;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  konfidenz: number;
  delay_min: number | null;
}

const PHASES: { key: OrderPhase; label: string; Icon: React.ElementType }[] = [
  { key: 'bestellt',       label: 'Bestellt',    Icon: Package },
  { key: 'bestaetigt',     label: 'Angenommen',  Icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'In Küche',    Icon: ChefHat },
  { key: 'unterwegs',      label: 'Unterwegs',   Icon: Bike },
  { key: 'geliefert',      label: 'Geliefert',   Icon: CheckCircle2 },
];

function phaseIdx(s: OrderPhase) { return PHASES.findIndex(p => p.key === s); }

function fmtMmSs(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  orderId: string;
  bestellnummer?: string;
}

export function BissPhase2320DynamischeEtaLiveTrackingKommando({ orderId, bestellnummer }: Props) {
  const [data, setData] = useState<TrackData | null>(null);
  const [secRemain, setSecRemain] = useState<number | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/customer/eta?order_id=${orderId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.status) setData(d);
      }
    } catch {}
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }, [load]);

  // Realtime subscription for instant status updates
  useEffect(() => {
    const ch = supabase
      .channel(`biss-track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, supabase, load]);

  // Second-accurate countdown from eta_ms
  useEffect(() => {
    if (!data?.eta_ms) { setSecRemain(null); return; }
    const update = () => { setSecRemain(Math.max(0, Math.floor((data.eta_ms! - Date.now()) / 1000))); };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [data?.eta_ms]);

  if (!data) return null;

  const idx = phaseIdx(data.status);
  const isDelivered = data.status === 'geliefert';
  const isOnTheWay = data.status === 'unterwegs';
  const hasDelay = (data.delay_min ?? 0) > 0;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-semibold text-sm text-slate-800">Live-Tracking</span>
          {bestellnummer && <span className="text-[11px] text-slate-400">#{bestellnummer}</span>}
        </div>
        {!isDelivered && secRemain !== null && (
          <div className={`text-base font-black tabular-nums ${secRemain < 120 ? 'text-red-600' : secRemain < 360 ? 'text-orange-600' : 'text-matcha-700'}`}>
            {fmtMmSs(secRemain)}
          </div>
        )}
        {isDelivered && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Geliefert!</span>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-center gap-1">
        {PHASES.map((p, i) => {
          const done = i < idx;
          const active = i === idx;
          const { Icon } = p;
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${done || active ? 'bg-matcha-500' : 'bg-slate-100'}`} />
              <div className={`flex items-center justify-center h-5 w-5 rounded-full mt-0.5 transition-all ${done ? 'bg-matcha-500' : active ? 'bg-matcha-600 ring-2 ring-matcha-200' : 'bg-slate-100'}`}>
                <Icon className={`h-2.5 w-2.5 ${done || active ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <span className={`text-[8px] text-center leading-tight ${active ? 'text-matcha-700 font-bold' : done ? 'text-matcha-500' : 'text-slate-400'}`}>{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* Delay-Warnung */}
      {hasDelay && !isDelivered && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium">+{data.delay_min} Min Verzögerung — wir arbeiten daran</span>
        </div>
      )}

      {/* Fahrer-Info (wenn unterwegs) */}
      {isOnTheWay && data.fahrer_name && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <Bike className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate">{data.fahrer_name}</div>
            {data.fahrer_distanz_km !== null && (
              <div className="text-[10px] text-blue-600 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {data.fahrer_distanz_km.toFixed(1)} km entfernt
              </div>
            )}
          </div>
          {data.konfidenz > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-matcha-700">{data.konfidenz}%</div>
              <div className="text-[8px] text-slate-400">Konfidenz</div>
            </div>
          )}
        </div>
      )}

      {/* Geliefert-Screen */}
      {isDelivered && (
        <div className="text-center py-2">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-sm font-bold text-emerald-700">Guten Appetit!</div>
          <div className="text-[11px] text-slate-500">Deine Bestellung ist angekommen</div>
        </div>
      )}

      <div className="flex items-center justify-between text-[9px] text-slate-400">
        <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> 15-Sek-Polling + Realtime</span>
        <span className="flex items-center gap-0.5"><div className="h-1.5 w-1.5 rounded-full bg-matcha-400 animate-pulse" /> Live</span>
      </div>
    </div>
  );
}
