'use client';

import { useEffect, useState } from 'react';
import { Trophy, Clock, Star, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  locationId: string | null;
}

interface ScoreData {
  gesamtScore: number;
  puentlichkeitPct: number;
  bewertungAvg: number;
  anzahlLieferungen: number;
  schichtDauerMin: number;
  rang: number | null;
  gesamt: number | null;
  aktualisiert: string;
}

const MOCK: ScoreData = {
  gesamtScore: 82,
  puentlichkeitPct: 88,
  bewertungAvg: 4.8,
  anzahlLieferungen: 7,
  schichtDauerMin: 195,
  rang: 2,
  gesamt: 5,
  aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function scoreRing(score: number) {
  if (score >= 80) return { stroke: '#22c55e', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Sehr gut' };
  if (score >= 60) return { stroke: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Gut' };
  return { stroke: '#ef4444', bg: 'bg-red-50', text: 'text-red-600', label: 'Verbesserung' };
}

const R = 30;
const CIRC = 2 * Math.PI * R;

export function FahrerPhase822SchichtScoreCockpit({ driverId, locationId }: Props) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/driver/my-performance?period=today&driver_id=${driverId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData({
        gesamtScore: json.score ?? json.totalScore ?? MOCK.gesamtScore,
        puentlichkeitPct: json.ontime_pct ?? json.puentlichkeit ?? MOCK.puentlichkeitPct,
        bewertungAvg: json.rating_avg ?? json.bewertung ?? MOCK.bewertungAvg,
        anzahlLieferungen: json.deliveries ?? json.count ?? MOCK.anzahlLieferungen,
        schichtDauerMin: json.shift_min ?? MOCK.schichtDauerMin,
        rang: json.rank ?? null,
        gesamt: json.total ?? null,
        aktualisiert: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="rounded-2xl border bg-white p-4 text-xs text-stone-400 animate-pulse">Lade Score…</div>;
  if (!data) return null;

  const style = scoreRing(data.gesamtScore);
  const dashOffset = CIRC * (1 - data.gesamtScore / 100);

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white overflow-hidden')}>
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b border-stone-100', style.bg)}>
        <Trophy className={cn('h-4 w-4', style.text)} />
        <span className={cn('text-sm font-bold', style.text)}>Schicht-Score Live</span>
        {data.rang !== null && data.gesamt !== null && (
          <span className={cn('ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border', style.text, 'bg-white/60')}>
            Rang {data.rang}/{data.gesamt}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6 p-4">
        <div className="flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="40" cy="40" r={R}
              fill="none"
              stroke={style.stroke}
              strokeWidth="8"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text x="40" y="37" textAnchor="middle" fontSize="18" fontWeight="900" fill={style.stroke}>{data.gesamtScore}</text>
            <text x="40" y="51" textAnchor="middle" fontSize="9" fill="#9ca3af">Score</text>
          </svg>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            <span className="text-xs text-stone-500">Pünktlichkeit</span>
            <span className={cn('ml-auto text-sm font-black tabular-nums', data.puentlichkeitPct >= 85 ? 'text-emerald-700' : data.puentlichkeitPct >= 70 ? 'text-amber-700' : 'text-red-600')}>
              {data.puentlichkeitPct}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs text-stone-500">Bewertung</span>
            <span className="ml-auto text-sm font-black tabular-nums text-amber-700">{data.bewertungAvg.toFixed(1)} ★</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-stone-500">Lieferungen</span>
            <span className="ml-auto text-sm font-black tabular-nums text-blue-700">{data.anzahlLieferungen}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="text-[10px] text-stone-400 text-center mb-1">Score-Aufbau</div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden flex">
          <div className="bg-emerald-400 h-full" style={{ width: `${data.puentlichkeitPct * 0.4}%` }} title="Pünktlichkeit 40%" />
          <div className="bg-amber-400 h-full" style={{ width: `${data.bewertungAvg * 8}%` }} title="Bewertung 40%" />
          <div className="bg-blue-400 h-full" style={{ width: `${Math.min(20, data.anzahlLieferungen * 2)}%` }} title="Volumen 20%" />
        </div>
        <div className="flex justify-between text-[9px] text-stone-400 mt-1">
          <span>Pünktl. 40%</span>
          <span>Bew. 40%</span>
          <span>Vol. 20%</span>
        </div>
      </div>
    </div>
  );
}
