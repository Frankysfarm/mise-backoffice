'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface QualitaetEntry {
  id:          string;
  score:       number;
  berechnetAm: string;
  komponenten: {
    puenktlichkeit:   number | null;
    vollstaendigkeit: number;
    zufriedenheit:    number | null;
    minutesLate:      number | null;
    hasRating:        boolean;
  };
}

function scoreGrade(s: number) {
  if (s >= 90) return { label: 'A+', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (s >= 80) return { label: 'A',  color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (s >= 70) return { label: 'B',  color: 'text-amber-600',   bg: 'bg-amber-50' };
  if (s >= 55) return { label: 'C',  color: 'text-orange-600',  bg: 'bg-orange-50' };
  return                { label: 'D',  color: 'text-red-600',     bg: 'bg-red-50' };
}

function barColor(s: number) {
  if (s >= 85) return 'bg-emerald-500';
  if (s >= 70) return 'bg-amber-400';
  if (s >= 50) return 'bg-orange-400';
  return 'bg-red-500';
}

export function QualitaetsTrendKarte({
  driverId,
  locationId,
}: {
  driverId:   string;
  locationId: string;
}) {
  const [entries, setEntries] = useState<QualitaetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    fetch(`/api/delivery/driver/liefer-qualitaet?location_id=${encodeURIComponent(locationId)}&days=30`)
      .then((r) => r.json())
      .then((d: { qualitaet?: QualitaetEntry[] }) => {
        if (mounted.current && d.qualitaet) setEntries(d.qualitaet);
      })
      .catch(() => {})
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [driverId, locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-stone-800 border border-stone-700 p-4 space-y-3">
        <div className="h-4 w-36 bg-stone-700 rounded animate-pulse" />
        <div className="flex gap-1">
          {[...Array(10)].map((_, i) => <div key={i} className="flex-1 h-10 bg-stone-700 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (entries.length === 0) return null;

  const scores = entries.map((e) => e.score);
  const avg    = Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10;
  const recent = scores.slice(0, 5);
  const prior  = scores.slice(5, 10);
  const recentAvg = recent.reduce((s, n) => s + n, 0) / recent.length;
  const priorAvg  = prior.length > 0 ? prior.reduce((s, n) => s + n, 0) / prior.length : recentAvg;
  const diff      = recentAvg - priorAvg;
  const trend     = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';

  const grade     = scoreGrade(avg);
  const latest    = entries[0];
  const komp      = latest.komponenten;

  // Show last 20 entries as mini bars
  const display = entries.slice(0, 20).reverse();
  const maxScore = 100;

  return (
    <div className="rounded-2xl bg-stone-800 border border-stone-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Liefer-Qualität</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${grade.bg}`}>
          <span className={`text-sm font-black ${grade.color}`}>{grade.label}</span>
          <span className="text-xs text-stone-500">{avg.toFixed(1)}</span>
        </div>
      </div>

      {/* Trend-Chart (Balken) */}
      <div className="flex items-end gap-0.5 h-12">
        {display.map((e, i) => {
          const h = Math.max(4, (e.score / maxScore) * 48);
          return (
            <div
              key={e.id}
              title={`${new Date(e.berechnetAm).toLocaleDateString('de-DE')}: ${e.score.toFixed(1)}`}
              style={{ height: h }}
              className={`flex-1 rounded-t ${barColor(e.score)} opacity-${i === display.length - 1 ? '100' : '80'}`}
            />
          );
        })}
      </div>

      {/* Trend-Badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-stone-400">
          {entries.length} Lieferungen (30 Tage)
        </span>
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          trend === 'up'     ? 'text-emerald-400' :
          trend === 'down'   ? 'text-red-400' :
          'text-stone-400'
        }`}>
          {trend === 'up'     && <TrendingUp className="h-3.5 w-3.5" />}
          {trend === 'down'   && <TrendingDown className="h-3.5 w-3.5" />}
          {trend === 'stable' && <Minus className="h-3.5 w-3.5" />}
          {trend === 'up' ? '+' : ''}{diff.toFixed(1)} vs. Vorwoche
        </div>
      </div>

      {/* Letzte Lieferung Aufschlüsselung */}
      <div className="rounded-xl bg-stone-700/50 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Letzte Lieferung</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pünktlichkeit', value: komp.puenktlichkeit, weight: '40%' },
            { label: 'Vollständig',   value: komp.vollstaendigkeit, weight: '30%' },
            { label: 'Zufriedenheit', value: komp.zufriedenheit,  weight: '30%' },
          ].map(({ label, value, weight }) => (
            <div key={label} className="text-center">
              <div className={`text-base font-black ${value !== null && value >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {value !== null ? Math.round(value) : '—'}
              </div>
              <div className="text-[9px] text-stone-400">{label}</div>
              <div className="text-[9px] text-stone-500">{weight}</div>
            </div>
          ))}
        </div>
        {komp.minutesLate !== null && komp.minutesLate > 0 && (
          <p className="text-[10px] text-red-400 text-center">
            {Math.round(komp.minutesLate)} Min verspätet
          </p>
        )}
      </div>
    </div>
  );
}
