'use client';

/**
 * Phase 2050 — Live-Tracking ETA Pro
 * Dynamische ETA mit animierter Fortschritts-Timeline, Fahrer-Info,
 * Küchen-Fortschritt und Echtzeit-Aktualisierung alle 20 Sekunden.
 */

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  ChefHat, Bike, MapPin, CheckCircle2, Clock, Package, Star,
  Navigation2, Phone, MessageSquare,
} from 'lucide-react';

type Phase = 'bestaetigt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'nah' | 'zugestellt';

interface TrackingData {
  phase: Phase;
  eta_min: number | null;
  kitchen_pct: number;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_telefon: string | null;
  stops_davor: number;
  bestellnummer: string;
}

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'zubereitung', label: 'In Küche', icon: <ChefHat className="w-4 h-4" /> },
  { key: 'bereit', label: 'Fertig', icon: <Package className="w-4 h-4" /> },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="w-4 h-4" /> },
  { key: 'zugestellt', label: 'Zugestellt', icon: <CheckCircle2 className="w-4 h-4" /> },
];

const PHASE_ORDER: Record<Phase, number> = {
  bestaetigt: 0, zubereitung: 1, bereit: 2, unterwegs: 3, nah: 3, zugestellt: 4,
};

function etaColor(min: number | null) {
  if (min === null) return 'text-stone-400';
  if (min <= 5) return 'text-emerald-600';
  if (min <= 15) return 'text-amber-600';
  return 'text-stone-700';
}

function useMockTracking(orderId: string | null): TrackingData {
  const [data, setData] = useState<TrackingData>({
    phase: 'zubereitung',
    eta_min: 18,
    kitchen_pct: 40,
    fahrer_name: null,
    fahrer_bewertung: null,
    fahrer_telefon: null,
    stops_davor: 0,
    bestellnummer: orderId ?? '—',
  });

  useEffect(() => {
    const load = async () => {
      if (!orderId) return;
      try {
        const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        setData({
          phase: j.status ?? 'zubereitung',
          eta_min: j.eta_min ?? null,
          kitchen_pct: j.kitchen_progress_pct ?? 50,
          fahrer_name: j.driver_name ?? null,
          fahrer_bewertung: j.driver_rating ?? null,
          fahrer_telefon: j.driver_phone ?? null,
          stops_davor: j.stops_before ?? 0,
          bestellnummer: orderId,
        });
      } catch {}
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  return data;
}

export function StorefrontPhase2050LiveTrackingEtaPro({ orderId }: { orderId: string | null }) {
  const tracking = useMockTracking(orderId);
  const currentStep = PHASE_ORDER[tracking.phase];
  const isDelivered = tracking.phase === 'zugestellt';
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed(e => e + 1), 1_000);
    return () => clearInterval(tickRef.current);
  }, []);

  return (
    <div className="space-y-3">
      {/* ETA Card */}
      <div className={cn(
        'rounded-2xl border-2 p-5 text-center transition-all',
        isDelivered ? 'border-emerald-400 bg-emerald-50' : 'border-saffron/40 bg-white'
      )}>
        {isDelivered ? (
          <div className="space-y-1">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div className="text-xl font-black text-emerald-700">Zugestellt!</div>
            <div className="text-sm text-stone-500">Deine Bestellung ist angekommen. Guten Appetit! 🍽️</div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
              {tracking.phase === 'nah' ? '🎉 Fast da!' : 'Geschätzte Lieferzeit'}
            </div>
            <div className={cn('text-5xl font-black tabular-nums', etaColor(tracking.eta_min))}>
              {tracking.eta_min !== null ? `${tracking.eta_min}` : '—'}
            </div>
            <div className="text-sm font-semibold text-stone-500">Minuten</div>
            {tracking.stops_davor > 0 && (
              <div className="text-[11px] text-stone-400 mt-1">
                {tracking.stops_davor} Stopp{tracking.stops_davor !== 1 ? 's'  : ''} vor dir
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-stretch gap-0">
          {PHASES.map((p, i) => {
            const done = currentStep > i;
            const active = currentStep === i;
            const isLast = i === PHASES.length - 1;
            return (
              <div key={p.key} className="flex-1 flex flex-col items-center relative">
                {/* Connector Line */}
                {!isLast && (
                  <div className="absolute top-4 left-1/2 right-0 h-0.5 bg-stone-200 -translate-y-0.5">
                    <div
                      className="h-full bg-matcha-400 transition-all duration-700"
                      style={{ width: done ? '100%' : active ? '50%' : '0%' }}
                    />
                  </div>
                )}
                {/* Icon Circle */}
                <div className={cn(
                  'relative z-10 h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                  done ? 'bg-matcha-600 border-matcha-600 text-white' :
                  active ? 'bg-white border-matcha-500 text-matcha-600 animate-pulse shadow-[0_0_0_4px_rgba(91,140,90,0.2)]' :
                  'bg-white border-stone-200 text-stone-300'
                )}>
                  {p.icon}
                </div>
                <div className={cn(
                  'mt-1 text-[9px] font-bold text-center leading-tight px-0.5',
                  active ? 'text-matcha-700' : done ? 'text-stone-500' : 'text-stone-300'
                )}>
                  {p.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kitchen Progress (nur wenn in Zubereitung) */}
      {tracking.phase === 'zubereitung' && tracking.kitchen_pct > 0 && (
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ChefHat className="h-4 w-4 text-amber-500" />
              Küche kocht…
            </div>
            <span className="text-sm font-black text-amber-600">{tracking.kitchen_pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000"
              style={{ width: `${tracking.kitchen_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer-Info (wenn unterwegs) */}
      {(tracking.phase === 'unterwegs' || tracking.phase === 'nah') && tracking.fahrer_name && (
        <div className="rounded-2xl border bg-white p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
            <Bike className="h-6 w-6 text-matcha-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-stone-800 truncate">{tracking.fahrer_name}</div>
            {tracking.fahrer_bewertung !== null && (
              <div className="flex items-center gap-1 text-[11px] text-stone-500">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {tracking.fahrer_bewertung.toFixed(1)} · Dein Fahrer
              </div>
            )}
          </div>
          {tracking.fahrer_telefon && (
            <div className="flex gap-2">
              <a href={`tel:${tracking.fahrer_telefon}`}
                className="h-9 w-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 active:bg-stone-200">
                <Phone className="h-4 w-4" />
              </a>
              <a href={`sms:${tracking.fahrer_telefon}`}
                className="h-9 w-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 active:bg-stone-200">
                <MessageSquare className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Bestellnummer */}
      <div className="text-center text-[10px] text-stone-400">
        Bestellung #{tracking.bestellnummer}
      </div>
    </div>
  );
}
