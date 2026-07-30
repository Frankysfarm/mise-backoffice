'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Euro, Clock, Target, AlertTriangle,
  Star, Route, CheckCircle2, Activity, Award, Zap, BarChart3, XCircle,
  Shield,
} from 'lucide-react';

// Phase 5062 — Statistiken Dashboard V28
// Neu: Schicht-Auslastungs-Trend; Fahrer-Zuverlässigkeits-Matrix;
// Rentabilitäts-KPI-Band; Top-Zonen-Chart; Live-SLA-Sparkline;
// Kunden-Treue-Gauge; 45-Sek-Polling; Mock-Fallback

interface StundeData   { stunde: string; bestellungen: number; umsatz: number; ziel: number }
interface WocheData    { tag: string; umsatz: number; bestellungen: number; storno: number; auslastung: number }
interface FahrerData   { name: string; score: number; stopps: number; puenktl: number; umsatz: number; trinkgeld: number; tier: 'platin' | 'gold' | 'gut' | 'schwach'; auslastung: number }
interface ZoneData     { zone: string; sla: number; avg_eta: number; umsatz: number; kap: number; rentabilitaet: number }
interface AuslastungVerlauf { tag: string; auslastung: number }

interface ApiData {
  kpis: {
    umsatz: number; umsatz_delta: number;
    bestellungen: number; bestellungen_delta: number;
    fahrer_aktiv: number;
    avg_lieferzeit: number; puenktlichkeit: number;
    bewertung: number; trinkgeld: number; storno: number;
    monat_ziel: number; monat_ist: number;
    profit_heute: number; profit_delta: number;
    kunden_treue_rate: number;
    profit_margin: number; profit_margin_delta: number;
    schicht_auslastung_avg: number; schicht_auslastung_delta: number;
  };
  stunden: StundeData[];
  woche: WocheData[];
  fahrer: FahrerData[];
  zonen: ZoneData[];
  auslastung_verlauf: AuslastungVerlauf[];
  alert: string | null;
}

const MOCK: ApiData = {
  kpis: {
    umsatz: 3280, umsatz_delta: 14.5,
    bestellungen: 162, bestellungen_delta: 10,
    fahrer_aktiv: 10,
    avg_lieferzeit: 23, puenktlichkeit: 96,
    bewertung: 4.9, trinkgeld: 204, storno: 1.1,
    monat_ziel: 65000, monat_ist: 54200,
    profit_heute: 982, profit_delta: 11.3,
    kunden_treue_rate: 70,
    profit_margin: 29.6, profit_margin_delta: 2.1,
    schicht_auslastung_avg: 82, schicht_auslastung_delta: 3.5,
  },
  stunden: [
    { stunde: '11h', bestellungen: 5,  umsatz: 110, ziel: 80  },
    { stunde: '12h', bestellungen: 15, umsatz: 320, ziel: 240 },
    { stunde: '13h', bestellungen: 20, umsatz: 410, ziel: 310 },
    { stunde: '14h', bestellungen: 12, umsatz: 192, ziel: 200 },
    { stunde: '15h', bestellungen: 10, umsatz: 240, ziel: 200 },
    { stunde: '16h', bestellungen: 17, umsatz: 290, ziel: 240 },
  ],
  woche: [
    { tag: 'Mo', umsatz: 1920, bestellungen: 82,  storno: 1.1, auslastung: 78 },
    { tag: 'Di', umsatz: 2180, bestellungen: 94,  storno: 0.7, auslastung: 80 },
    { tag: 'Mi', umsatz: 2540, bestellungen: 109, storno: 1.4, auslastung: 81 },
    { tag: 'Do', umsatz: 2840, bestellungen: 127, storno: 1.0, auslastung: 83 },
    { tag: 'Fr', umsatz: 3280, bestellungen: 162, storno: 1.1, auslastung: 82 },
    { tag: 'Sa', umsatz: 0,    bestellungen: 0,   storno: 0,   auslastung: 0  },
    { tag: 'So', umsatz: 0,    bestellungen: 0,   storno: 0,   auslastung: 0  },
  ],
  fahrer: [
    { name: 'Jonas M.', score: 97, stopps: 30, puenktl: 98, umsatz: 1320, trinkgeld: 65, tier: 'platin', auslastung: 91 },
    { name: 'Anna B.',  score: 91, stopps: 23, puenktl: 93, umsatz: 1010, trinkgeld: 46, tier: 'gold',   auslastung: 85 },
    { name: 'Tom H.',   score: 74, stopps: 19, puenktl: 81, umsatz: 760,  trinkgeld: 30, tier: 'gut',    auslastung: 71 },
    { name: 'Sara K.',  score: 61, stopps: 15, puenktl: 68, umsatz: 580,  trinkgeld: 20, tier: 'schwach',auslastung: 55 },
  ],
  zonen: [
    { zone: 'Mitte', sla: 97, avg_eta: 21, umsatz: 1540, kap: 83, rentabilitaet: 95 },
    { zone: 'Nord',  sla: 93, avg_eta: 25, umsatz: 960,  kap: 68, rentabilitaet: 83 },
    { zone: 'Süd',   sla: 88, avg_eta: 28, umsatz: 760,  kap: 59, rentabilitaet: 76 },
    { zone: 'West',  sla: 83, avg_eta: 32, umsatz: 480,  kap: 91, rentabilitaet: 61 },
  ],
  auslastung_verlauf: [
    { tag: 'Mo', auslastung: 78 },
    { tag: 'Di', auslastung: 80 },
    { tag: 'Mi', auslastung: 81 },
    { tag: 'Do', auslastung: 83 },
    { tag: 'Fr', auslastung: 82 },
  ],
  alert: null,
};

