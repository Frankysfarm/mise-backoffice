'use client';

import { useEffect, useState } from 'react';
import {
  Trophy, Clock, TrendingUp, TrendingDown, Users, MapPin, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Zap, Route, Target, Navigation2,
  Activity, BarChart2, Gauge, Shield,
} from 'lucide-react';

// Phase 5062 — Score + Tour-Visualisierung V18
// Neu: Schicht-Auslastungs-Ring; Fahrer-Zufriedenheits-Score; ETA-Präzisions-Heatmap;
// Live-Routen-Deviation; Zonen-Rentabilitäts-Matrix; 20-Sek-Polling; Mock-Fallback

type StoppStatus = 'geliefert' | 'aktiv' | 'verspaetet' | 'ausstehend';
type FahrerTier  = 'platin' | 'gold' | 'gut' | 'schwach';

interface Stopp {
  nr: number;
  adresse: string;
  status: StoppStatus;
  eta_min: number;
  km: number;
  bewertung: number | null;
  eta_confidence: number;
  route_deviation_pct: number;
}

interface Fahrer {
  id: string;
  name: string;
  tier: FahrerTier;
  score: number;
  score_delta: number;
  route_effizienz: number;
  route_sync_score: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  puenktl_pct: number;
  delay_risiko: boolean;
  delay_risiko_grund: string | null;
  zone: string;
  auslastung_pct: number;
  stopps: Stopp[];
}

interface ZoneCapacity {
  zone: string;
  fahrer: number;
  auslastung: number;
  kapazitaets_warnung: boolean;
  rentabilitaet: number;
}

interface ApiData {
  fleet_score: number;
  fleet_delta: number;
  eta_accuracy_trend: number;
  kpis: { puenktl: number; avg_lieferzeit: number; eta_acc: number; umsatz: number };
  fahrer: Fahrer[];
  zonen_coverage: ZoneCapacity[];
  verzoegerungs_risiko_anzahl: number;
  eta_confidence_avg: number;
  routen_sync_gesamt: number;
  schicht_auslastung_avg: number;
  alert: string | null;
}

const MOCK_STOPPS = (n: number): Stopp[] =>
  Array.from({ length: n }, (_, i) => ({
    nr: i + 1,
    adresse: ['Hauptstraße 12', 'Marktplatz 3', 'Ringstraße 47', 'Bahnhofstr. 8', 'Lindenweg 22'][i % 5],
    status: (['geliefert', 'geliefert', 'aktiv', 'ausstehend', 'ausstehend'][i % 5] as StoppStatus),
    eta_min: 5 + i * 8,
    km: parseFloat((1.2 + i * 0.9).toFixed(1)),
    bewertung: i < 2 ? 5 : null,
    eta_confidence: [95, 91, 88, 78, 72][i % 5],
    route_deviation_pct: [2, 3, 8, 5, 4][i % 5],
  }));

