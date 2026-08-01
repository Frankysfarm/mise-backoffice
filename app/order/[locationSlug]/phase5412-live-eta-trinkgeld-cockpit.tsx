'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Zap, Navigation, Package, Star, AlertTriangle, Coins } from 'lucide-react';

// Phase 5412 — Live-ETA + Trinkgeld-Cockpit (Storefront)
// Neu: Fahrer-Trinkgeld-Score Badge (grün/gelb/rot);
// Trinkgeld-Potential-Indikator für Kunden (freundliche Lieferung erwartet);
// SVG ETA-Konfidenz-Ring animiert; 1s-Countdown-Tick;
// 4-Phasen-Timeline mit Konfidenz; Geliefert+Bewertungs-Prompt; 30-Sek-Polling; Mock-Fallback

type Phase = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';
type TipTier = 'hoch' | 'mittel' | 'niedrig';

interface EtaData {
  order_id: string;
  phase: Phase;
  eta_min: number;
  eta_konfidenz_pct: number;
  fahrer_name: string | null;
  fahrer_vollstaendigkeit_pct: number | null;
  fahrer_trinkgeld_score: number | null;
  fahrer_tip_tier: TipTier | null;
  fahrer_bewertung: number | null;
  distanz_km: number | null;
  timestamp: string;
}

const MOCK: EtaData = {
  order_id: 'ORDER-12346',
  phase: 'unterwegs',
  eta_min: 7,
  eta_konfidenz_pct: 87,
  fahrer_name: 'Lukas M.',
  fahrer_vollstaendigkeit_pct: 97,
  fahrer_trinkgeld_score: 88,
  fahrer_tip_tier: 'hoch',
  fahrer_bewertung: 4.9,
  distanz_km: 1.2,
  timestamp: new Date().toISOString(),
};

const PHASE_LABELS: Record<Phase, string> = {
  bestellt:    'Bestellt',
  zubereitung: 'In Zubereitung',
  unterwegs:   'Unterwegs',
  geliefert:   'Geliefert',
};

const PHASE_ORDER: Phase[] = ['bestellt', 'zubereitung', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}

function confidenceColor(pct: number): string {
  if (pct >= 85) return '#34d399';
  if (pct >= 70) return '#fbbf24';
  return '#f87171';
}

const TIP_LABEL: Record<TipTier, string> = {
  hoch:    'Sehr freundlicher Fahrer',
  mittel:  'Freundlicher Fahrer',
  niedrig: 'Fahrer',
};

const TIP_COLOR: Record<TipTier, string> = {
  hoch:    'text-orange-300',
  mittel:  'text-amber-400',
  niedrig: 'text-gray-500',
};

export function Phase5412LiveEtaTrinkgeldCockpit({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [countdown, setCountdown] = useState(data.eta_min * 60);
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
      if (r.ok) {
        const d: EtaData = await r.json();
        setData(d);
        setCountdown(d.eta_min * 60);
      }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    ivRef.current = setInterval(load, 30_000);
    tickRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => {
      if (ivRef.current) clearInterval(ivRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const mm = Math.floor(countdown / 60);
  const ss = countdown % 60;
  const ring = 2 * Math.PI * 44;
  const dashOffset = ring * (1 - data.eta_konfidenz_pct / 100);
  const ringColor = confidenceColor(data.eta_konfidenz_pct);
  const curPhaseIdx = phaseIndex(data.phase);

  if (data.phase === 'geliefert') {
    return (
      <div className="rounded-2xl bg-white shadow-md border border-gray-100 p-6 space-y-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <div className="text-xl font-bold text-gray-900">Geliefert! Guten Appetit!</div>
        {data.fahrer_name && (
          <div className="text-sm text-gray-500">Geliefert von {data.fahrer_name}</div>
        )}
        {!rated ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Wie war deine Lieferung?</div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => { setRating(s); setRated(true); }}>
                  <Star className={`h-7 w-7 transition-colors ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-emerald-600 font-medium">Danke für dein Feedback! ⭐ {rating}/5</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-md border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">Live-Tracking</span>
        </div>
        <span className="text-xs text-gray-400">{data.eta_konfidenz_pct}% Konfidenz</span>
      </div>

      {/* ETA Ring + Countdown */}
      <div className="flex items-center justify-center gap-6">
        <div className="relative">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-gray-900">{mm}:{String(ss).padStart(2, '0')}</span>
            <span className="text-[10px] text-gray-500">Min</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-gray-800">Noch ca. {mm} Min</div>
          {data.fahrer_name && (
            <div className="text-xs text-gray-500">Fahrer: <span className="font-medium text-gray-700">{data.fahrer_name}</span></div>
          )}
          {data.distanz_km !== null && (
            <div className="text-xs text-gray-500">{data.distanz_km.toFixed(1)} km entfernt</div>
          )}
          {data.fahrer_tip_tier && (
            <div className={`text-xs flex items-center gap-1 ${TIP_COLOR[data.fahrer_tip_tier]}`}>
              <Coins className="h-3 w-3" />
              {TIP_LABEL[data.fahrer_tip_tier]}
            </div>
          )}
        </div>
      </div>

      {/* Trinkgeld Score Badge */}
      {data.fahrer_trinkgeld_score !== null && data.fahrer_trinkgeld_score >= 80 && (
        <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2">
          <Coins className="h-4 w-4 text-orange-500 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-orange-700">Top-Trinkgeld-Fahrer</div>
            <div className="text-[10px] text-orange-500">Score {data.fahrer_trinkgeld_score} — sehr guter Service erwartet</div>
          </div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="space-y-1">
        {PHASE_ORDER.filter(p => p !== 'geliefert').map((p, i) => {
          const done   = i < curPhaseIdx;
          const active = i === curPhaseIdx;
          return (
            <div key={p} className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${active ? 'bg-indigo-50' : ''}`}>
              <div className={`h-2 w-2 rounded-full shrink-0 ${done ? 'bg-emerald-400' : active ? 'bg-indigo-500 animate-pulse' : 'bg-gray-200'}`} />
              <span className={`text-xs flex-1 ${active ? 'font-semibold text-indigo-700' : done ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                {PHASE_LABELS[p]}
              </span>
              {active && <span className="text-[10px] text-indigo-400">jetzt</span>}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-300 text-right">30-Sek-Polling · V12</div>
    </div>
  );
}
