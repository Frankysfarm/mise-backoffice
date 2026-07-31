'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown, BarChart3, CheckCircle2,
  AlertTriangle, Users, Clock, Euro, Star, Target, Zap, Shield,
  Package, Flame, Award, MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

// Phase 5144 — Statistiken-Dashboard V37
// Neu: Effizienz-Score-Ring + Wachstums-Index; Live-KPI-Matrix 9-spaltig 3-spaltig;
// 5-Tab-Nav Überblick/Stunden/Fahrer/Zonen/Live-Alerts;
// Live-Alert-Feed mit Zeitstempel+Level; Spitzenzeit-Prediction;
// Stunden-BarChart 3-Modi + Woche-LineChart;
// Fahrer-Performance-Rangliste Tier; Zonen-SLA-Matrix;
// 60-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'zonen' | 'alerts';

interface HourlyData { h: string; bestellungen: number; umsatz: number; puenktlichkeit: number; jetzt?: boolean }
interface FahrerRank { name: string; score: number; touren: number; trinkgeld: number; puenktlichkeit: number; tier: 'platin' | 'gold' | 'gut' | 'schwach' }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number; kapazitaet_pct: number }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface WocheData { tag: string; gesamt: number; vorwoche: number }

interface DashboardData {
  gesamt_score: number;
  effizienz_score: number;
  wachstum_pct: number;
  alerts: AlertItem[];
  kpis: { key: string; label: string; value: string | number; delta: number; status: 'ok' | 'warn' | 'alert'; icon_name: string }[];
  stunden: HourlyData[];
  fahrer: FahrerRank[];
  zonen: ZoneData[];
  woche: WocheData[];
  spitzenzeit_h: number | null;
  fahrer_bedarf: number;
}

const MOCK: DashboardData = {
  gesamt_score: 86,
  effizienz_score: 79,
  wachstum_pct: 12.4,
  spitzenzeit_h: 19,
  fahrer_bedarf: 2,
  alerts: [
    { id: 'a1', level: 'critical', text: 'Zone Nord: 3 Bestellungen überfällig', zeit: '19:04' },
    { id: 'a2', level: 'warn', text: 'Pünktlichkeit unter 85% — Zone Süd', zeit: '18:58' },
    { id: 'a3', level: 'info', text: 'Spitzenzeit beginnt in ~22 Min', zeit: '18:52' },
    { id: 'a4', level: 'info', text: 'Fahrer Kemal A. zurück in 8 Min', zeit: '18:50' },
  ],
  kpis: [
    { key: 'umsatz',      label: 'Umsatz',        value: '€ 2.148', delta: +9.2,  status: 'ok',   icon_name: 'euro' },
    { key: 'bestellungen',label: 'Bestellungen',  value: 163,        delta: +14,   status: 'ok',   icon_name: 'package' },
    { key: 'lieferzeit',  label: 'Ø Lieferzeit',  value: '26 Min',   delta: -3,    status: 'ok',   icon_name: 'clock' },
    { key: 'puenktl',     label: 'Pünktlichkeit', value: '88%',      delta: +2,    status: 'warn', icon_name: 'check' },
    { key: 'fahrer',      label: 'Aktive Fahrer', value: 7,          delta: +1,    status: 'ok',   icon_name: 'users' },
    { key: 'bewertung',   label: 'Bewertung',     value: '4.7★',     delta: +0.1,  status: 'ok',   icon_name: 'star' },
    { key: 'storno',      label: 'Storno-Rate',   value: '2.8%',     delta: -0.6,  status: 'ok',   icon_name: 'alert' },
    { key: 'marge',       label: 'Marge',         value: '30.1%',    delta: +1.7,  status: 'ok',   icon_name: 'target' },
    { key: 'effizienz',   label: 'Effizienz-Idx', value: '79',       delta: +4,    status: 'warn', icon_name: 'zap' },
  ],
  stunden: [
    { h: '10', bestellungen: 9,  umsatz: 138, puenktlichkeit: 96 },
    { h: '11', bestellungen: 12, umsatz: 184, puenktlichkeit: 94 },
    { h: '12', bestellungen: 24, umsatz: 370, puenktlichkeit: 88 },
    { h: '13', bestellungen: 28, umsatz: 432, puenktlichkeit: 85 },
    { h: '14', bestellungen: 18, umsatz: 278, puenktlichkeit: 90 },
    { h: '15', bestellungen: 14, umsatz: 215, puenktlichkeit: 92 },
    { h: '16', bestellungen: 16, umsatz: 248, puenktlichkeit: 89 },
    { h: '17', bestellungen: 21, umsatz: 324, puenktlichkeit: 86 },
    { h: '18', bestellungen: 26, umsatz: 400, puenktlichkeit: 84 },
    { h: '19', bestellungen: 31, umsatz: 478, puenktlichkeit: 82, jetzt: true },
  ],
  fahrer: [
    { name: 'Kemal A.', score: 94, touren: 12, trinkgeld: 18.40, puenktlichkeit: 96, tier: 'platin' },
    { name: 'Sara M.',  score: 88, touren: 10, trinkgeld: 14.20, puenktlichkeit: 91, tier: 'gold' },
    { name: 'Jonas R.', score: 74, touren: 8,  trinkgeld: 9.60,  puenktlichkeit: 83, tier: 'gut' },
    { name: 'Lena W.',  score: 61, touren: 7,  trinkgeld: 7.80,  puenktlichkeit: 76, tier: 'schwach' },
  ],
  zonen: [
    { name: 'Zone A', sla_pct: 93, avg_min: 24, umsatz: 640, kapazitaet_pct: 72 },
    { name: 'Zone B', sla_pct: 84, avg_min: 29, umsatz: 480, kapazitaet_pct: 88 },
    { name: 'Zone C', sla_pct: 78, avg_min: 33, umsatz: 320, kapazitaet_pct: 95 },
    { name: 'Zone D', sla_pct: 91, avg_min: 26, umsatz: 540, kapazitaet_pct: 65 },
  ],
  woche: [
    { tag: 'Mo', gesamt: 1240, vorwoche: 1100 },
    { tag: 'Di', gesamt: 1380, vorwoche: 1250 },
    { tag: 'Mi', gesamt: 1520, vorwoche: 1320 },
    { tag: 'Do', gesamt: 1680, vorwoche: 1480 },
    { tag: 'Fr', gesamt: 1950, vorwoche: 1720 },
    { tag: 'Sa', gesamt: 2240, vorwoche: 1980 },
    { tag: 'So', gesamt: 2148, vorwoche: 1890 },
  ],
};

