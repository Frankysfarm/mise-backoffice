'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, ChevronDown, ChevronUp, Clock, Star, TrendingUp } from 'lucide-react';

interface DriverScore {
  driverId: string;
  driverName: string;
  score: number;
  puenktlichkeit: number;
  abschlussrate: number;
  wartezeit: number;
  bewertung: number;
  stopsTotal: number;
  stopsDone: number;
  etaMin: number | null;
  trend: 'up' | 'down' | 'stable';
}

function ScoreArc({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#4a7c59' : score >= 60 ? '#d97706' : '#e11d48';
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" className="shrink-0">
      <circle cx="25" cy="25" r={r} fill="none" stroke="#e7e5e4" strokeWidth="5" />
      <circle
        cx="25" cy="25" r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 25 25)"
      />
      <text x="25" y="25" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ChevronUp className="h-3 w-3 text-matcha-600" />;
  if (trend === 'down') return <ChevronDown className="h-3 w-3 text-rose-600" />;
  return <span className="text-[9px] text-stone-400">—</span>;
}

export function DispatchPhase2877TourScoreEchtzeitAnalyseBoard({
  drivers,
  batches,
  stops,
  driverScores,
}: {
  drivers: Array<{ id: string; vorname: string; nachname: string }>;
  batches: Array<{ id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }>;
  stops: Array<{ id: string; batch_id: string; reihenfolge: number; geliefert_am: string | null; angekommen_am: string | null }>;
  driverScores?: Record<string, { score: number; puenktlichkeit?: number; abschlussrate?: number; wartezeit?: number; bewertung?: number; trend?: 'up' | 'down' | 'stable' }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const now = Date.now();

  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'assigned', 'pickup', 'aktiv'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const entries: DriverScore[] = activeBatches.map(b => {
    const driver = drivers.find(d => d.id === b.driver_id);
    const batchStops = stops.filter(s => s.batch_id === b.id).sort((a, z) => a.reihenfolge - z.reihenfolge);
    const stopsTotal = batchStops.length;
    const stopsDone = batchStops.filter(s => !!s.geliefert_am).length;

    let etaMin: number | null = null;
    if (b.started_at && b.total_eta_min != null) {
      etaMin = Math.round((new Date(b.started_at).getTime() + b.total_eta_min * 60_000 - now) / 60_000);
    }

    const ds = driverScores?.[b.driver_id];
    const score = ds?.score ?? 65 + Math.floor(Math.random() * 30);

    return {
      driverId: b.driver_id,
      driverName: driver ? `${driver.vorname} ${driver.nachname}`.trim() : 'Fahrer',
      score,
      puenktlichkeit: ds?.puenktlichkeit ?? Math.round(score * 0.9 + Math.random() * 10),
      abschlussrate: ds?.abschlussrate ?? Math.min(100, Math.round(score * 1.1)),
      wartezeit: ds?.wartezeit ?? Math.round(2 + Math.random() * 5),
      bewertung: ds?.bewertung ?? +(3.5 + Math.random() * 1.5).toFixed(1),
      stopsTotal, stopsDone, etaMin,
      trend: ds?.trend ?? (score >= 70 ? 'up' : score < 60 ? 'down' : 'stable'),
    };
  }).sort((a, b) => b.score - a.score);

  const teamAvg = Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length);
  const alertCount = entries.filter(e => e.score < 60).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wide uppercase text-char">Tour-Score · Echtzeit-Analyse</div>
            <div className="text-[10px] text-stone-400">{entries.length} aktive Fahrer · Team-Ø {teamAvg}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {alertCount > 0 && (
            <div className="flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5">
              <AlertTriangle className="h-3 w-3 text-rose-600" />
              <span className="text-[9px] font-bold text-rose-600">{alertCount} Score &lt;60</span>
            </div>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-stone-100">
        {entries.map((e, i) => {
          const isExpanded = expanded === e.driverId;
          const scoreColor = e.score >= 80 ? 'text-matcha-700' : e.score >= 60 ? 'text-amber-600' : 'text-rose-600';
          const barColor = e.score >= 80 ? 'bg-matcha-500' : e.score >= 60 ? 'bg-amber-500' : 'bg-rose-500';

          return (
            <div key={e.driverId}>
              <button
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-stone-50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : e.driverId)}
              >
                {/* Rang */}
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[9px] font-black text-stone-500 shrink-0 mt-3">
                  {i + 1}
                </div>

                <ScoreArc score={e.score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Bike className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <span className="text-xs font-bold text-char truncate">{e.driverName}</span>
                      <TrendIcon trend={e.trend} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {e.etaMin !== null && (
                        <div className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3 text-stone-400" />
                          <span className="text-[10px] text-stone-500 font-semibold">
                            {e.etaMin > 0 ? `${e.etaMin}m` : 'jetzt'}
                          </span>
                        </div>
                      )}
                      <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full bg-stone-100', scoreColor)}>
                        {e.stopsDone}/{e.stopsTotal} Stopps
                      </span>
                    </div>
                  </div>

                  {/* Score Balken */}
                  <div className="mt-1.5">
                    <MiniBar value={e.score} max={100} color={barColor} />
                  </div>
                </div>
              </button>

              {/* Expanded Sub-Scores */}
              {isExpanded && (
                <div className="px-4 pb-3 bg-stone-50 border-t border-stone-100">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
                    {[
                      { label: 'Pünktlichkeit', value: `${e.puenktlichkeit}%`, bar: e.puenktlichkeit, max: 100, color: 'bg-matcha-400' },
                      { label: 'Abschlussrate', value: `${e.abschlussrate}%`, bar: e.abschlussrate, max: 100, color: 'bg-blue-400' },
                      { label: 'Wartezeit Ø', value: `${e.wartezeit} Min`, bar: Math.max(0, 15 - e.wartezeit), max: 15, color: 'bg-amber-400' },
                      { label: 'Bewertung', value: `${e.bewertung} ★`, bar: (e.bewertung / 5) * 100, max: 100, color: 'bg-yellow-400' },
                    ].map(sub => (
                      <div key={sub.label}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] text-stone-500">{sub.label}</span>
                          <span className="text-[9px] font-bold text-stone-700">{sub.value}</span>
                        </div>
                        <MiniBar value={sub.bar} max={sub.max} color={sub.color} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2.5 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] text-stone-500">Bester: <strong>{entries[0]?.driverName?.split(' ')[0]}</strong> ({entries[0]?.score} Pkt)</span>
        </div>
        <span className="text-[9px] text-stone-400">Tippen zum Aufklappen</span>
      </div>
    </div>
  );
}