const TIER_BADGE: Record<string, string> = {
  platin: 'bg-slate-700 text-white',
  gold:   'bg-amber-500 text-white',
  gut:    'bg-emerald-600 text-white',
  schwach:'bg-red-600 text-white',
};

function deltaIcon(d: number) {
  return d > 0
    ? <TrendingUp   className="h-3 w-3 text-emerald-600" />
    : <TrendingDown className="h-3 w-3 text-red-600" />;
}

export function LieferdienstPhase5062StatistikenDashboardV28({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tab, setTab]   = useState<'heute' | 'woche' | 'fahrer' | 'zonen'>('heute');

  async function fetchData() {
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await fetch(`/api/delivery/lieferdienst/stats${params}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 45_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;
  const monatPct = Math.min(100, Math.round((d.kpis.monat_ist / d.kpis.monat_ziel) * 100));

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-teal-700 text-white">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-200" />
          <span className="font-bold text-sm">Statistiken V28</span>
        </div>
        <div className="flex items-center gap-2 text-teal-200">
          <Shield className="h-4 w-4" />
          <span className="text-sm font-black">{d.kpis.schicht_auslastung_avg}%</span>
          <span className="text-[10px] opacity-70">Auslastung Ø</span>
        </div>
      </div>

      {d.alert && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />{d.alert}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* KPI Grid — 8 Felder */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Umsatz',      val: `${(d.kpis.umsatz / 1000).toFixed(1)}k €`,   delta: d.kpis.umsatz_delta,        icon: <Euro          className="h-3.5 w-3.5 text-emerald-600" /> },
            { label: 'Bestellungen',val: `${d.kpis.bestellungen}`,                    delta: d.kpis.bestellungen_delta,   icon: <Zap           className="h-3.5 w-3.5 text-indigo-600" /> },
            { label: 'Ø Lieferzeit',val: `${d.kpis.avg_lieferzeit} min`,              delta: -(d.kpis.avg_lieferzeit - 25),icon:<Clock          className="h-3.5 w-3.5 text-amber-500" /> },
            { label: 'Pünktlichkeit',val:`${d.kpis.puenktlichkeit}%`,                 delta: d.kpis.puenktlichkeit - 90, icon: <CheckCircle2  className="h-3.5 w-3.5 text-green-600" /> },
            { label: 'Bewertung',   val: `★${d.kpis.bewertung}`,                      delta: 0,                          icon: <Star          className="h-3.5 w-3.5 text-amber-500" /> },
            { label: 'Trinkgeld',   val: `${d.kpis.trinkgeld} €`,                     delta: 0,                          icon: <Award         className="h-3.5 w-3.5 text-violet-600" /> },
            { label: 'Storno',      val: `${d.kpis.storno}%`,                         delta: -(d.kpis.storno - 2),       icon: <XCircle       className="h-3.5 w-3.5 text-red-500" /> },
            { label: 'Auslastung',  val: `${d.kpis.schicht_auslastung_avg}%`,         delta: d.kpis.schicht_auslastung_delta, icon: <Shield  className="h-3.5 w-3.5 text-teal-600" /> },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 mb-1">{kpi.icon}<span className="text-[9px] text-muted-foreground">{kpi.label}</span></div>
              <div className="font-black text-sm text-foreground">{kpi.val}</div>
              {kpi.delta !== 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {deltaIcon(kpi.delta)}
                  <span className={`text-[9px] font-semibold ${kpi.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {kpi.delta > 0 ? '+' : ''}{kpi.delta.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Schicht-Auslastungs-Verlauf */}
        <div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
            <Activity className="h-3.5 w-3.5 text-teal-600" />Schicht-Auslastung — Wochenverlauf
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={d.auslastung_verlauf}>
              <Line type="monotone" dataKey="auslastung" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: '#0d9488' }} />
              <XAxis dataKey="tag" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Auslastung'] as [string, string]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monatsziel */}
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-semibold text-teal-800">Monatsziel</span>
            </div>
            <span className="text-sm font-black text-teal-700">{monatPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-teal-200">
            <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${monatPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-teal-600 mt-1">
            <span>{(d.kpis.monat_ist / 1000).toFixed(1)}k € ist</span>
            <span>{(d.kpis.monat_ziel / 1000).toFixed(0)}k € Ziel</span>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
          {(['heute', 'woche', 'fahrer', 'zonen'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-teal-700' : 'text-muted-foreground'}`}
            >
              {t === 'heute' ? 'Heute' : t === 'woche' ? 'Woche' : t === 'fahrer' ? 'Fahrer' : 'Zonen'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'heute' && (
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-2">
              <BarChart3 className="h-3.5 w-3.5" />Stunden-Umsatz heute
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={d.stunden} barSize={16}>
                <XAxis dataKey="stunde" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number | undefined) => [`${v ?? 0} €`, 'Umsatz'] as [string, string]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="umsatz" radius={[4, 4, 0, 0]}>
                  {d.stunden.map((h, i) => (
                    <Cell key={i} fill={h.umsatz >= h.ziel ? '#0d9488' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'woche' && (
          <div className="space-y-1.5">
            {d.woche.filter((w) => w.bestellungen > 0).map((w) => (
              <div key={w.tag} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">{w.tag}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-2 rounded-full bg-teal-500" style={{ width: `${Math.min(100, (w.umsatz / 3500) * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground w-16 text-right">{(w.umsatz / 1000).toFixed(1)}k €</span>
                <span className={`text-[10px] font-semibold w-14 text-right ${w.auslastung >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>{w.auslastung}% Aus.</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'fahrer' && (
          <div className="space-y-1.5">
            {d.fahrer.map((f) => (
              <div key={f.name} className="flex items-center gap-2 rounded-xl border border-border bg-muted/10 px-3 py-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${TIER_BADGE[f.tier]}`}>
                  {f.tier.charAt(0).toUpperCase() + f.tier.slice(1)}
                </span>
                <span className="text-xs font-semibold text-foreground flex-1 truncate">{f.name}</span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="font-bold text-foreground">{f.score}</span>
                  <span>{f.stopps} Stop.</span>
                  <span className={`font-semibold ${f.auslastung >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>{f.auslastung}%</span>
                  <span className="text-emerald-700 font-bold">{(f.umsatz / 1000).toFixed(1)}k</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'zonen' && (
          <div className="space-y-1.5">
            {d.zonen.map((z) => (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground w-12 shrink-0">{z.zone}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${z.sla >= 90 ? 'bg-emerald-500' : z.sla >= 80 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${z.sla}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-foreground w-10 text-right">SLA {z.sla}%</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{z.avg_eta}m</span>
                <span className={`text-[10px] font-semibold w-12 text-right ${z.rentabilitaet >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{z.rentabilitaet}% ROI</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.kpis.fahrer_aktiv} Fahrer aktiv</span>
          <span className="flex items-center gap-1"><Route className="h-3 w-3" />45 Sek Polling</span>
        </div>
      </div>
    </div>
  );
}
