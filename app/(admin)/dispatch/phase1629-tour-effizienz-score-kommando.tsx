'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface TourStop {
  id: string;
  adresse?: string | null;
  status?: string | null;
  sequence_number?: number | null;
  eta?: string | null;
  delivered_at?: string | null;
  customer_name?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  score?: number | null;
  tour_score?: number | null;
  created_at?: string | null;
  stops?: TourStop[];
  eta_min?: number | null;
}

interface Props {
  batches: Batch[];
  locationId: string | null;
}

type ScoreStufe = 'exzellent' | 'gut' | 'okay' | 'schwach' | 'kritisch';

function scoreStufe(s: number): ScoreStufe {
  if (s >= 90) return 'exzellent';
  if (s >= 75) return 'gut';
  if (s >= 60) return 'okay';
  if (s >= 40) return 'schwach';
  return 'kritisch';
}

const STUFE_META: Record<ScoreStufe, { label: string; bar: string; text: string; bg: string; border: string }> = {
  exzellent: { label: 'Exzellent', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  gut:       { label: 'Gut',       bar: 'bg-matcha-500',  text: 'text-matcha-700',  bg: 'bg-matcha-50',   border: 'border-matcha-200'  },
  okay:      { label: 'Okay',      bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  schwach:   { label: 'Schwach',   bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200'  },
  kritisch:  { label: 'Kritisch',  bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
};

function stopStatusDot(s: string | null | undefined) {
  switch (s) {
    case 'geliefert':
    case 'abgeschlossen': return 'bg-emerald-500';
    case 'unterwegs':     return 'bg-blue-500 animate-pulse';
    case 'failed':        return 'bg-red-500';
    default:              return 'bg-stone-300';
  }
}

function fmtEta(eta: string | null | undefined): string {
  if (!eta) return '–';
  const d = new Date(eta);
  if (isNaN(d.getTime())) return '–';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchPhase1629TourEffizienzScoreKommando({ batches, locationId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const aktiv = batches.filter(
    (b) => b.status && !['abgeschlossen', 'storniert', 'cancelled'].includes(b.status),
  );

  if (aktiv.length === 0) return null;

  const avgScore = aktiv.length
    ? aktiv.reduce((s, b) => s + (b.tour_score ?? b.score ?? 0), 0) / aktiv.length
    : 0;

  const stufeCounts = Object.fromEntries(
    (['exzellent', 'gut', 'okay', 'schwach', 'kritisch'] as ScoreStufe[]).map((st) => [
      st,
      aktiv.filter((b) => scoreStufe(b.tour_score ?? b.score ?? 0) === st).length,
    ]),
  ) as Record<ScoreStufe, number>;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-800 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Tour-Effizienz · Score-Kommando
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 tabular-nums">
          Ø {avgScore.toFixed(0)} Pkt · {aktiv.length} Touren
        </span>
      </div>

      {/* Score-Verteilung */}
      <div className="flex border-b border-stone-100">
        {(['exzellent', 'gut', 'okay', 'schwach', 'kritisch'] as ScoreStufe[])
          .filter((st) => stufeCounts[st] > 0)
          .map((st) => {
            const m = STUFE_META[st];
            return (
              <div key={st} className={`flex-1 text-center py-2 ${m.bg}`}>
                <div className={`text-lg font-black tabular-nums ${m.text}`}>{stufeCounts[st]}</div>
                <div className={`text-[9px] font-bold uppercase tracking-wider ${m.text} opacity-70`}>{m.label}</div>
              </div>
            );
          })}
      </div>

      {/* Tour-Liste */}
      <div className="divide-y divide-stone-50">
        {aktiv
          .slice()
          .sort((a, b) => (a.tour_score ?? a.score ?? 0) - (b.tour_score ?? b.score ?? 0))
          .slice(0, 8)
          .map((b) => {
            const score = b.tour_score ?? b.score ?? 0;
            const st = scoreStufe(score);
            const m = STUFE_META[st];
            const stops = (b.stops ?? []).slice().sort(
              (x, y) => (x.sequence_number ?? 0) - (y.sequence_number ?? 0),
            );
            const isOpen = expanded === b.id;
            const delivered = stops.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;

            return (
              <div key={b.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition text-left"
                >
                  {/* Score-Ring */}
                  <div
                    className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center font-black text-sm ${m.bg} ${m.text} border-2 ${m.border}`}
                  >
                    {score.toFixed(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-800 truncate">
                        {b.driver_name ?? `Fahrer ${b.driver_id?.slice(-4) ?? '?'}`}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.bg} ${m.text}`}>
                        {m.label}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {stops.length > 0
                        ? `${delivered}/${stops.length} Stopps · ${stops.length > 0 ? fmtEta(stops[stops.length - 1]?.eta) : '–'}`
                        : 'Keine Stopps'}
                    </div>

                    {/* Stopp-Progressbar */}
                    {stops.length > 0 && (
                      <div className="mt-1.5 flex gap-1 items-center">
                        {stops.map((s, i) => (
                          <div
                            key={i}
                            className={`h-2 flex-1 rounded-full ${stopStatusDot(s.status)}`}
                            title={s.adresse ?? `Stopp ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score-Balken */}
                  <div className="w-20 shrink-0">
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.bar} transition-all`}
                        style={{ width: `${Math.min(100, score)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-stone-400 text-right mt-0.5 tabular-nums">{score.toFixed(0)}/100</div>
                  </div>
                </button>

                {/* Expanded: Stop-Details */}
                {isOpen && stops.length > 0 && (
                  <div className="bg-stone-50 border-t border-stone-100 px-4 py-3 space-y-2">
                    {stops.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className="text-stone-400 w-4 text-right shrink-0">{i + 1}.</span>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${stopStatusDot(s.status)}`} />
                        <span className="flex-1 text-stone-700 truncate">{s.adresse ?? s.customer_name ?? `Stopp ${i + 1}`}</span>
                        <span className="text-stone-400 tabular-nums shrink-0">{fmtEta(s.eta)}</span>
                        <span className="text-stone-400 shrink-0">{s.status ?? '–'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
