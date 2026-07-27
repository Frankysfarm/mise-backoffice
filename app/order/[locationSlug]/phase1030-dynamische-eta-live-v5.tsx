'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ChefHat, Bike, MapPin, CheckCircle2, AlertTriangle, Package, Star, RefreshCw } from 'lucide-react';

type Phase = 'bestellung_eingegangen' | 'in_zubereitung' | 'fahrer_abholung' | 'unterwegs' | 'zugestellt';

interface TrackingData {
  phase: Phase;
  eta_min: number | null;
  eta_sec_remaining: number | null;
  kuechen_fortschritt_pct: number;
  fahrer_name: string | null;
  fahrer_entfernung_min: number | null;
  fahrer_entfernung_meter: number | null;
  verzoegerung: boolean;
  verzoegerung_min: number | null;
  zustellzeit_iso: string | null;
  bewertungs_prompt: boolean;
  zustellungs_code: string | null;
}

const MOCK: TrackingData = {
  phase: 'unterwegs',
  eta_min: 11,
  eta_sec_remaining: 660,
  kuechen_fortschritt_pct: 100,
  fahrer_name: 'Max M.',
  fahrer_entfernung_min: 7,
  fahrer_entfernung_meter: 1800,
  verzoegerung: false,
  verzoegerung_min: null,
  zustellzeit_iso: null,
  bewertungs_prompt: false,
  zustellungs_code: '4821',
};

const PHASE_ORDER: Phase[] = [
  'bestellung_eingegangen',
  'in_zubereitung',
  'fahrer_abholung',
  'unterwegs',
  'zugestellt',
];