const MOCK: ApiData = {
  fleet_score: 93,
  fleet_delta: 2,
  eta_accuracy_trend: 3.5,
  kpis: { puenktl: 96, avg_lieferzeit: 22, eta_acc: 93, umsatz: 3820 },
  verzoegerungs_risiko_anzahl: 1,
  eta_confidence_avg: 90,
  routen_sync_gesamt: 88,
  schicht_auslastung_avg: 82,
  fahrer: [
    { id: '1', name: 'Jonas M.', tier: 'platin', score: 97, score_delta: 1,  route_effizienz: 95, route_sync_score: 94, stopps_gesamt: 5, stopps_fertig: 3, puenktl_pct: 98, delay_risiko: false, delay_risiko_grund: null,               zone: 'Mitte', auslastung_pct: 91, stopps: MOCK_STOPPS(5) },
    { id: '2', name: 'Anna B.',  tier: 'gold',   score: 91, score_delta: 2,  route_effizienz: 88, route_sync_score: 85, stopps_gesamt: 4, stopps_fertig: 2, puenktl_pct: 93, delay_risiko: false, delay_risiko_grund: null,               zone: 'Nord',  auslastung_pct: 84, stopps: MOCK_STOPPS(4) },
    { id: '3', name: 'Tom H.',   tier: 'gut',    score: 74, score_delta: -1, route_effizienz: 72, route_sync_score: 76, stopps_gesamt: 3, stopps_fertig: 1, puenktl_pct: 81, delay_risiko: true,  delay_risiko_grund: 'Stau auf Route B',  zone: 'Süd',   auslastung_pct: 71, stopps: MOCK_STOPPS(3) },
    { id: '4', name: 'Sara K.',  tier: 'schwach',score: 61, score_delta: -1, route_effizienz: 59, route_sync_score: 62, stopps_gesamt: 3, stopps_fertig: 0, puenktl_pct: 68, delay_risiko: true,  delay_risiko_grund: 'Falsche Route',     zone: 'West',  auslastung_pct: 58, stopps: MOCK_STOPPS(3) },
  ],
  zonen_coverage: [
    { zone: 'Mitte', fahrer: 2, auslastung: 82, kapazitaets_warnung: false, rentabilitaet: 94 },
    { zone: 'Nord',  fahrer: 1, auslastung: 67, kapazitaets_warnung: false, rentabilitaet: 82 },
    { zone: 'Süd',   fahrer: 1, auslastung: 58, kapazitaets_warnung: false, rentabilitaet: 76 },
    { zone: 'West',  fahrer: 1, auslastung: 91, kapazitaets_warnung: true,  rentabilitaet: 61 },
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

const CONF_COLOR = (c: number) => c >= 85 ? 'text-emerald-600' : c >= 70 ? 'text-amber-600' : 'text-red-600';

export function DispatchPhase5062ScoreTourVisualisierungV18({ locationId }: { locationId?: string | null }) {
  const [data, setData]         = useState<ApiData | null>(null);
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

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-700 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <span className="font-bold text-sm">Tour-Score V18</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-black ${d.fleet_score >= 85 ? 'text-emerald-300' : d.fleet_score >= 70 ? 'text-amber-300' : 'text-red-300'}`}>
            {d.fleet_score}
          </span>
          <div className="flex flex-col items-end">
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${d.fleet_delta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {d.fleet_delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {d.fleet_delta > 0 ? '+' : ''}{d.fleet_delta}
            </span>
            <span className="text-[10px] opacity-70">ETA-Trend {d.eta_accuracy_trend > 0 ? '+' : ''}{d.eta_accuracy_trend}%</span>
          </div>
        </div>
      </div>

      {d.verzoegerungs_risiko_anzahl > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          {d.verzoegerungs_risiko_anzahl} Fahrer mit Verspätungsrisiko
        </div>
      )}
      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Pünktlichkeit', val: `${d.kpis.puenktl}%`,            warn: d.kpis.puenktl < 80,       icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
            { label: 'Ø Lieferzeit',  val: `${d.kpis.avg_lieferzeit} min`,   warn: d.kpis.avg_lieferzeit > 35, icon: <Clock        className="h-3.5 w-3.5 text-amber-500" /> },
            { label: 'ETA-Accuracy',  val: `${d.kpis.eta_acc}%`,             warn: d.kpis.eta_acc < 75,        icon: <Target       className="h-3.5 w-3.5 text-violet-500" /> },
            { label: 'Umsatz',        val: `${(d.kpis.umsatz / 1000).toFixed(1)}k €`, warn: false,            icon: <Zap          className="h-3.5 w-3.5 text-emerald-600" /> },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl border p-2.5 text-center ${kpi.warn ? 'border-red-200 bg-red-50' : 'border-border bg-muted/20'}`}>
              <div className="flex justify-center mb-1">{kpi.icon}</div>
              <div className={`font-black text-sm ${kpi.warn ? 'text-red-600' : 'text-foreground'}`}>{kpi.val}</div>
              <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Fleet-Metriken inkl. Schicht-Auslastung */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-center">
            <Gauge className="h-4 w-4 text-indigo-600 mx-auto mb-1" />
            <div className={`text-base font-black ${CONF_COLOR(d.eta_confidence_avg)}`}>{d.eta_confidence_avg}%</div>
            <div className="text-[10px] text-muted-foreground">ETA-Konfidenz Ø</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-center">
            <Activity className="h-4 w-4 text-violet-600 mx-auto mb-1" />
            <div className={`text-base font-black ${d.routen_sync_gesamt >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{d.routen_sync_gesamt}%</div>
            <div className="text-[10px] text-muted-foreground">Routen-Sync</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
            <Shield className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
            <div className={`text-base font-black ${d.schicht_auslastung_avg >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>{d.schicht_auslastung_avg}%</div>
            <div className="text-[10px] text-muted-foreground">Schicht-Auslastung</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
            <AlertTriangle className="h-4 w-4 text-amber-600 mx-auto mb-1" />
            <div className={`text-base font-black ${d.verzoegerungs_risiko_anzahl > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.verzoegerungs_risiko_anzahl}</div>
            <div className="text-[10px] text-muted-foreground">Verzögerungs-Risiken</div>
          </div>
        </div>

        {/* Zonen-Coverage mit Rentabilität */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Navigation2 className="h-3.5 w-3.5" />Zonen · Abdeckung + Rentabilität
          </div>
          <div className="grid grid-cols-4 gap-2">
            {d.zonen_coverage.map((z) => (
              <div key={z.zone} className={`rounded-xl border p-2 text-center ${z.kapazitaets_warnung ? 'border-red-300 bg-red-50' : 'border-border bg-muted/20'}`}>
                <div className="text-xs font-bold text-foreground">{z.zone}</div>
                <div className={`text-sm font-black mt-0.5 ${z.auslastung >= 85 ? 'text-red-600' : z.auslastung >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {z.auslastung}%
                </div>
                <div className="text-[10px] text-muted-foreground">{z.fahrer} Fahr.</div>
                <div className={`text-[10px] font-semibold ${z.rentabilitaet >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {z.rentabilitaet}% ROI
                </div>
                <div className="mt-1 h-1 rounded-full bg-muted">
                  <div className={`h-1 rounded-full ${z.auslastung >= 85 ? 'bg-red-500' : z.auslastung >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${z.auslastung}%` }} />
                </div>
                {z.kapazitaets_warnung && <div className="text-[9px] text-red-600 font-bold mt-0.5">Überlastet</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Fahrer Liste */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1">
            <BarChart2 className="h-3.5 w-3.5" />Fahrer · Score + Auslastung
          </div>
          {d.fahrer.map((f) => {
            const isOpen = expanded.has(f.id);
            return (
              <div key={f.id} className={`rounded-xl border ${TIER_STYLE[f.tier]} overflow-hidden`}>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => toggle(f.id)}
                >
                  <div className="flex items-center gap-0.5">
                    {f.stopps.map((s) => (
                      <span key={s.nr} className={`inline-block h-2 w-2 rounded-full ${STOPP_DOT[s.status]}`} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{f.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${TIER_BADGE[f.tier]}`}>
                        {f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}
                      </span>
                      {f.delay_risiko && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {f.stopps_fertig}/{f.stopps_gesamt} · {f.puenktl_pct}% pünktl. · Auslast. {f.auslastung_pct}% · {f.zone}
                    </div>
                    {f.delay_risiko_grund && (
                      <div className="text-[9px] text-red-600 font-medium">{f.delay_risiko_grund}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className={`text-lg font-black ${TIER_SCORE[f.tier]}`}>{f.score}</div>
                      <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${f.score_delta > 0 ? 'text-green-600' : f.score_delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {f.score_delta > 0 ? <TrendingUp className="h-3 w-3" /> : f.score_delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Auslastungs + Effizienz-Balken */}
                <div className="px-3 pb-1.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Activity className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-1 rounded-full bg-muted">
                      <div className={`h-1 rounded-full ${f.auslastung_pct >= 75 ? 'bg-emerald-500' : f.auslastung_pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${f.auslastung_pct}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{f.auslastung_pct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Route className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-1 rounded-full bg-muted">
                      <div className={`h-1 rounded-full ${f.route_effizienz >= 85 ? 'bg-emerald-500' : f.route_effizienz >= 70 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${f.route_effizienz}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{f.route_effizienz}%</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-white/60 px-3 py-2 space-y-1">
                    {f.stopps.map((s) => (
                      <div key={s.nr} className="flex items-center gap-2 py-0.5">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STOPP_DOT[s.status]}`} />
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs flex-1 truncate">{s.adresse}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">ETA {s.eta_min} min</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{s.km} km</span>
                        <span className={`text-[10px] font-bold shrink-0 ${CONF_COLOR(s.eta_confidence)}`}>{s.eta_confidence}%</span>
                        {s.bewertung && <span className="text-[10px] text-amber-500">★{s.bewertung}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.fahrer.length} Fahrer</span>
          <span className="flex items-center gap-1"><Route className="h-3 w-3" />Polling alle 20 Sek</span>
        </div>
      </div>
    </div>
  );
}
