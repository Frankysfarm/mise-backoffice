'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Trophy, Route, MapPin, Star, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

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
  status: 'aktiv' | 'pause' | 'fertig' | 'verspaetet';
  zone?: string | null;
  delay_risiko?: 'niedrig' | 'mittel' | 'hoch' | null;
  stopps: TourStop[];
}

interface Props {
  locationId: string | null;
}

const TIER_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  platin: { bg: 'bg-purple-500/15', text: 'text-purple-300', label: 'Platin' },
  gold:   { bg: 'bg-yellow-500/15', text: 'text-yellow-300', label: 'Gold' },
  gut:    { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Gut' },
  schwach:{ bg: 'bg-red-500/15',    text: 'text-red-300',     label: 'Schwach' },
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

const MOCK_TOURS: TourDriver[] = [
  {
    tour_id: 't1', fahrer_name: 'Max K.', score: 92, score_delta: 3, stopps_gesamt: 6, stopps_erledigt: 4,
    puenktlichkeit_pct: 95, avg_stop_min: 4.2, umsatz: 186.5, status: 'aktiv', zone: 'Mitte', delay_risiko: 'niedrig',
    stopps: [
      { stop_nr: 1, adresse: 'Hauptstr. 5', status: 'fertig', eta_min: null, betrag: 32.5, bewertung: 5 },
      { stop_nr: 2, adresse: 'Marktpl. 12', status: 'fertig', eta_min: null, betrag: 28.0, bewertung: 4 },
      { stop_nr: 3, adresse: 'Rosenweg 3', status: 'fertig', eta_min: null, betrag: 41.0, bewertung: 5 },
      { stop_nr: 4, adresse: 'Lindenstr. 8', status: 'fertig', eta_min: null, betrag: 19.5, bewertung: null },
      { stop_nr: 5, adresse: 'Parkgasse 2', status: 'aktiv', eta_min: 3, betrag: 38.0, bewertung: null },
      { stop_nr: 6, adresse: 'Bergstr. 11', status: 'ausstehend', eta_min: 12, betrag: 27.5, bewertung: null },
    ],
  },
  {
    tour_id: 't2', fahrer_name: 'Lena S.', score: 78, score_delta: -2, stopps_gesamt: 5, stopps_erledigt: 2,
    puenktlichkeit_pct: 80, avg_stop_min: 5.8, umsatz: 142.0, status: 'aktiv', zone: 'Nord', delay_risiko: 'mittel',
    stopps: [
      { stop_nr: 1, adresse: 'Nordweg 4', status: 'fertig', eta_min: null, betrag: 35.0, bewertung: 4 },
      { stop_nr: 2, adresse: 'Birkenstr. 9', status: 'fertig', eta_min: null, betrag: 22.0, bewertung: 3 },
      { stop_nr: 3, adresse: 'Ahornweg 7', status: 'aktiv', eta_min: 5, betrag: 31.5, bewertung: null },
      { stop_nr: 4, adresse: 'Fichtestr. 3', status: 'ausstehend', eta_min: 14, betrag: 28.0, bewertung: null },
      { stop_nr: 5, adresse: 'Eichenpl. 1', status: 'ausstehend', eta_min: 22, betrag: 25.5, bewertung: null },
    ],
  },
  {
    tour_id: 't3', fahrer_name: 'Tom B.', score: 45, score_delta: -8, stopps_gesamt: 4, stopps_erledigt: 1,
    puenktlichkeit_pct: 50, avg_stop_min: 9.1, umsatz: 98.0, status: 'verspaetet', zone: 'Süd', delay_risiko: 'hoch',
    stopps: [
      { stop_nr: 1, adresse: 'Südring 6', status: 'fertig', eta_min: null, betrag: 29.0, bewertung: 2 },
      { stop_nr: 2, adresse: 'Gartenweg 14', status: 'verspaetet', eta_min: 8, betrag: 23.0, bewertung: null },
      { stop_nr: 3, adresse: 'Wiesenstr. 2', status: 'ausstehend', eta_min: 18, betrag: 26.0, bewertung: null },
      { stop_nr: 4, adresse: 'Feldweg 5', status: 'ausstehend', eta_min: 28, betrag: 20.0, bewertung: null },
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

export function DispatchPhase5110ScoreTourVisualisierungV19({ locationId }: Props) {
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

  const active = tours.filter(t => t.status === 'aktiv' || t.status === 'verspaetet');
  const fleetScore = active.length ? Math.round(active.reduce((s, t) => s + t.score, 0) / active.length) : 0;
  const fleetScoreColor = fleetScore >= 80 ? 'text-emerald-400' : fleetScore >= 60 ? 'text-amber-400' : 'text-red-400';
  const delayed = tours.filter(t => t.delay_risiko === 'hoch').length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Score & Tour-Visualisierung V19</span>
        </div>
        <div className={cn('text-lg font-bold', fleetScoreColor)}>{fleetScore}</div>
      </div>

      {/* Fleet-KPI */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Touren', val: tours.length, color: 'text-violet-400' },
          { label: 'Aktiv', val: active.length, color: 'text-emerald-400' },
          { label: 'Verspätet', val: delayed, color: 'text-red-400' },
          { label: 'Fleet-Score', val: fleetScore, color: fleetScoreColor },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
            <div className={cn('text-sm font-bold', color)}>{val}</div>
            <div className="text-[10px] text-white/40">{label}</div>
          </div>
        ))}
      </div>

      {/* Fleet-Score-Balken */}
      <ScoreBar score={fleetScore} />

      {/* Fahrer-Rangliste */}
      {loading ? (
        <div className="text-center text-white/40 text-xs py-4">Lädt…</div>
      ) : (
        <div className="space-y-2">
          {[...tours].sort((a, b) => b.score - a.score).map((t, i) => {
            const tier = getTier(t.score);
            const ts = TIER_STYLE[tier];
            const isOpen = expanded === t.tour_id;
            const delayColor = t.delay_risiko === 'hoch' ? 'text-red-400' : t.delay_risiko === 'mittel' ? 'text-amber-400' : 'text-emerald-400';

            return (
              <div key={t.tour_id} className={cn('rounded-lg border border-white/10 overflow-hidden', ts.bg)}>
                <button
                  className="w-full flex items-center gap-2 p-2 text-left"
                  onClick={() => setExpanded(isOpen ? null : t.tour_id)}
                >
                  <span className="text-xs text-white/40 w-4">{i + 1}.</span>
                  <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', ts.bg, ts.text)}>{ts.label}</span>
                  <span className="text-xs text-white flex-1">{t.fahrer_name ?? '—'}</span>
                  <span className={cn('text-xs font-bold', t.score >= 80 ? 'text-emerald-400' : t.score >= 60 ? 'text-amber-400' : 'text-red-400')}>{t.score}</span>
                  {t.score_delta !== null && t.score_delta !== undefined && (
                    <span className={cn('text-[10px]', t.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {t.score_delta >= 0 ? '+' : ''}{t.score_delta}
                    </span>
                  )}
                  <span className={cn('text-[10px]', delayColor)}>●</span>
                </button>

                {/* Fortschrittsbalken */}
                <div className="px-2 pb-1">
                  <ScoreBar score={t.score} />
                </div>

                {/* Stopp-Dot-Sequenz */}
                <div className="px-2 pb-2 flex gap-1 flex-wrap">
                  {t.stopps.map(s => (
                    <div key={s.stop_nr} className={cn('h-2 w-2 rounded-full', STOP_DOT[s.status])} title={`Stopp ${s.stop_nr}: ${s.adresse ?? ''}`} />
                  ))}
                  <span className="text-[10px] text-white/30 ml-1">{t.stopps_erledigt}/{t.stopps_gesamt}</span>
                </div>

                {/* Aufklappbare Stopp-Details */}
                {isOpen && (
                  <div className="px-2 pb-2 space-y-1 border-t border-white/5 pt-2">
                    {t.stopps.map(s => (
                      <div key={s.stop_nr} className="flex items-center gap-2 text-[10px]">
                        <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', STOP_DOT[s.status])} />
                        <span className="text-white/60 flex-1 truncate">{s.adresse}</span>
                        {s.eta_min !== null && <span className="text-white/40">{s.eta_min}m</span>}
                        {s.betrag !== null && <span className="text-white/60">{euro(s.betrag ?? 0)}</span>}
                        {s.bewertung !== null && <span className="text-amber-400">★{s.bewertung}</span>}
                      </div>
                    ))}
                    <div className="flex gap-2 text-[10px] text-white/40 pt-1">
                      <span>Pünktl: {t.puenktlichkeit_pct}%</span>
                      <span>Ø Stop: {t.avg_stop_min}min</span>
                      {t.umsatz !== null && <span>Umsatz: {euro(t.umsatz ?? 0)}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