const PHASE_META: Record<Phase, { label: string; icon: ReactNode; color: string }> = {
  bestellung_eingegangen: { label: 'Eingegangen',  icon: <Package className="w-3.5 h-3.5" />,     color: 'bg-stone-400' },
  in_zubereitung:         { label: 'Zubereitung',  icon: <ChefHat className="w-3.5 h-3.5" />,     color: 'bg-amber-500' },
  fahrer_abholung:        { label: 'Abholung',     icon: <Bike className="w-3.5 h-3.5" />,        color: 'bg-blue-500' },
  unterwegs:              { label: 'Unterwegs',    icon: <Bike className="w-3.5 h-3.5" />,        color: 'bg-indigo-500' },
  zugestellt:             { label: 'Zugestellt',   icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-green-500' },
};

function phaseIdx(p: Phase) { return PHASE_ORDER.indexOf(p); }

function fmtSec(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

interface Props {
  orderId?: string;
  locationSlug?: string;
}

export function StorefrontPhase1030DynamischeEtaLiveV5({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [tick, setTick] = useState(0);
  const [rating, setRating] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (orderId) params.set('order_id', orderId);
      if (locationSlug) params.set('location_slug', locationSlug);
      const res = await fetch(`/api/delivery/customer/tracking?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json?.phase) setData(json);
    } catch { /* mock */ }
  }, [orderId, locationSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const i = setInterval(fetchData, 20_000);
    return () => clearInterval(i);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const currentPhaseIdx = phaseIdx(data.phase);
  const secLeft = data.eta_sec_remaining !== null ? Math.max(0, data.eta_sec_remaining - tick) : null;
  const isZugestellt = data.phase === 'zugestellt';
  const isUnterwegs = data.phase === 'unterwegs';
  const proximityPct = data.fahrer_entfernung_meter
    ? Math.max(0, 100 - Math.round((data.fahrer_entfernung_meter / 3000) * 100))
    : null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      {/* Hero ETA */}
      {!isZugestellt && (
        <div className="bg-[#C8873A] px-6 py-5 text-center">
          {secLeft !== null && secLeft > 0 ? (
            <>
              <div className="text-5xl font-mono font-black text-white tracking-tight">{fmtSec(secLeft)}</div>
              <div className="text-sm text-amber-100 mt-1">ca. {data.eta_min} Min. verbleibend</div>
            </>
          ) : (
            <div className="text-xl font-bold text-white">Berechne ETA…</div>
          )}
          {data.verzoegerung && data.verzoegerung_min && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-600 px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-semibold">+{data.verzoegerung_min} Min. Verzögerung</span>
            </div>
          )}
        </div>
      )}

      {/* Zugestellt-Screen */}
      {isZugestellt && (
        <div className="bg-green-600 px-6 py-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-white mx-auto mb-2" />
          <div className="text-xl font-bold text-white">Zugestellt!</div>
          <div className="text-sm text-green-100 mt-1">Guten Appetit!</div>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-stone-100 dark:bg-stone-700 mx-4" />
          {PHASE_ORDER.map((p, i) => {
            const m = PHASE_META[p];
            const active = i === currentPhaseIdx;
            const done = i < currentPhaseIdx;
            return (
              <div key={p} className="flex flex-col items-center gap-1 z-10 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${
                  done ? 'bg-green-500' : active ? m.color : 'bg-stone-200 dark:bg-stone-600'
                } ${active ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : m.icon}
                </div>
                <span className={`text-[9px] text-center leading-tight ${active ? 'font-bold text-stone-800 dark:text-stone-100' : 'text-stone-400'}`}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Küchen-Fortschritt */}
      {currentPhaseIdx <= 1 && (
        <div className="px-4 py-2 border-b border-stone-100 dark:border-stone-700">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-stone-600 dark:text-stone-300">
              <ChefHat className="w-3.5 h-3.5" /> Zubereitung
            </span>
            <span className="font-semibold text-stone-700 dark:text-stone-200">{data.kuechen_fortschritt_pct}%</span>
          </div>
          <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `${data.kuechen_fortschritt_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer-Proximity-Bar */}
      {isUnterwegs && data.fahrer_name && (
        <div className="px-4 py-2 border-b border-stone-100 dark:border-stone-700">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-stone-600 dark:text-stone-300">
              <Bike className="w-3.5 h-3.5 text-indigo-500" />
              {data.fahrer_name} nähert sich
            </span>
            <span className="font-semibold text-stone-700 dark:text-stone-200">
              {data.fahrer_entfernung_meter ? fmtDist(data.fahrer_entfernung_meter) : `${data.fahrer_entfernung_min}m`}
            </span>
          </div>
          {proximityPct !== null && (
            <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000 relative"
                style={{ width: `${proximityPct}%` }}
              >
                <div className="absolute right-0 top-0 h-full w-2 bg-indigo-300 animate-pulse rounded-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zustellungs-Code */}
      {data.zustellungs_code && !isZugestellt && (
        <div className="mx-4 my-2 flex items-center gap-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
          <div>
            <div className="text-[10px] text-stone-400">Übergabe-Code</div>
            <div className="text-lg font-mono font-bold text-stone-800 dark:text-stone-100 tracking-widest">{data.zustellungs_code}</div>
          </div>
        </div>
      )}

      {/* Bewertungs-Prompt nach Zustellung */}
      {isZugestellt && !rating && (
        <div className="px-4 py-3 border-t border-stone-100 dark:border-stone-700">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-2 text-center">
            Wie war deine Bestellung?
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="text-2xl hover:scale-110 transition-transform"
              >
                <Star className={`w-8 h-8 ${n <= (rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
      {isZugestellt && rating && (
        <div className="px-4 py-3 border-t border-stone-100 dark:border-stone-700 text-center">
          <div className="flex justify-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} className={`w-5 h-5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
            ))}
          </div>
          <div className="text-[11px] text-stone-500">Danke für deine Bewertung!</div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 flex justify-between items-center bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700">
        <button onClick={fetchData} className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600">
          <RefreshCw className="w-3 h-3" /> Aktualisieren
        </button>
        <span className="text-[9px] text-stone-400">Live-Tracking · alle 20s</span>
      </div>
    </div>
  );
}
