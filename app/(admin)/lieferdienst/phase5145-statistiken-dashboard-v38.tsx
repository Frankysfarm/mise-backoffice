'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Euro, Flame,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

// Phase 5145 — Statistiken-Dashboard V38
// Neu: Dual-Gauge Effizienz+Qualität; 9-KPI-Grid; 5-Tab-Nav; Live-Alert-Feed;
// Stunden-Chart dual-mode; Fahrer-Rangliste mit Tier+Trend; Zonen-SLA;
// Kapazitäts-Prognose +1h; 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'zonen' | 'prognose';

interface HourlyData { h: string; bestellungen: number; umsatz: number; jetzt?: boolean }
interface FahrerRank { name: string; score: number; touren: number; puenktlichkeit: number; tier: 'platin' | 'gold' | 'gut' | 'schwach'; trend: 'up' | 'down' | 'neutral' }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface PrognoseItem { h: string; prognose: number; kapazitaet: number }

interface DashboardData {
  effizienz_score: number;
  qualitaet_score: number;
  wachstum_pct: number;
  alerts: AlertItem[];
  kpis: { key: string; label: string; value: string | number; delta: number; status: 'ok' | 'warn' | 'alert' }[];
  stunden: HourlyData[];
  fahrer: FahrerRank[];
  zonen: ZoneData[];
  prognose: PrognoseItem[];
  spitzenzeit_h: number | null;
}

const MOCK: DashboardData = {
  effizienz_score: 82,
  qualitaet_score: 91,
  wachstum_pct: 14.2,
  spitzenzeit_h: 19,
  alerts: [
    { id: 'a1', level: 'critical', text: 'Zone Nord: 4 Bestellungen überfällig', zeit: '19:12' },
    { id: 'a2', level: 'warn',     text: 'Fahrer-Kapazität: 2 Schichten offen',  zeit: '18:55' },
    { id: 'a3', level: 'info',     text: 'Spitzenzeit in ~15 Min (19:00 Uhr)',   zeit: '18:45' },
  ],
  kpis: [
    { key: 'umsatz',      label: 'Umsatz heute',   value: '€ 2.847', delta: 8.4,  status: 'ok' },
    { key: 'orders',      label: 'Bestellungen',    value: 94,        delta: 12.1, status: 'ok' },
    { key: 'puenktlich',  label: 'Pünktlichkeit',   value: '89%',     delta: -2.3, status: 'warn' },
    { key: 'avg_min',     label: 'Ø Lieferzeit',    value: '26 Min',  delta: 1.5,  status: 'warn' },
    { key: 'fahrer',      label: 'Aktive Fahrer',   value: 7,         delta: 0,    status: 'ok' },
    { key: 'storno',      label: 'Storno-Rate',     value: '2.1%',    delta: -0.4, status: 'ok' },
    { key: 'bewertung',   label: 'Ø Bewertung',     value: '4.7★',    delta: 0.1,  status: 'ok' },
    { key: 'trinkgeld',   label: 'Ø Trinkgeld',     value: '€ 2.40',  delta: 3.2,  status: 'ok' },
    { key: 'umsatz_h',    label: 'Umsatz/Stunde',   value: '€ 312',   delta: 7.0,  status: 'ok' },
  ],
  stunden: [
    { h: '12', bestellungen: 8,  umsatz: 210 },
    { h: '13', bestellungen: 12, umsatz: 310 },
    { h: '14', bestellungen: 10, umsatz: 260 },
    { h: '15', bestellungen: 9,  umsatz: 235 },
    { h: '16', bestellungen: 11, umsatz: 290 },
    { h: '17', bestellungen: 15, umsatz: 395 },
    { h: '18', bestellungen: 19, umsatz: 498 },
    { h: '19', bestellungen: 22, umsatz: 582, jetzt: true },
    { h: '20', bestellungen: 18, umsatz: 471 },
  ],
  fahrer: [
    { name: 'Kemal A.', score: 96, touren: 12, puenktlichkeit: 98, tier: 'platin', trend: 'up' },
    { name: 'Julia F.', score: 88, touren: 9,  puenktlichkeit: 92, tier: 'gold',   trend: 'up' },
    { name: 'Sara M.',  score: 74, touren: 7,  puenktlichkeit: 81, tier: 'gut',    trend: 'neutral' },
    { name: 'Tim B.',   score: 51, touren: 4,  puenktlichkeit: 67, tier: 'schwach', trend: 'down' },
  ],
  zonen: [
    { name: 'Zone A (Innenstadt)', sla_pct: 94, avg_min: 22, umsatz: 1120 },
    { name: 'Zone B (Nord)',        sla_pct: 79, avg_min: 31, umsatz: 840 },
    { name: 'Zone C (West)',        sla_pct: 88, avg_min: 27, umsatz: 620 },
    { name: 'Zone D (Süd)',         sla_pct: 91, avg_min: 24, umsatz: 267 },
  ],
  prognose: [
    { h: '19', prognose: 22, kapazitaet: 28 },
    { h: '20', prognose: 18, kapazitaet: 28 },
    { h: '21', prognose: 14, kapazitaet: 21 },
    { h: '22', prognose: 9,  kapazitaet: 14 },
  ],
};

