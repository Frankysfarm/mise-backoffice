'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Star } from 'lucide-react';

/**
 * Phase 2685 — Dynamische ETA Live-Tracking Final Pro (Storefront)
 *
 * ETA-Hero-Kachel mit Konfidenz-Indikator; 5-Phasen-Timeline Bestellt→Geliefert;
 * Fortschrittsbalken; Fahrer-Info mit Bewertung + Distanz; Delay-Warnung;
 * 1-Sek-Tick + 15-Sek-Polling
 */

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'in_lieferung'
  | 'geliefert'
  | 'storniert';

interface EtaData {
  order_id: string;
  status: OrderStatus;
  eta_earliest: string | null;
  eta_latest: string | null;
  konfidenz: number | null; // 0–100
  driver_name: string | null;
  driver_rating: number | null;
  driver_distance_km: number | null;
  is_delayed: boolean;
  delay_min: number | null;
}

const PHASES: { key: OrderStatus[]; label: string }[] = [
  { key: ['neu'],                  label: 'Bestellt' },
  { key: ['bestätigt'],           label: 'Bestätigt' },
  { key: ['in_zubereitung'],       label: 'In Zubereitung' },
  { key: ['fertig', 'in_lieferung'], label: 'Unterwegs' },
  { key: ['geliefert'],            label: 'Geliefert' },
];

function getPhaseIndex(status: OrderStatus): number {
  for (let i = 0; i < PHASES.length; i++) {
    if ((PHASES[i].key as string[]).includes(status)) return i;
  }
  return 0;
}

interface Props {
  orderId: string;
  locationSlug?: string;
}

export function StorefrontPhase2685DynamischeEtaLiveFinalPro({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [tick, setTick] = useState(0);
  const [minsLeft, setMinsLeft] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/eta/${orderId}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('not ok');
        const d = await r.json();
        setData(d);
      } catch {
        // keep last known data
      }
    };
    if (orderId) { load(); const iv = setInterval(load, 15_000); return () => clearInterval(iv); }
  }, [orderId]);

  useEffect(() => {
    if (!data?.eta_earliest) { setMinsLeft(null); return; }
    const diff = Math.max(0, Math.floor((new Date(data.eta_earliest).getTime() - Date.now()) / 60_000));
    setMinsLeft(diff);
  }, [data, tick]);

  if (!data || data.status === 'storniert') return null;
  if (data.status === 'geliefert') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-2xl border bg-emerald-50 dark:bg-emerald-950">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-base font-black text-emerald-700 dark:text-emerald-300">Deine Bestellung wurde geliefert!</p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Guten Appetit 🎉</p>
      </div>
    );
  }

  const phaseIdx = getPhaseIndex(data.status);
  const progress = Math.round((phaseIdx / (PHASES.length - 1)) * 100);
  const konfidenzColor =
    (data.konfidenz ?? 0) >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
    (data.konfidenz ?? 0) >= 60 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border bg-white dark:bg-stone-950 shadow-sm overflow-hidden">
      {/* ETA Hero */}
      <div className="px-5 py-5 bg-gradient-to-br from-matcha-50 via-white to-white dark:from-matcha-950 dark:via-stone-950 dark:to-stone-950">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-matcha-600 mb-1">Lieferzeit</p>
            {minsLeft !== null ? (
              <p className="text-5xl font-black text-stone-900 dark:text-stone-50 tabular-nums leading-none">
                ~{minsLeft}<span className="text-xl font-semibold text-stone-400 ml-1">min</span>
              </p>
            ) : (
              <p className="text-3xl font-black text-stone-400">Wird berechnet…</p>
            )}
          </div>
          {data.konfidenz !== null && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-stone-400 uppercase tracking-wider mb-0.5">Verlässlichkeit</span>
              <span className={`text-xl font-black ${konfidenzColor}`}>{data.konfidenz}%</span>
            </div>
          )}
        </div>

        {data.is_delayed && data.delay_min && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-3 py-1.5 rounded-full w-fit">
            <AlertTriangle className="h-3 w-3" />
            Leichte Verzögerung von ca. {data.delay_min} min
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100 dark:bg-stone-800">
        <div className="h-full bg-matcha-500 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      {/* Phase timeline */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-stone-100 dark:bg-stone-800 z-0" />
          <div
            className="absolute top-3 left-3 h-0.5 bg-matcha-500 z-10 transition-all duration-700"
            style={{ width: `calc(${progress}% - 0px)` }}
          />
          {PHASES.map((phase, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            return (
              <div key={i} className="relative z-20 flex flex-col items-center gap-1.5" style={{ width: `${100 / PHASES.length}%` }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                  done   ? 'bg-matcha-500 border-matcha-500' :
                  active ? 'bg-white dark:bg-stone-900 border-matcha-500 shadow-sm shadow-matcha-200' :
                  'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700'
                }`}>
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  {active && <span className="w-2.5 h-2.5 rounded-full bg-matcha-500 animate-pulse" />}
                </div>
                <span className={`text-[8px] text-center leading-tight px-0.5 ${
                  done ? 'text-matcha-600 dark:text-matcha-400 font-semibold' :
                  active ? 'text-matcha-700 dark:text-matcha-300 font-bold' :
                  'text-stone-400'
                }`}>{phase.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {data.driver_name && (
        <div className="flex items-center gap-3 px-4 py-3 border-t bg-stone-50 dark:bg-stone-900">
          <div className="w-8 h-8 rounded-full bg-matcha-100 dark:bg-matcha-900 flex items-center justify-center flex-shrink-0">
            <Bike className="h-4 w-4 text-matcha-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-stone-700 dark:text-stone-200 truncate">{data.driver_name}</p>
            <div className="flex items-center gap-2">
              {data.driver_rating && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                  <Star className="h-2.5 w-2.5" />
                  {data.driver_rating.toFixed(1)}
                </span>
              )}
              {data.driver_distance_km !== null && (
                <span className="flex items-center gap-0.5 text-[9px] text-stone-400">
                  <MapPin className="h-2.5 w-2.5" />
                  {data.driver_distance_km.toFixed(1)} km entfernt
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-stone-400">
            <Clock className="h-3 w-3" />
            Live
          </div>
        </div>
      )}
    </div>
  );
}
