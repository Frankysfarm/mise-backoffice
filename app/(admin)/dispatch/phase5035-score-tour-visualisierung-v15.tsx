'use client';

import { useEffect, useState } from 'react';
import {
  Trophy, Clock, TrendingUp, TrendingDown, Users, MapPin, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Zap, Route,
} from 'lucide-react';

// Phase 5035 — Score + Tour-Visualisierung V15
// Fleet-Score+Delta; 4-KPI-Strip Pünktl/Lieferzeit/ETA-Acc/Umsatz; Fahrer-Rangliste tier-farbkodiert
// Platin/Gold/Gut/Schwach+Score-Delta; Stopp-Dot-Sequenz farbkodiert fertig/aktiv/verspätet/ausstehend;
// ETA+km je Stopp aufklappbar; Verspätungs-Alert; 20-Sek-Polling; Mock-Fallback

type StoppStatus = 'geliefert' | 'aktiv' | 'verspaetet' | 'ausstehend';
type FahrerTier  = 'platin' | 'gold' | 'gut' | 'schwach';

interface Stopp {
  nr: number;
  adresse: string;
  status: StoppStatus;
  eta_min: number;
  km: number;
  betrag: number;
  bewertung: number | null;
}

interface Fahrer {
  id: string;
  name: string;
  tier: FahrerTier;
  score: number;
  score_delta: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  puenktl_pct: number;
  delay_risiko: boolean;
  stopps: Stopp[];
}

interface ApiData {
  fleet_score: number;
  fleet_delta: number;
  kpis: { puenktl: number; avg_lieferzeit: number; eta_acc: number; umsatz: number };
  fahrer: Fahrer[];
  alert: string | null;
}

const MOCK_STOPPS = (n: number): Stopp[] =>
  Array.from({ length: n }, (_, i) => ({
    nr: i + 1,
    adresse: ['Hauptstraße 12', 'Marktplatz 3', 'Ringstraße 47', 'Bahnhofstr. 8', 'Lindenweg 22'][i % 5],
    status: (['geliefert', 'geliefert', 'aktiv', 'ausstehend', 'ausstehend'][i % 5] as StoppStatus),
    eta_min: 5 + i * 8,
    km: parseFloat((1.2 + i * 0.9).toFixed(1)),
    betrag: 14 + i * 3,
    bewertung: i < 2 ? 5 : null,
  }));

const MOCK: ApiData = {
  fleet_score: 87,
  fleet_delta: 2,
  kpis: { puenktl: 91, avg_lieferzeit: 26, eta_acc: 88, umsatz: 3240 },
  fahrer: [
    { id: '1', name: 'Jonas M.', tier: 'platin', score: 96, score_delta: 2,  stopps_gesamt: 5, stopps_fertig: 3, puenktl_pct: 98, delay_risiko: false, stopps: MOCK_STOPPS(5) },
    { id: '2', name: 'Anna B.',  tier: 'gold',   score: 88, score_delta: -1, stopps_gesamt: 4, stopps_fertig: 2, puenktl_pct: 90, delay_risiko: false, stopps: MOCK_STOPPS(4) },
    { id: '3', name: 'Tom H.',   tier: 'gut',    score: 74, score_delta: 0,  stopps_gesamt: 3, stopps_fertig: 1, puenktl_pct: 82, delay_risiko: true,  stopps: MOCK_STOPPS(3) },
    { id: '4', name: 'Sara K.',  tier: 'schwach',score: 58, score_delta: -3, stopps_gesamt: 3, stopps_fertig: 0, puenktl_pct: 65, delay_risiko: true,  stopps: MOCK_STOPPS(3) },
  ],
  alert: null,
};

const TIER_STYLE: Record<FahrerTier, string> = {
  platin: 'border-slate-400 bg-slate-50',
  gold:   'border-amber-300 bg-amber-50',
  gut:    'border-emerald-300 bg-emerald-50',
  schwach:'border-red-300 bg-red-50',
};

const TIER_BADGE: Record<FahrerTier, string> = {
  platin: 'bg-slate-700 text-white',
  gold:   'bg-amber-500 text-white',
  gut:    'bg-emerald-600 text-white',
  schwach:'bg-red-600 text-white',
};

