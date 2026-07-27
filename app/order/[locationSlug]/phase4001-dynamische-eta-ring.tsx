'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, Bike, CheckCircle2 } from 'lucide-react';

interface ApiData { eta_min: number; eta_min_best: number; eta_min_worst: number; phase: 'bestaetigt' | 'zubereitung' | 'fahrer_unterwegs' | 'nahe' | 'geliefert'; phase_label: string; fahrer_name: string | null; fahrer_distanz_km: number | null; konfidenz_pct: number; }

const MOCK: ApiData = {
  eta_min: 22,
  eta_min_best: 18,
  eta_min_worst: 28,
  phase: 'zubereitung',
  phase_label: 'Wird zubereitet',
  fahrer_name: null,
  fahrer_distanz_km: null,
  konfidenz_pct: 85,
};

interface Props { orderId: string; }

export function StorefrontPhase4001DynamischeEtaRing({ orderId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/order/eta?order_id=${orderId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const phasen = ['bestaetigt', 'zubereitung', 'fahrer_unterwegs', 'nahe', 'geliefert'] as const;
  const aktuelleIdx = phasen.indexOf(data.phase);
  const circumference = 2 * Math.PI * 48;
  const progress = data.phase === 'geliefert' ? 1 : Math.max(0.05, (aktuelleIdx + 1) / phasen.length);
  const offset = circumference * (1 - progress);
  const ringColor = data.phase === 'geliefert' ? '#10b981' : data.phase === 'nahe' ? '#3b82f6' : data.eta_min <= 15 ? '#f59e0b' : '#6366f1';

  const phasLabels: Record<typeof phasen[number], string> = {
    bestaetigt: 'Bestätigt',
    zubereitung: 'Zubereitung',
    fahrer_unterwegs: 'Fahrer unterwegs',
    nahe: 'Fast da!',
    geliefert: 'Geliefert ✓',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800">Deine Lieferzeit</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle cx="60" cy="60" r="48" fill="none" stroke={ringColor} strokeWidth="8"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'all 0.8s ease' }} />
            {data.phase !== 'geliefert' ? (
              <>
                <text x="60" y="55" textAnchor="middle" fontSize="28" fontWeight="bold" fill={ringColor}>{data.eta_min}</text>
                <text x="60" y="70" textAnchor="middle" fontSize="10" fill="#9ca3af">min</text>
              </>
            ) : (
              <text x="60" y="67" textAnchor="middle" fontSize="36">✓</text>
            )}
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1">
        <div className="text-base font-semibold text-gray-800">{phasLabels[data.phase]}</div>
        {data.phase !== 'geliefert' && (
          <div className="text-xs text-gray-500">{data.eta_min_best}–{data.eta_min_worst} min Spanne</div>
        )}
        {data.fahrer_name && (
          <div className="flex items-center justify-center gap-1 text-xs text-blue-600">
            <Bike className="w-3.5 h-3.5" />
            <span>{data.fahrer_name}</span>
            {data.fahrer_distanz_km !== null && <span>· {data.fahrer_distanz_km.toFixed(1)} km entfernt</span>}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        {phasen.map((p, i) => {
          const done = i < aktuelleIdx;
          const active = i === aktuelleIdx;
          return (
            <div key={p} className="flex flex-col items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-400' : active ? 'bg-indigo-500 ring-2 ring-indigo-200' : 'bg-gray-200'}`} />
              <span className="text-[8px] text-gray-400 text-center leading-tight" style={{ maxWidth: 36 }}>{phasLabels[p].split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />Live-Tracking</span>
        <span>Konfidenz {data.konfidenz_pct}% · 30-Sek-Update</span>
      </div>
    </div>
  );
}