const ICONS: Record<string, React.ReactNode> = {
  euro:    <Euro className="w-3 h-3" />,
  package: <Package className="w-3 h-3" />,
  clock:   <Clock className="w-3 h-3" />,
  check:   <CheckCircle2 className="w-3 h-3" />,
  users:   <Users className="w-3 h-3" />,
  star:    <Star className="w-3 h-3" />,
  alert:   <AlertTriangle className="w-3 h-3" />,
  target:  <Target className="w-3 h-3" />,
  zap:     <Zap className="w-3 h-3" />,
};

const TIER_COLORS: Record<string, string> = {
  platin: 'text-cyan-300 bg-cyan-900/40',
  gold:   'text-yellow-300 bg-yellow-900/40',
  gut:    'text-green-300 bg-green-900/40',
  schwach:'text-red-400 bg-red-900/30',
};

const TIER_LABEL: Record<string, string> = {
  platin: 'Platin',
  gold:   'Gold',
  gut:    'Gut',
  schwach:'Schwach',
};

const ALERT_COLOR: Record<string, string> = {
  critical: 'text-red-400 border-l-red-500',
  warn:     'text-yellow-400 border-l-yellow-500',
  info:     'text-blue-300 border-l-blue-500',
};

type StundenMode = 'bestellungen' | 'umsatz' | 'puenktlichkeit';