const TIER_SCORE: Record<FahrerTier, string> = {
  platin: 'text-slate-700', gold: 'text-amber-600', gut: 'text-emerald-700', schwach: 'text-red-600',
};

const STOPP_DOT: Record<StoppStatus, string> = {
  geliefert:  'bg-emerald-500',
  aktiv:      'bg-blue-500 animate-pulse',
  verspaetet: 'bg-red-500',
  ausstehend: 'bg-muted-foreground/30',
};

export function DispatchPhase5035ScoreTourVisualisierungV15({ locationId }: { locationId?: string | null }) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/dispatch/tours${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 20_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const scoreColor = d.fleet_score >= 85 ? 'text-emerald-600' : d.fleet_score >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <span className="font-bold text-sm">Tour-Score V15</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-black ${d.fleet_score >= 85 ? 'text-emerald-300' : d.fleet_score >= 70 ? 'text-amber-300' : 'text-red-300'}`}>
            {d.fleet_score}
          </span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${d.fleet_delta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {d.fleet_delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {d.fleet_delta > 0 ? '+' : ''}{d.fleet_delta}
          </span>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Pünktlichkeit', val: `${d.kpis.puenktl}%`,           warn: d.kpis.puenktl < 80,     icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
            { label: 'Ø Lieferzeit',  val: `${d.kpis.avg_lieferzeit} min`,  warn: d.kpis.avg_lieferzeit > 35,icon: <Clock className="h-3.5 w-3.5 text-amber-500" /> },
            { label: 'ETA-Accuracy',  val: `${d.kpis.eta_acc}%`,            warn: d.kpis.eta_acc < 75,     icon: <Zap className="h-3.5 w-3.5 text-indigo-500" /> },
            { label: 'Umsatz',        val: `${(d.kpis.umsatz / 1000).toFixed(1)}k €`, warn: false,         icon: <Route className="h-3.5 w-3.5 text-emerald-600" /> },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl border p-2.5 text-center ${kpi.warn ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}>
              <div className="flex justify-center mb-1">{kpi.icon}</div>
              <div className={`font-black text-sm ${kpi.warn ? 'text-red-600' : 'text-foreground'}`}>{kpi.val}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Fahrer Liste */}
        <div className="space-y-2">
          {d.fahrer.map((f) => {
            const isOpen = expanded.has(f.id);
            return (
              <div key={f.id} className={`rounded-xl border ${TIER_STYLE[f.tier]} overflow-hidden`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => toggle(f.id)}
                >
                  {/* Stopp-Dots */}
                  <div className="flex items-center gap-0.5">
                    {f.stopps.map((s) => (
                      <span key={s.nr} className={`inline-block h-2 w-2 rounded-full ${STOPP_DOT[s.status]}`} />
                    ))}
                  </div>

                  {/* Name + Badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{f.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TIER_BADGE[f.tier]}`}>
                        {f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}
                      </span>
                      {f.delay_risiko && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {f.stopps_fertig}/{f.stopps_gesamt} Stopps · {f.puenktl_pct}% pünktl.
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div>
                      <div className={`text-lg font-black ${TIER_SCORE[f.tier]}`}>{f.score}</div>
                      <div className={`text-[10px] font-semibold flex items-center gap-0.5 ${f.score_delta > 0 ? 'text-green-600' : f.score_delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {f.score_delta > 0 ? <TrendingUp className="h-3 w-3" /> : f.score_delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Stopp-Timeline */}
                {isOpen && (
                  <div className="border-t border-border bg-white/60 px-3 py-2 space-y-1">
                    {f.stopps.map((s) => (
                      <div key={s.nr} className="flex items-center gap-2 py-1">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STOPP_DOT[s.status]}`} />
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs flex-1 truncate text-foreground">{s.adresse}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">ETA {s.eta_min} min</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{s.km} km</span>
                        {s.bewertung && <span className="text-[10px] text-amber-500">★{s.bewertung}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {([['geliefert','bg-emerald-500'],['aktiv','bg-blue-500'],['verspätet','bg-red-500'],['ausstehend','bg-muted-foreground/30']] as const).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${c}`} />{l}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.fahrer.length} Fahrer aktiv</span>
          <span>Polling alle 20 Sek</span>
        </div>
      </div>
    </div>
  );
}
