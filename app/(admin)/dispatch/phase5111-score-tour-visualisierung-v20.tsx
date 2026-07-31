'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Trophy, Route, MapPin, Star, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, Bike, Target, Zap } from 'lucide-react';

interface TourStop {
  stop_nr: number;
  adresse?: string | null;
  status: 'fertig' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min?: number | null;
  betrag?: number | null;
  bewertung?: number | null;
}

interface TourDriver {
  tour_id: string;
  fahrer_name?: string | null;
  score: number;
  score_delta?: number | null;
  stopps_gesamt: number;
  stopps_erledigt: number;
  puenktlichkeit_pct: number;
  avg_stop_min: number;
  umsatz?: number | null;
  route_effizienz_pct?: number | null;
  status: 'aktiv' | 'pause' | 'fertig' | 'verspaetet';
  zone?: string | null;
  delay_risiko?: 'niedrig' | 'mittel' | 'hoch' | null;
  stopps: TourStop[];
}

interface Props {
  locationId: string | null;
}

const TIER_STYLE: Record<string, { bg: string; text: string; label: string; ring: string }> = {
  platin: { bg: 'bg-purple-500/15', text: 'text-purple-300', label: 'Platin', ring: 'bg-purple-400' },
  gold:   { bg: 'bg-yellow-500/15', text: 'text-yellow-300', label: 'Gold',   ring: 'bg-yellow-400' },
  gut:    { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Gut',  ring: 'bg-emerald-400' },
  schwach:{ bg: 'bg-red-500/15',    text: 'text-red-300',     label: 'Schwach', ring: 'bg-red-400' },
};

function getTier(score: number) {
  if (score >= 90) return 'platin';
  if (score >= 75) return 'gold';
  if (score >= 55) return 'gut';
  return 'schwach';
}

const STOP_DOT: Record<TourStop['status'], string> = {
  fertig:     'bg-emerald-400',
  aktiv:      'bg-amber-400 animate-pulse',
  ausstehend: 'bg-white/20',
  verspaetet: 'bg-red-400',
};

const RISK_COLOR = {
  niedrig: 'text-emerald-400 bg-emerald-500/10',
  mittel:  'text-amber-400 bg-amber-500/10',
  hoch:    'text-red-400 bg-red-500/10',
};

const MOCK_TOURS: TourDriver[] = [
  {
    tour_id: 't1', fahrer_name: 'Max K.', score: 94, score_delta: 4, stopps_gesamt: 6, stopps_erledigt: 4,
    puenktlichkeit_pct: 96, avg_stop_min: 3.9, umsatz: 192.5, route_effizienz_pct: 88, status: 'aktiv', zone: 'Mitte', delay_risiko: 'niedrig',
    stopps: [
      { stop_nr: 1, adresse: 'Hauptstr. 5', status: 'fertig', betrag: 32.5, bewertung: 5 },
      { stop_nr: 2, adresse: 'Marktpl. 12', status: 'fertig', betrag: 28.0, bewertung: 4 },
      { stop_nr: 3, adresse: 'Rosenweg 3', status: 'fertig', betrag: 41.0, bewertung: 5 },
      { stop_nr: 4, adresse: 'Lindenstr. 8', status: 'fertig', betrag: 19.5 },
      { stop_nr: 5, adresse: 'Parkgasse 2', status: 'aktiv', eta_min: 3, betrag: 38.0 },
      { stop_nr: 6, adresse: 'Bergstr. 11', status: 'ausstehend', eta_min: 11, betrag: 33.5 },
    ],
  },
  {
    tour_id: 't2', fahrer_name: 'Lena S.', score: 79, score_delta: -1, stopps_gesamt: 5, stopps_erledigt: 2,
    puenktlichkeit_pct: 82, avg_stop_min: 5.6, umsatz: 148.0, route_effizienz_pct: 71, status: 'aktiv', zone: 'Nord', delay_risiko: 'mittel',
    stopps: [
      { stop_nr: 1, adresse: 'Nordweg 4', status: 'fertig', betrag: 35.0, bewertung: 4 },
      { stop_nr: 2, adresse: 'Birkenstr. 9', status: 'fertig', betrag: 22.0, bewertung: 3 },
      { stop_nr: 3, adresse: 'Ahornweg 7', status: 'aktiv', eta_min: 6, betrag: 31.5 },
      { stop_nr: 4, adresse: 'Fichtestr. 3', status: 'ausstehend', eta_min: 15, betrag: 28.0 },
      { stop_nr: 5, adresse: 'Eichenpl. 1', status: 'ausstehend', eta_min: 24, betrag: 31.5 },
    ],
  },
  {
    tour_id: 't3', fahrer_name: 'Tom B.', score: 48, score_delta: -6, stopps_gesamt: 4, stopps_erledigt: 1,
    puenktlichkeit_pct: 52, avg_stop_min: 8.8, umsatz: 101.0, route_effizienz_pct: 45, status: 'verspaetet', zone: 'Süd', delay_risiko: 'hoch',
    stopps: [
      { stop_nr: 1, adresse: 'Südring 6', status: 'fertig', betrag: 29.0, bewertung: 2 },
      { stop_nr: 2, adresse: 'Gartenweg 14', status: 'verspaetet', eta_min: 9, betrag: 23.0 },
      { stop_nr: 3, adresse: 'Wiesenstr. 2', status: 'ausstehend', eta_min: 20, betrag: 26.0 },
      { stop_nr: 4, adresse: 'Feldweg 5', status: 'ausstehend', eta_min: 31, betrag: 23.0 },
    ],
  },
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function DispatchPhase5111ScoreTourVisualisierungV20({ locationId }: Props) {
  const [tours, setTours] = useState<TourDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) { setTours(MOCK_TOURS); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/dispatch/scores?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setTours(data.tours ?? MOCK_TOURS);
        } else { setTours(MOCK_TOURS); }
      } catch { setTours(MOCK_TOURS); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const sorted = [...tours].sort((a, b) => b.score - a.score);
  const fleetScore = tours.length ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length) : 0;
  const activeCount = tours.filter(t => t.status === 'aktiv').length;
  const lateCount = tours.filter(t => t.delay_risiko === 'hoch').length;
  const avgRouteEff = tours.length
    ? Math.round(tours.reduce((s, t) => s + (t.route_effizienz_pct ?? 0), 0) / tours.length)
    : 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-center h-32">
        <span className="text-slate-400 text-sm animate-pulse">Lade Tour-Daten…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Score + Tour V20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Fleet</span>
          <span className={cn('text-lg font-bold', fleetScore >= 80 ? 'text-emerald-400' : fleetScore >= 60 ? 'text-amber-400' : 'text-red-400')}>
            {fleetScore}
          </span>
        </div>
      </div>

      {/* Fleet KPI strip */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Touren',   val: tours.length,    color: 'text-violet-400'  },
          { label: 'Aktiv',    val: activeCount,      color: 'text-amber-400'   },
          { label: 'Risiko',   val: lateCount,        color: lateCount > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Route-Eff', val: `${avgRouteEff}%`, color: avgRouteEff >= 75 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
            <div className={cn('text-sm font-bold leading-tight', color)}>{val}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Fleet Score bar */}
      <ScoreBar score={fleetScore} />

      {/* Driver cards */}
      <div className="space-y-2">
        {sorted.map((t, rank) => {
          const tier = getTier(t.score);
          const ts = TIER_STYLE[tier];
          const isExpanded = expanded === t.tour_id;

          return (
            <div key={t.tour_id} className={cn('rounded-lg border border-white/10 p-3 space-y-2', ts.bg)}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : t.tour_id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-4">#{rank + 1}</span>
                  <div className={cn('w-2 h-2 rounded-full', ts.ring)} />
                  <span className="text-sm font-semibold text-white">{t.fahrer_name ?? 'Fahrer'}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ts.bg, ts.text)}>{ts.label}</span>
                  {t.delay_risiko && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', RISK_COLOR[t.delay_risiko])}>
                      {t.delay_risiko}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    <span className={cn('text-base font-bold', ts.text)}>{t.score}</span>
                    {t.score_delta != null && t.score_delta !== 0 && (
                      t.score_delta > 0
                        ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                        : <TrendingDown className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Score + Route-Effizienz bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-14">Score</span>
                  <ScoreBar score={t.score} />
                </div>
                {t.route_effizienz_pct != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-14">Route-Eff</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', t.route_effizienz_pct >= 75 ? 'bg-emerald-400' : t.route_effizienz_pct >= 55 ? 'bg-amber-400' : 'bg-red-400')}
                        style={{ width: `${t.route_effizienz_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 w-7 text-right">{t.route_effizienz_pct}%</span>
                  </div>
                )}
              </div>

              {/* Mini KPI row */}
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span><Clock className="inline h-2.5 w-2.5 mr-0.5" />{t.puenktlichkeit_pct}%</span>
                <span><Route className="inline h-2.5 w-2.5 mr-0.5" />{t.stopps_erledigt}/{t.stopps_gesamt}</span>
                {t.umsatz != null && <span><Bike className="inline h-2.5 w-2.5 mr-0.5" />{euro(t.umsatz)}</span>}
                {t.zone && <span><MapPin className="inline h-2.5 w-2.5 mr-0.5" />{t.zone}</span>}
              </div>

              {/* Stop dot sequence */}
              <div className="flex items-center gap-1 flex-wrap">
                {t.stopps.map(s => (
                  <div key={s.stop_nr} className="flex flex-col items-center gap-0.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', STOP_DOT[s.status])} title={s.adresse ?? ''} />
                    <span className="text-[8px] text-slate-500">{s.stop_nr}</span>
                  </div>
                ))}
              </div>

              {/* Expanded stop timeline */}
              {isExpanded && (
                <div className="space-y-1 pt-1 border-t border-white/10">
                  {t.stopps.map(s => (
                    <div key={s.stop_nr} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STOP_DOT[s.status])} />
                        <span className="text-slate-300 truncate max-w-[120px]">{s.adresse ?? `Stop ${s.stop_nr}`}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {s.eta_min != null && <span className="text-slate-400">{s.eta_min} Min</span>}
                        {s.betrag != null && <span className="text-slate-300">{euro(s.betrag)}</span>}
                        {s.bewertung != null && (
                          <span className="flex items-center gap-0.5 text-yellow-400">
                            <Star className="h-2.5 w-2.5" />{s.bewertung}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-600 text-right">20-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