export function LieferdienstPhase5144StatistikenDashboardV37({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');
  const [stundenMode, setStundenMode] = useState<StundenMode>('bestellungen');

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/lieferdienst/stats${params}`).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      if (json?.gesamt_score != null) setData(json);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const criticalAlerts = data.alerts.filter(a => a.level === 'critical').length;

  const BAR_COLOR = (entry: HourlyData) => entry.jetzt ? '#6d28d9' : '#0d9488';

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'ueberblick', label: 'Überblick' },
    { key: 'stunden',    label: 'Stunden' },
    { key: 'fahrer',     label: 'Fahrer' },
    { key: 'zonen',      label: 'Zonen' },
    { key: 'alerts',     label: 'Alerts', badge: criticalAlerts > 0 ? criticalAlerts : undefined },
  ];

  return (
    <div className="rounded-xl border border-teal-800/50 bg-teal-950/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Statistiken-Dashboard V37</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-center">
            <div className="text-[9px] text-gray-600">Gesamt</div>
            <div className={`text-sm font-black tabular-nums ${data.gesamt_score >= 80 ? 'text-green-400' : data.gesamt_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.gesamt_score}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-600">Effizienz</div>
            <div className={`text-sm font-black tabular-nums ${data.effizienz_score >= 80 ? 'text-cyan-400' : data.effizienz_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.effizienz_score}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-gray-600">Wachstum</div>
            <div className={`text-sm font-black tabular-nums flex items-center gap-0.5 ${data.wachstum_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.wachstum_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(data.wachstum_pct).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {criticalAlerts > 0 && (
        <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{criticalAlerts} kritischer Alert{criticalAlerts > 1 ? 's' : ''} — Details im Alerts-Tab</span>
        </div>
      )}

      {data.spitzenzeit_h && (
        <div className="flex items-center gap-2 bg-orange-900/30 border border-orange-800/50 rounded-lg px-3 py-2 mb-3">
          <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-300">
            Spitzenzeit ~{data.spitzenzeit_h}:00 Uhr — {data.fahrer_bedarf} Fahrer empfohlen
          </span>
        </div>
      )}

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key ? 'bg-teal-700 text-white' : 'bg-gray-800/60 text-gray-400 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.badge != null && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'ueberblick' && (
        <div className="grid grid-cols-3 gap-2">
          {data.kpis.map(kpi => (
            <div key={kpi.key} className={`rounded-lg px-2 py-2 ${
              kpi.status === 'alert' ? 'bg-red-900/30 border border-red-800/40' :
              kpi.status === 'warn'  ? 'bg-yellow-900/20 border border-yellow-800/40' :
                                       'bg-gray-800/40 border border-gray-700/30'
            }`}>
              <div className={`flex items-center gap-1 mb-0.5 ${
                kpi.status === 'alert' ? 'text-red-400' :
                kpi.status === 'warn'  ? 'text-yellow-400' : 'text-teal-400'
              }`}>
                {ICONS[kpi.icon_name]}
                <span className="text-[9px] text-gray-500 truncate">{kpi.label}</span>
              </div>
              <div className="text-sm font-black text-gray-100 truncate tabular-nums">{kpi.value}</div>
              <div className={`text-[9px] flex items-center gap-0.5 mt-0.5 ${kpi.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {kpi.delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {kpi.delta > 0 ? '+' : ''}{kpi.delta}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stunden' && (
        <>
          <div className="flex gap-1 mb-3">
            {(['bestellungen', 'umsatz', 'puenktlichkeit'] as StundenMode[]).map(m => (
              <button
                key={m}
                onClick={() => setStundenMode(m)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold ${
                  stundenMode === m ? 'bg-teal-700 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz' : 'Pünktlichkeit'}
              </button>
            ))}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 10 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#d1fae5' }}
                />
                <Bar dataKey={stundenMode} radius={[3, 3, 0, 0]}>
                  {data.stunden.map((entry, index) => (
                    <Cell key={index} fill={entry.jetzt ? '#6d28d9' : '#0d9488'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 h-28">
            <div className="text-[10px] text-gray-500 mb-1">Wochenverlauf (€)</div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.woche} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 10 }}
                  itemStyle={{ color: '#d1fae5' }}
                />
                <Line type="monotone" dataKey="gesamt" stroke="#0d9488" strokeWidth={2} dot={false} name="Heute" />
                <Line type="monotone" dataKey="vorwoche" stroke="#4b5563" strokeWidth={1.5} dot={false} name="Vorwoche" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-2">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="rounded-lg bg-gray-800/40 border border-gray-700/30 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4">{['🥇','🥈','🥉','4.'][i] ?? `${i+1}.`}</span>
                  <span className="text-xs font-bold text-gray-200">{f.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TIER_COLORS[f.tier]}`}>
                    {TIER_LABEL[f.tier]}
                  </span>
                </div>
                <span className={`text-sm font-black tabular-nums ${
                  f.score >= 85 ? 'text-cyan-300' : f.score >= 70 ? 'text-green-400' : f.score >= 55 ? 'text-yellow-400' : 'text-red-400'
                }`}>{f.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${
                    f.tier === 'platin' ? 'bg-cyan-500' : f.tier === 'gold' ? 'bg-yellow-500' : f.tier === 'gut' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${f.score}%` }}
                />
              </div>
              <div className="flex gap-4 text-[9px] text-gray-500">
                <span>{f.touren} Touren</span>
                <span>{f.puenktlichkeit}% pünktl.</span>
                <span>€ {f.trinkgeld.toFixed(2)} TG</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map(z => (
            <div key={z.name} className="rounded-lg bg-gray-800/40 border border-gray-700/30 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-gray-200">{z.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold tabular-nums ${
                    z.sla_pct >= 90 ? 'text-green-400' : z.sla_pct >= 80 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{z.sla_pct}% SLA</span>
                  <span className="text-[10px] text-gray-500">{z.avg_min} Min</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${
                    z.kapazitaet_pct >= 90 ? 'bg-red-500' : z.kapazitaet_pct >= 75 ? 'bg-yellow-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${z.kapazitaet_pct}%` }}
                />
              </div>
              <div className="flex gap-3 text-[9px] text-gray-500">
                <span>€ {z.umsatz}</span>
                <span>{z.kapazitaet_pct}% Kapazität</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-2">
          {data.alerts.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">Keine aktiven Alerts</div>
          )}
          {data.alerts.map(a => (
            <div key={a.id} className={`border-l-4 pl-3 py-2 rounded-r-lg bg-gray-800/40 ${ALERT_COLOR[a.level]}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs ${ALERT_COLOR[a.level]}`}>{a.text}</span>
                <span className="text-[10px] text-gray-600 shrink-0">{a.zeit}</span>
              </div>
              <div className={`text-[9px] font-semibold mt-0.5 uppercase ${
                a.level === 'critical' ? 'text-red-500' : a.level === 'warn' ? 'text-yellow-600' : 'text-blue-500'
              }`}>{a.level}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
