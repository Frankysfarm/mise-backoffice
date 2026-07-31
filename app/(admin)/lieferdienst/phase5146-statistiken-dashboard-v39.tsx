'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Clock,
  Euro, Users, AlertTriangle, CheckCircle2, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell } from 'recharts';

// Phase 5146 — Statistiken-Dashboard V39
// Neu: Schicht-Pünktlichkeit-Score-Karte; Rentabilitäts-Trend-Chart;
// Fahrer-Pünktlichkeits-KPI; Alert-Ampel-Kacheln; 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'rentabilitaet' | 'fahrer' | 'zonen' | 'puenktlichkeit';

interface KpiItem { key: string; label: string; value: string | number; delta: number; status: 'ok' | 'warn' | 'alert' }
interface PuenktRow { name: string; pct: number; ampel: 'gruen' | 'gelb' | 'rot' }
interface RentItem { h: string; ertrag: number; kosten: number }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number }

interface DashboardData {
  gesamt_effizienz: number;
  puenktlichkeit_score: number;
  umsatz_heute: number;
  alerts: AlertItem[];
  kpis: KpiItem[];
  rentabilitaet: RentItem[];
  fahrer_puenktlichkeit: PuenktRow[];
  zonen: ZoneData[];
}

const MOCK: DashboardData = {
  gesamt_effizienz: 84,
  puenktlichkeit_score: 88,
  umsatz_heute: 3120,
  alerts: [
    { id: 'a1', level: 'warn',     text: '3 Fahrer unter 75% Pünktlichkeit',     zeit: '19:30' },
    { id: 'a2', level: 'info',     text: 'Spitzenzeit 19–21 Uhr — hohe Last',    zeit: '19:00' },
    { id: 'a3', level: 'critical', text: 'Zone Süd: SLA 68% — unter Ziel',       zeit: '18:45' },
  ],
  kpis: [
    { key: 'umsatz',     label: 'Umsatz heute',     value: '€ 3.120', delta: 11.2, status: 'ok' },
    { key: 'orders',     label: 'Bestellungen',      value: 102,        delta: 9.4,  status: 'ok' },
    { key: 'puenktl',   label: 'Schicht-Pünktl.',   value: '88%',      delta: 3.1,  status: 'ok' },
    { key: 'avg_min',   label: 'Ø Lieferzeit',       value: '24 Min',   delta: -1.8, status: 'ok' },
    { key: 'fahrer',    label: 'Aktive Fahrer',       value: 8,          delta: 1,    status: 'ok' },
    { key: 'storno',    label: 'Storno-Rate',          value: '1.8%',    delta: -0.3, status: 'ok' },
    { key: 'ertrag',    label: 'Ø Ertrag/Bestellung', value: '€ 18.40', delta: 2.1,  status: 'ok' },
    { key: 'trinkgeld', label: 'Ø Trinkgeld',          value: '€ 2.60',  delta: 4.5,  status: 'ok' },
    { key: 'sla',       label: 'SLA-Einhaltung',       value: '91%',     delta: -1.2, status: 'warn' },
  ],
  rentabilitaet: [
    { h: '12', ertrag: 180, kosten: 95 },
    { h: '13', ertrag: 260, kosten: 120 },
    { h: '14', ertrag: 210, kosten: 105 },
    { h: '15', ertrag: 195, kosten: 100 },
    { h: '16', ertrag: 230, kosten: 115 },
    { h: '17', ertrag: 310, kosten: 140 },
    { h: '18', ertrag: 420, kosten: 175 },
    { h: '19', ertrag: 510, kosten: 200 },
    { h: '20', ertrag: 480, kosten: 185 },
    { h: '21', ertrag: 325, kosten: 155 },
  ],
  fahrer_puenktlichkeit: [
    { name: 'Julia F.', pct: 97, ampel: 'gruen' },
    { name: 'Kemal A.', pct: 92, ampel: 'gruen' },
    { name: 'Sara M.',  pct: 79, ampel: 'gelb'  },
    { name: 'Tim B.',   pct: 61, ampel: 'rot'   },
    { name: 'Lia K.',   pct: 85, ampel: 'gruen' },
  ],
  zonen: [
    { name: 'Nord',  sla_pct: 94, avg_min: 22, umsatz: 980 },
    { name: 'Mitte', sla_pct: 91, avg_min: 24, umsatz: 1250 },
    { name: 'Süd',   sla_pct: 68, avg_min: 31, umsatz: 590 },
    { name: 'Ost',   sla_pct: 88, avg_min: 26, umsatz: 300 },
  ],
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'ueberblick',    label: 'Überblick'   },
  { key: 'rentabilitaet', label: 'Rentabilität' },
  { key: 'fahrer',        label: 'Fahrer'       },
  { key: 'zonen',         label: 'Zonen'        },
  { key: 'puenktlichkeit',label: 'Pünktlichkeit'},
];