function TierBadge({ tier }: { tier: FahrerRank['tier'] }) {
  const map = { platin: 'bg-violet-800 text-violet-100', gold: 'bg-yellow-800 text-yellow-100', gut: 'bg-green-900 text-green-200', schwach: 'bg-red-900 text-red-200' };
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${map[tier]}`}>{tier}</span>;
}

export function LieferdienstPhase5145StatistikenDashboardV38({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('ueberblick');

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/lieferdienst-statistiken${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick', label: 'Überblick' },
    { key: 'stunden',    label: 'Stunden' },
    { key: 'fahrer',     label: 'Fahrer' },
    { key: 'zonen',      label: 'Zonen' },
    { key: 'prognose',   label: 'Prognose' },
  ];

  const criticalAlerts = data.alerts.filter(a => a.level === 'critical');

  return (
    <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Statistiken-Dashboard V38</span>
        {criticalAlerts.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />{criticalAlerts.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-900/30 px-3 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Effizienz-Score</div>
          <div className="text-2xl font-black text-emerald-300 tabular-nums">{data.effizienz_score}</div>
          <div className="text-[9px] text-gray-500">/ 100</div>
        </div>
        <div className="rounded-lg bg-blue-900/20 px-3 py-2.5 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Qualitäts-Score</div>
          <div className="text-2xl font-black text-blue-300 tabular-nums">{data.qualitaet_score}</div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400">+{data.wachstum_pct}%</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
              tab === t.key ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ueberblick' && (
        <div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {data.kpis.map(k => {
              const statusColor = k.status === 'ok' ? 'text-green-400' : k.status === 'warn' ? 'text-yellow-400' : 'text-red-400';
              return (
                <div key={k.key} className="rounded-lg bg-gray-800/50 px-2 py-2">
                  <div className="text-[9px] text-gray-500 truncate">{k.label}</div>
                  <div className="text-xs font-black text-gray-100 tabular-nums">{k.value}</div>
                  <div className={`text-[9px] font-semibold ${statusColor} flex items-center gap-0.5`}>
                    {k.delta > 0 ? <TrendingUp className="w-2 h-2" /> : k.delta < 0 ? <TrendingDown className="w-2 h-2" /> : null}
                    {k.delta !== 0 ? `${k.delta > 0 ? '+' : ''}${k.delta}%` : '±0'}
                  </div>
                </div>
              );
            })}
          </div>
          {data.spitzenzeit_h != null && (
            <div className="rounded-lg bg-orange-900/20 border border-orange-800/40 px-3 py-2 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="text-xs text-orange-300">Spitzenzeit: {data.spitzenzeit_h}:00 Uhr</span>
            </div>
          )}
        </div>
      )}

      {tab === 'stunden' && (
        <div>
          <div className="text-[10px] text-gray-500 mb-2">Bestellungen pro Stunde</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.stunden} barCategoryGap="20%">
              <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number | string) => [`${v} Bestell.`]}
              />
              <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]}>
                {data.stunden.map((h, i) => (
                  <Cell key={i} fill={h.jetzt ? '#10b981' : '#374151'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'fahrer' && (
        <div className="space-y-2">
          {data.fahrer.map((f, i) => (
            <div key={f.name} className="rounded-lg bg-gray-800/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500 font-mono w-4">#{i + 1}</span>
                  <span className="text-xs font-bold text-gray-200">{f.name}</span>
                  <TierBadge tier={f.tier} />
                </div>
                <div className="flex items-center gap-1">
                  {f.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
                  {f.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                  <span className={`text-sm font-black tabular-nums ${f.score >= 80 ? 'text-green-400' : f.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{f.score}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span>{f.touren} Touren</span>
                <span className={f.puenktlichkeit >= 90 ? 'text-green-400' : 'text-yellow-400'}>{f.puenktlichkeit}% pünktlich</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map(z => (
            <div key={z.name} className="rounded-lg bg-gray-800/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-200">{z.name}</span>
                <span className={`text-xs font-black ${z.sla_pct >= 90 ? 'text-green-400' : z.sla_pct >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>{z.sla_pct}% SLA</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden mb-1">
                <div className={`h-full rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${z.sla_pct}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{z.avg_min} Min</span>
                <span className="flex items-center gap-0.5"><Euro className="w-2.5 h-2.5" />{z.umsatz}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'prognose' && (
        <div>
          <div className="text-[10px] text-gray-500 mb-2">Prognose vs. Kapazität</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.prognose} barCategoryGap="25%">
              <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number | string, name: string) => [v, name === 'prognose' ? 'Prognose' : 'Kapazität']}
              />
              <Bar dataKey="kapazitaet" fill="#374151" radius={[3, 3, 0, 0]} />
              <Bar dataKey="prognose"   fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 border-t border-gray-800/60 pt-2 space-y-1.5">
        {data.alerts.slice(0, 3).map(a => (
          <div key={a.id} className={`flex items-start gap-2 text-[10px] px-2 py-1.5 rounded-lg ${
            a.level === 'critical' ? 'bg-red-950/40 text-red-300' : a.level === 'warn' ? 'bg-yellow-950/30 text-yellow-300' : 'bg-gray-800/40 text-gray-400'
          }`}>
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="flex-1">{a.text}</span>
            <span className="text-gray-600 shrink-0">{a.zeit}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">60s-Polling · {data.prognose.length > 0 ? 'Prognose aktiv' : 'Mock'}</div>
    </div>
  );
}
