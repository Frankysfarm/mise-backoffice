'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Route, Star, Zap, Minus, RefreshCw, Navigation } from 'lucide-react';

/**
 * Phase 4500 — Fahrer-Score + Tour-Visualisierung V8
 *
 * Score-Ring 4-stufig (Platin/Gold/Gut/Schwach) + Delta-Badge
 * Stopp-Timeline mit farbcodierten Kacheln + ETA-Sync
 * Flotten-KPI-Grid + SLA-Zonen-Balken
 * 20-Sek-Polling; Mock-Fallback
 */

type ScoreStufe = 'platin' | 'gold' | 'gut' | 'schwach';
type StoppStatus = 'geliefert' | 'aktiv' | 'ausstehend';

interface TourStopp {
  nr: number;
  adresse: string;
  status: StoppStatus;
  lieferzeit_min: number | null;
  eta_min: number | null;
  puenktlich: boolean | null;
}

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  stufe: ScoreStufe;
  puenktlichkeit_pct: number;
  lieferzeit_avg_min: number;
  bewertung: number;
  aktive_tour_stopps: number;
  tour_stopps_gesamt: number;
  umsatz_heute_eur: number;
  tour_stopps: TourStopp[];
  sla_zone: string | null;
  ist_online: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  flotten_avg_score: number;
  flotten_avg_puenktlichkeit: number;
  flotten_avg_lieferzeit: number;
  alert_count: number;
  touren_aktiv: number;
}

const MOCK: ApiData = {
  flotten_avg_score: 78,
  flotten_avg_puenktlichkeit: 82,
  flotten_avg_lieferzeit: 26,
  alert_count: 1,
  touren_aktiv: 3,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Lukas H.', score: 94, score_delta: 4, stufe: 'platin',
      puenktlichkeit_pct: 96, lieferzeit_avg_min: 21, bewertung: 4.9,
      aktive_tour_stopps: 4, tour_stopps_gesamt: 6, umsatz_heute_eur: 148.50, ist_online: true,
      sla_zone: 'Mitte',
      tour_stopps: [
        { nr: 1, adresse: 'Adalbertsteinweg 12', status: 'geliefert',  lieferzeit_min: 18, eta_min: null, puenktlich: true  },
        { nr: 2, adresse: 'Jülicher Str. 8',     status: 'geliefert',  lieferzeit_min: 22, eta_min: null, puenktlich: true  },
        { nr: 3, adresse: 'Pontstraße 3',         status: 'geliefert',  lieferzeit_min: 25, eta_min: null, puenktlich: false },
        { nr: 4, adresse: 'Habsburgerallee 5',    status: 'geliefert',  lieferzeit_min: 20, eta_min: null, puenktlich: true  },
        { nr: 5, adresse: 'Vaalser Str. 20',      status: 'aktiv',      lieferzeit_min: null, eta_min: 8, puenktlich: null  },
        { nr: 6, adresse: 'Franzstraße 15',       status: 'ausstehend', lieferzeit_min: null, eta_min: 18, puenktlich: null  },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara M.', score: 79, score_delta: -1, stufe: 'gold',
      puenktlichkeit_pct: 80, lieferzeit_avg_min: 27, bewertung: 4.4,
      aktive_tour_stopps: 2, tour_stopps_gesamt: 5, umsatz_heute_eur: 97.20, ist_online: true,
      sla_zone: 'Nord',
      tour_stopps: [
        { nr: 1, adresse: 'Roermonder Str. 4',   status: 'geliefert',  lieferzeit_min: 28, eta_min: null, puenktlich: false },
        { nr: 2, adresse: 'Trierer Str. 11',      status: 'geliefert',  lieferzeit_min: 26, eta_min: null, puenktlich: true  },
        { nr: 3, adresse: 'Aachener Str. 9',      status: 'aktiv',      lieferzeit_min: null, eta_min: 11, puenktlich: null  },
        { nr: 4, adresse: 'Westbahnhof Pl. 1',   status: 'ausstehend', lieferzeit_min: null, eta_min: 22, puenktlich: null  },
        { nr: 5, adresse: 'Nizzaallee 7',         status: 'ausstehend', lieferzeit_min: null, eta_min: 33, puenktlich: null  },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.', score: 58, score_delta: -6, stufe: 'schwach',
      puenktlichkeit_pct: 54, lieferzeit_avg_min: 39, bewertung: 3.7,
      aktive_tour_stopps: 1, tour_stopps_gesamt: 4, umsatz_heute_eur: 62.80, ist_online: true,
      sla_zone: 'Süd',
      tour_stopps: [
        { nr: 1, adresse: 'Kapuzinergraben 2',   status: 'geliefert',  lieferzeit_min: 44, eta_min: null, puenktlich: false },
        { nr: 2, adresse: 'Elisengarten 3',       status: 'aktiv',      lieferzeit_min: null, eta_min: 15, puenktlich: null  },
        { nr: 3, adresse: 'Dom-Nähe 1',           status: 'ausstehend', lieferzeit_min: null, eta_min: 28, puenktlich: null  },
        { nr: 4, adresse: 'Katschhof 5',          status: 'ausstehend', lieferzeit_min: null, eta_min: 41, puenktlich: null  },
      ],
    },
  ],
};