function statusColor(s: string) {
  if (s === 'ok')    return 'text-green-400';
  if (s === 'warn')  return 'text-yellow-400';
  return 'text-red-400';
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb')  return 'bg-yellow-500';
  return 'bg-red-500';
}

export function LieferdienstPhase5146StatistikenDashboardV39({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashboardData>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.kpis?.length) setData(prev => ({ ...prev, ...json }));
      }
    } catch { /* use mock */ }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/30 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-emerald-800/40 bg-emerald-900/20 flex items-center gap-3">
        <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Statistiken-Dashboard V39</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-center">
            <div className="text-[10px] text-gray-500">Effizienz</div>
            <div className={`text-sm font-black tabular-nums ${data.gesamt_effizienz >= 85 ? 'text-green-400' : data.gesamt_effizienz >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.gesamt_effizienz}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-gray-500">Pünktl.</div>
            <div className={`text-sm font-black tabular-nums ${data.puenktlichkeit_score >= 90 ? 'text-green-400' : data.puenktlichkeit_score >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.puenktlichkeit_score}%
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="px-4 pt-3 space-y-1">
          {data.alerts.slice(0, 2).map(a => (
            <div key={a.id} className={`flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs ${
              a.level === 'critical' ? 'bg-red-900/30 text-red-300' :
              a.level === 'warn'     ? 'bg-yellow-900/30 text-yellow-300' :
                                       'bg-blue-900/20 text-blue-300'
            }`}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{a.text}</span>
              <span className="ml-auto text-gray-500 tabular-nums">{a.zeit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto px-4 pt-3 gap-1 scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Überblick */}
        {tab === 'ueberblick' && (
          <div className="grid grid-cols-3 gap-2">
            {data.kpis.map(k => (
              <div key={k.key} className="rounded-lg bg-gray-800/50 px-2 py-2">
                <div className="text-[10px] text-gray-500 truncate">{k.label}</div>
                <div className={`text-sm font-bold tabular-nums ${statusColor(k.status)}`}>{k.value}</div>
                <div className={`text-[10px] tabular-nums ${k.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {k.delta >= 0 ? '+' : ''}{k.delta.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rentabilität */}
        {tab === 'rentabilitaet' && (
          <div>
            <div className="text-xs text-gray-400 mb-2">Ertrag vs. Kosten nach Stunde (€)</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data.rentabilitaet} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number, name: string) => [`€ ${v}`, name === 'ertrag' ? 'Ertrag' : 'Kosten']}
                />
                <Bar dataKey="ertrag" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="kosten" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Ertrag</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Kosten</span>
            </div>
          </div>
        )}

        {/* Fahrer */}
        {tab === 'fahrer' && (
          <div className="space-y-2">
            {data.fahrer_puenktlichkeit.map(f => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-20 truncate">{f.name}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div className={`h-full rounded-full ${ampelBg(f.ampel)}`} style={{ width: `${f.pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{f.pct}%</span>
                {f.ampel === 'rot' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                {f.ampel === 'gruen' && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
              </div>
            ))}
            <div className="mt-2 text-[10px] text-gray-500 border-t border-gray-700/40 pt-2">
              Schicht-Pünktlichkeit — ≥90% Grün · ≥75% Gelb · &lt;75% Rot
            </div>
          </div>
        )}

        {/* Zonen */}
        {tab === 'zonen' && (
          <div className="space-y-2">
            {data.zonen.map(z => (
              <div key={z.name} className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-2">
                <span className="text-xs font-semibold text-gray-300 w-12">{z.name}</span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>SLA {z.sla_pct}%</span>
                    <span>Ø {z.avg_min} Min</span>
                    <span className="text-emerald-400">€ {z.umsatz}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${z.sla_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pünktlichkeit */}
        {tab === 'puenktlichkeit' && (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
                <div className="text-[10px] text-gray-500">Schicht-Pünktlichkeit</div>
                <div className={`text-2xl font-black tabular-nums ${data.puenktlichkeit_score >= 90 ? 'text-green-400' : data.puenktlichkeit_score >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.puenktlichkeit_score}%
                </div>
              </div>
              <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
                <div className="text-[10px] text-gray-500">Gesamt-Effizienz</div>
                <div className={`text-2xl font-black tabular-nums ${data.gesamt_effizienz >= 85 ? 'text-green-400' : data.gesamt_effizienz >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.gesamt_effizienz}%
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {data.fahrer_puenktlichkeit.map(f => (
                <div key={f.name} className={`rounded-lg px-3 py-2 border ${
                  f.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
                  f.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                                        'border-red-800/40 bg-red-900/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-200">{f.name}</span>
                    <span className={`text-sm font-bold tabular-nums ${f.ampel === 'gruen' ? 'text-green-400' : f.ampel === 'gelb' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {f.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div className={`h-full rounded-full ${ampelBg(f.ampel)}`} style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 text-[10px] text-gray-600 border-t border-gray-700/30 pt-2">
        Phase 5146 · Dashboard V39 · Statistiken + Schicht-Pünktlichkeit · 60s-Polling
      </div>
    </div>
  );
}
