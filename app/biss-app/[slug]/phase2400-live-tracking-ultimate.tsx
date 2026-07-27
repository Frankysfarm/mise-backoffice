'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, Loader2, MapPin, Package, Zap } from 'lucide-react';

/**
 * Phase 2400 — Live-Tracking Ultimate (Biss-App)
 *
 * Kompakter Live-Status nach Bestellaufgabe:
 * 5-Phasen-Timeline mit Icons; MM:SS-Countdown bis ETA;
 * Fahrer-Name + Stopps vor dir; farbkodiert; Realtime-Sub + 15-Sek-Polling.
 */

interface Props {
  orderId: string;
  bestellnummer?: string;
}

type Phase = 'eingegangen' | 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

const PHASES: Array<{ key: Phase; label: string; icon: React.ElementType }> = [
  { key: 'eingegangen', label: 'Eingegangen', icon: Package },
  { key: 'bestaetigt',  label: 'Bestätigt',   icon: CheckCircle2 },
  { key: 'zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: Bike },
  { key: 'geliefert',   label: 'Geliefert',    icon: CheckCircle2 },
];

const STATUS_MAP: Record<string, Phase> = {
  neu: 'eingegangen', bestätigt: 'bestaetigt', in_zubereitung: 'zubereitung',
  fertig: 'zubereitung', unterwegs: 'unterwegs', geliefert: 'geliefert',
  eingegangen: 'eingegangen', bestaetigt: 'bestaetigt', zubereitung: 'zubereitung',
};

function pad2(n: number) { return String(Math.floor(n)).padStart(2, '0'); }

function etaCountdown(etaIso: string): string {
  const diff = new Date(etaIso).getTime() - Date.now();
  if (diff <= 0) return 'Jeden Moment';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${pad2(m)}:${pad2(s)}`;
}

export function BissPhase2400LiveTrackingUltimate({ orderId, bestellnummer }: Props) {
  const [phase, setPhase] = useState<Phase>('eingegangen');
  const [etaIso, setEtaIso] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [stopsBefore, setStopsBefore] = useState<number>(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parse = useCallback((d: { status?: string; eta_latest?: string; driver_name?: string; stops_before?: number }) => {
    if (d.status) setPhase(STATUS_MAP[d.status] ?? 'eingegangen');
    if (d.eta_latest) setEtaIso(d.eta_latest);
    if (d.driver_name) setDriverName(d.driver_name);
    if (typeof d.stops_before === 'number') setStopsBefore(d.stops_before);
  }, []);

  useEffect(() => {
    const sb = createClient();
    const ch = sb.channel(`biss-2400-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, (payload: { new?: { status?: string } }) => {
        const raw = payload.new?.status;
        if (raw) setPhase(STATUS_MAP[raw] ?? 'eingegangen');
      })
      .subscribe();

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}`);
        if (res.ok) { parse(await res.json()); }
      } catch {} finally { setLoading(false); }
    };
    poll();
    pollRef.current = setInterval(poll, 15_000);

    return () => { sb.removeChannel(ch); if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, parse]);

  // Countdown tick
  useEffect(() => {
    if (!etaIso) return;
    const tick = () => setCountdown(etaCountdown(etaIso));
    tick();
    ivRef.current = setInterval(tick, 1_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [etaIso]);

  const curIdx = PHASES.findIndex((p) => p.key === phase);
  const done = phase === 'geliefert';

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Lade Status…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-matcha-100 bg-matcha-50/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-xs font-semibold text-matcha-700">Live-Status</span>
          {bestellnummer && (
            <span className="text-[10px] text-gray-400 font-mono">#{bestellnummer}</span>
          )}
        </div>
        {countdown && !done && (
          <div className="flex items-center gap-1 bg-matcha-600 text-white px-2.5 py-1 rounded-full text-sm font-black tabular-nums">
            <Clock className="w-3 h-3" />
            {countdown}
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-sm font-bold">
            <CheckCircle2 className="w-3 h-3" />
            Geliefert
          </div>
        )}
      </div>

      {/* Phase timeline */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100">
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${curIdx > 0 ? (curIdx / (PHASES.length - 1)) * 100 : 0}%` }}
          />
        </div>

        <div className="relative flex justify-between">
          {PHASES.map(({ key, label, icon: Icon }, i) => {
            const isPast = i < curIdx;
            const isCurrent = i === curIdx;
            return (
              <div key={key} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / PHASES.length}%` }}>
                <div className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10',
                  isPast ? 'bg-matcha-600 border-matcha-600 text-white' :
                  isCurrent ? 'bg-white border-matcha-600 text-matcha-700 shadow-md' :
                  'bg-white border-gray-200 text-gray-300',
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight max-w-[40px]',
                  isPast || isCurrent ? 'text-matcha-700 font-semibold' : 'text-gray-300',
                )}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver + ETA info */}
      {!done && (
        <div className="space-y-1.5">
          {phase === 'unterwegs' && driverName && (
            <div className="flex items-center gap-2 text-sm">
              <Bike className="w-4 h-4 text-matcha-600 shrink-0" />
              <span className="text-gray-600">Fahrer: <span className="font-semibold text-gray-800">{driverName}</span></span>
            </div>
          )}
          {phase === 'unterwegs' && stopsBefore > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{stopsBefore} Lieferung{stopsBefore > 1 ? 'en' : ''} vor dir</span>
            </div>
          )}
          {etaIso && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="w-3.5 h-3.5 text-matcha-500 shrink-0" />
              <span>
                Ankunft ca. <strong className="text-gray-700">
                  {new Date(etaIso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="text-center text-matcha-700 font-semibold text-sm py-1">
          Guten Appetit!
        </div>
      )}

      <div className="text-[9px] text-gray-400 text-center">
        Live · Echtzeit-Aktualisierung · 15-Sek-Polling
      </div>
    </div>
  );
}