const STUFE_CONFIG: Record<ScoreStufe, { label: string; ring: string; bg: string; text: string; badge: string }> = {
  platin: { label: '🏆 Platin', ring: 'ring-4 ring-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  gold:   { label: '⭐ Gold',   ring: 'ring-4 ring-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  gut:    { label: '👍 Gut',    ring: 'ring-4 ring-green-400',   bg: 'bg-green-50 dark:bg-green-950',   text: 'text-green-700 dark:text-green-300',   badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'   },
  schwach:{ label: '⚠ Schwach', ring: 'ring-4 ring-red-400',    bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'           },
};

const STOPP_CONFIG: Record<StoppStatus, { bg: string; text: string; dot: string; label: string }> = {
  geliefert:  { bg: 'bg-green-100 dark:bg-green-900',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500',  label: '✓' },
  aktiv:      { bg: 'bg-blue-100 dark:bg-blue-900',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500 animate-pulse', label: '→' },
  ausstehend: { bg: 'bg-muted',                          text: 'text-muted-foreground',                dot: 'bg-muted-foreground', label: '○' },
};

export function DispatchPhase4500FahrerScoreTourVisualisierungV8({
  locationId,
}: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(true);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/dispatch/driver-scores?location_id=${locationId}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d?.fahrer) { setData(d); setUseMock(false); }
    } catch {
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!locationId) return;
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  }, [fetchData, locationId]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Fahrer-Score + Tour V8</span>
          {useMock && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="h-3 w-3" />{data.alert_count} Alert
            </span>
          )}
          <button onClick={fetchData} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{data.flotten_avg_score}</div>
          <div className="text-[10px] text-muted-foreground">Ø Flotten-Score</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{data.flotten_avg_puenktlichkeit}%</div>
          <div className="text-[10px] text-muted-foreground">Ø Pünktlichkeit</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{data.flotten_avg_lieferzeit}m</div>
          <div className="text-[10px] text-muted-foreground">Ø Lieferzeit</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {data.fahrer.map((f, idx) => {
          const stufe = STUFE_CONFIG[f.stufe];
          const isOpen = expanded === f.fahrer_id;
          const fortschritt = Math.round((f.aktive_tour_stopps / Math.max(f.tour_stopps_gesamt, 1)) * 100);

          return (
            <div key={f.fahrer_id} className={`rounded-lg border border-border ${stufe.bg} overflow-hidden`}>
              {/* Fahrer-Header */}
              <button
                className="w-full p-3 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                onClick={() => setExpanded(isOpen ? null : f.fahrer_id)}
              >
                {/* Rang */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${stufe.badge}`}>
                  {idx + 1}
                </div>

                {/* Name + Score */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{f.fahrer_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stufe.badge}`}>{stufe.label}</span>
                    {!f.ist_online && <span className="text-[10px] text-muted-foreground">(offline)</span>}
                  </div>
                  {/* Fortschrittsbalken */}
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${fortschritt}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{f.aktive_tour_stopps}/{f.tour_stopps_gesamt} Stopps</div>
                </div>

                {/* Score */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <div className={`text-xl font-bold tabular-nums ${stufe.text}`}>{f.score}</div>
                  <div className={`flex items-center gap-0.5 text-[10px] font-medium ${f.score_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {f.score_delta > 0 ? <TrendingUp className="h-3 w-3" /> : f.score_delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                  </div>
                </div>
              </button>

              {/* Sub-KPIs (immer sichtbar) */}
              <div className="px-3 pb-2 flex gap-3">
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{f.puenktlichkeit_pct}% pünktl.</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Route className="h-3 w-3" />{f.lieferzeit_avg_min}m Ø</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Star className="h-3 w-3" />{f.bewertung.toFixed(1)}</span>
                {f.sla_zone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-3 w-3" />{f.sla_zone}</span>}
              </div>

              {/* Expandierbare Stopp-Timeline */}
              {isOpen && (
                <div className="px-3 pb-3 space-y-1 border-t border-border pt-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tour-Stopps</div>
                  {f.tour_stopps.map(s => {
                    const cfg = STOPP_CONFIG[s.status];
                    return (
                      <div key={s.nr} className={`flex items-center gap-2 rounded px-2 py-1 ${cfg.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`text-[10px] font-medium w-4 tabular-nums ${cfg.text}`}>{s.nr}</span>
                        <span className={`text-[10px] flex-1 truncate ${cfg.text}`}>{s.adresse}</span>
                        {s.status === 'geliefert' && s.lieferzeit_min !== null && (
                          <span className={`text-[10px] tabular-nums font-medium ${s.puenktlich === false ? 'text-red-600' : 'text-green-600'}`}>
                            {s.lieferzeit_min}m {s.puenktlich === false ? '⚠' : '✓'}
                          </span>
                        )}
                        {s.status !== 'geliefert' && s.eta_min !== null && (
                          <span className="text-[10px] tabular-nums text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                            <Navigation className="h-2.5 w-2.5" />{s.eta_min}m
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.fahrer.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">Keine aktiven Fahrer</div>
      )}

      <div className="text-[10px] text-muted-foreground text-right">{data.touren_aktiv} aktive Tour{data.touren_aktiv !== 1 ? 'en' : ''}</div>
    </div>
  );
}
