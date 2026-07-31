'use client';

import { useEffect, useState } from 'react';
import {
  Activity, TrendingUp, TrendingDown, Clock,
  Euro, Users, AlertTriangle, CheckCircle2, BarChart3,
  Bike, Thermometer, Target, Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis, Cell, AreaChart, Area } from 'recharts';

// Phase 5147 — Statistiken-Dashboard V40
// Neu: Fahrzeugtyp-Aufteilung; Wetter-Einfluss-Karte; Tageszeit-Vergleich;
// SLA-Ampel je Zone+Fahrz.; Score-Trend-Miniatur; 60s-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'fahrzeug' | 'wetter' | 'tageszeit' | 'zonen';

interface KpiItem { key: string; label: string; value: string | number; delta: number; status: 'ok' | 'warn' | 'alert' }
interface FahrzeugRow { typ: string; anzahl: number; avg_min: number; pct_pünktlich: number; umsatz: number }
interface WetterRow { stunde: string; temp: number; niederschlag_mm: number; avg_lieferzeit_min: number; sla_pct: number }
interface TageszeitRow { h: string; bestellungen: number; avg_min: number; fahrer: number; effizienz_pct: number }
interface ZoneData { name: string; sla_pct: number; avg_min: number; umsatz: number; fahrer: number }
interface AlertItem { id: string; level: 'info' | 'warn' | 'critical'; text: string; zeit: string }
interface ScoreTrend { h: string; score: number }

interface DashboardData {
  gesamt_effizienz: number;
  sla_score: number;
  umsatz_heute: number;
  alerts: AlertItem[];
  kpis: KpiItem[];
  fahrzeuge: FahrzeugRow[];
  wetter: WetterRow[];
  tageszeit: TageszeitRow[];
  zonen: ZoneData[];
  score_trend: ScoreTrend[];
}

const MOCK: DashboardData = {
  gesamt_effizienz: 86,
  sla_score: 91,
  umsatz_heute: 3480,
  alerts: [
    { id: 'a1', level: 'warn',     text: 'E-Bikes: Ø +4 Min bei Regen',        zeit: '19:45' },
    { id: 'a2', level: 'info',     text: 'Spitze 20–21 Uhr — 12 Bestellungen', zeit: '20:00' },
    { id: 'a3', level: 'critical', text: 'Zone Süd SLA 66% — unter Ziel',       zeit: '19:30' },
  ],
  kpis: [
    { key: 'umsatz',   label: 'Umsatz heute',      value: '€ 3.480', delta: 8.2,  status: 'ok'   },
    { key: 'orders',   label: 'Bestellungen',       value: 114,        delta: 12.1, status: 'ok'   },
    { key: 'sla',      label: 'SLA-Einhaltung',     value: '91%',      delta: -0.8, status: 'warn' },
    { key: 'avg_min',  label: 'Ø Lieferzeit',        value: '23 Min',   delta: -2.1, status: 'ok'   },
    { key: 'fahrer',   label: 'Aktive Fahrer',        value: 9,          delta: 1,    status: 'ok'   },
    { key: 'storno',   label: 'Storno-Rate',           value: '1.6%',    delta: -0.4, status: 'ok'   },
    { key: 'ertrag',   label: 'Ø Ertrag/Bestell.',    value: '€ 19.10', delta: 3.2,  status: 'ok'   },
    { key: 'trinkgeld',label: 'Ø Trinkgeld',           value: '€ 2.80',  delta: 5.1,  status: 'ok'   },
    { key: 'co2',      label: 'E-Bike-Anteil',         value: '64%',     delta: 4.0,  status: 'ok'   },
  ],
  fahrzeuge: [
    { typ: 'E-Bike',  anzahl: 5, avg_min: 22, pct_pünktlich: 93, umsatz: 2100 },
    { typ: 'Fahrrad', anzahl: 2, avg_min: 26, pct_pünktlich: 84, umsatz: 820  },
    { typ: 'Motorrad',anzahl: 1, avg_min: 19, pct_pünktlich: 97, umsatz: 560  },
    { typ: 'Auto',    anzahl: 1, avg_min: 28, pct_pünktlich: 78, umsatz: 0    },
  ],
  wetter: [
    { stunde: '16', temp: 18, niederschlag_mm: 0,   avg_lieferzeit_min: 21, sla_pct: 95 },
    { stunde: '17', temp: 17, niederschlag_mm: 0.2, avg_lieferzeit_min: 23, sla_pct: 93 },
    { stunde: '18', temp: 15, niederschlag_mm: 1.1, avg_lieferzeit_min: 27, sla_pct: 86 },
    { stunde: '19', temp: 14, niederschlag_mm: 2.3, avg_lieferzeit_min: 31, sla_pct: 78 },
    { stunde: '20', temp: 13, niederschlag_mm: 0.5, avg_lieferzeit_min: 25, sla_pct: 89 },
    { stunde: '21', temp: 12, niederschlag_mm: 0,   avg_lieferzeit_min: 22, sla_pct: 94 },
  ],
  tageszeit: [
    { h: '11', bestellungen: 8,  avg_min: 20, fahrer: 3, effizienz_pct: 95 },
    { h: '12', bestellungen: 18, avg_min: 22, fahrer: 5, effizienz_pct: 91 },
    { h: '13', bestellungen: 22, avg_min: 24, fahrer: 6, effizienz_pct: 88 },
    { h: '14', bestellungen: 14, avg_min: 21, fahrer: 5, effizienz_pct: 93 },
    { h: '15', bestellungen: 9,  avg_min: 20, fahrer: 4, effizienz_pct: 96 },
    { h: '16', bestellungen: 12, avg_min: 21, fahrer: 5, effizienz_pct: 94 },
    { h: '17', bestellungen: 19, avg_min: 23, fahrer: 6, effizienz_pct: 90 },
    { h: '18', bestellungen: 28, avg_min: 26, fahrer: 7, effizienz_pct: 85 },
    { h: '19', bestellungen: 32, avg_min: 28, fahrer: 9, effizienz_pct: 82 },
    { h: '20', bestellungen: 26, avg_min: 25, fahrer: 8, effizienz_pct: 87 },
    { h: '21', bestellungen: 18, avg_min: 22, fahrer: 7, effizienz_pct: 92 },
  ],
  zonen: [
    { name: 'Nord',  sla_pct: 95, avg_min: 21, umsatz: 1050, fahrer: 3 },
    { name: 'Mitte', sla_pct: 92, avg_min: 23, umsatz: 1380, fahrer: 3 },
    { name: 'Süd',   sla_pct: 66, avg_min: 33, umsatz: 620,  fahrer: 2 },
    { name: 'Ost',   sla_pct: 89, avg_min: 25, umsatz: 430,  fahrer: 1 },
  ],
  score_trend: [
    { h: '16', score: 88 },
    { h: '17', score: 86 },
    { h: '18', score: 81 },
    { h: '19', score: 78 },
    { h: '20', score: 83 },
    { h: '21', score: 86 },
  ],
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'ueberblick', label: 'Überblick'  },
  { key: 'fahrzeug',   label: 'Fahrzeuge'  },
  { key: 'wetter',     label: 'Wetter'     },
  { key: 'tageszeit',  label: 'Tageszeit'  },
  { key: 'zonen',      label: 'Zonen'      },
];

function DeltaBadge({ delta }: { delta: number }) {
  const pos = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-green-400' : 'text-red-400'}`}>
      {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pos ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'alert' }) {
  const c = status === 'ok' ? 'bg-green-500' : status === 'warn' ? 'bg-yellow-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${c} flex-shrink-0`} />;
}

function slaColor(pct: number): string {
  if (pct >= 90) return 'text-green-400';
  if (pct >= 78) return 'text-yellow-400';
  return 'text-red-400';
}

function slaBg(pct: number): string {
  if (pct >= 90) return 'bg-green-900/30 border-green-800/40';
  if (pct >= 78) return 'bg-yellow-900/30 border-yellow-800/40';
  return 'bg-red-900/30 border-red-800/40';
}

export function LieferdienstPhase5147StatistikenDashboardV40({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('ueberblick');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    params.set('v', '40');
    const res = await fetch(`/api/delivery/lieferdienst/statistiken?${params}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j);
      setError(false);
    } else {
      setData(MOCK);
      setError(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-2 text-gray-400 text-sm">
        <Activity size={14} className="animate-pulse" /> Statistiken laden…
      </div>
    );
  }

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 text-white text-sm space-y-3 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-400" />
          <span className="font-semibold text-white">Statistiken V40</span>
          {error && <span className="text-xs text-yellow-500 border border-yellow-700 rounded px-1">Mock</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>SLA <strong className={slaColor(d.sla_score)}>{d.sla_score}%</strong></span>
          <span>Effizienz <strong className="text-indigo-300">{d.gesamt_effizienz}%</strong></span>
        </div>
      </div>

      {/* Score-Trend-Mini */}
      <div className="px-4 h-10">
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={d.score_trend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={1.5} fill="url(#scoreFill)" dot={false} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }} formatter={(v: number) => [`${v}`, 'Score']} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Alerts */}
      {d.alerts.length > 0 && (
        <div className="px-4 space-y-1">
          {d.alerts.map(a => (
            <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${a.level === 'critical' ? 'bg-red-950/40 border-red-800/50' : a.level === 'warn' ? 'bg-yellow-950/30 border-yellow-800/40' : 'bg-blue-950/20 border-blue-800/30'}`}>
              <AlertTriangle size={12} className={a.level === 'critical' ? 'text-red-400' : a.level === 'warn' ? 'text-yellow-400' : 'text-blue-400'} />
              <span className="text-xs flex-1">{a.text}</span>
              <span className="text-xs text-gray-500">{a.zeit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 flex gap-1 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-4">
        {tab === 'ueberblick' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {d.kpis.map(k => (
              <div key={k.key} className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <StatusDot status={k.status} />
                  <span className="text-xs text-gray-400">{k.label}</span>
                </div>
                <p className="font-bold text-white text-base">{k.value}</p>
                <DeltaBadge delta={k.delta} />
              </div>
            ))}
          </div>
        )}

        {tab === 'fahrzeug' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Fahrzeugtypen — Ø Lieferzeit & SLA</p>
            {d.fahrzeuge.map(f => (
              <div key={f.typ} className={`rounded-lg border p-3 ${slaBg(f.pct_pünktlich)}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Bike size={14} className="text-indigo-400" />
                    <span className="font-medium text-white">{f.typ}</span>
                    <span className="text-xs text-gray-400">({f.anzahl}×)</span>
                  </div>
                  <span className={`text-xs font-semibold ${slaColor(f.pct_pünktlich)}`}>{f.pct_pünktlich}% pünktl.</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span><Clock size={10} className="inline mr-0.5" />{f.avg_min} Min</span>
                  <span><Euro size={10} className="inline mr-0.5" />€ {f.umsatz.toLocaleString('de')}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full transition-all ${f.pct_pünktlich >= 90 ? 'bg-green-500' : f.pct_pünktlich >= 78 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${f.pct_pünktlich}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'wetter' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Wetter-Einfluss auf Lieferzeit & SLA</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={d.wetter} margin={{ top: 2, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="stunde" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }} />
                <Bar dataKey="avg_lieferzeit_min" name="Ø Lieferzeit (Min)" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {d.wetter.map(w => (
                <div key={w.stunde} className="rounded-lg border border-gray-800 bg-gray-800/30 p-2 text-center">
                  <p className="text-xs text-gray-500">{w.stunde}:00</p>
                  <div className="flex items-center justify-center gap-1 my-0.5">
                    <Thermometer size={10} className="text-blue-400" />
                    <span className="text-xs text-blue-300">{w.temp}°</span>
                    {w.niederschlag_mm > 0 && <span className="text-xs text-cyan-400">🌧{w.niederschlag_mm}mm</span>}
                  </div>
                  <p className={`text-xs font-semibold ${slaColor(w.sla_pct)}`}>{w.sla_pct}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'tageszeit' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Stündliche Analyse — Bestellungen & Effizienz</p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={d.tageszeit} margin={{ top: 2, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }} />
                <Bar dataKey="bestellungen" name="Bestellungen" radius={[3, 3, 0, 0]}>
                  {d.tageszeit.map((row, i) => (
                    <Cell
                      key={i}
                      fill={row.effizienz_pct >= 90 ? '#22c55e' : row.effizienz_pct >= 82 ? '#eab308' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 text-xs text-gray-500">
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />≥ 90% Effizient</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />82–89%</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />&lt; 82%</span>
            </div>
          </div>
        )}

        {tab === 'zonen' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Zonen-Performance — SLA, Ø Zeit, Umsatz</p>
            {d.zonen.map(z => (
              <div key={z.name} className={`rounded-lg border p-3 ${slaBg(z.sla_pct)}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-indigo-400" />
                    <span className="font-medium text-white">Zone {z.name}</span>
                    <span className="text-xs text-gray-400">{z.fahrer} Fahrer</span>
                  </div>
                  <span className={`text-xs font-bold ${slaColor(z.sla_pct)}`}>SLA {z.sla_pct}%</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span><Clock size={10} className="inline mr-0.5" />{z.avg_min} Min Ø</span>
                  <span><Euro size={10} className="inline mr-0.5" />€ {z.umsatz.toLocaleString('de')}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full transition-all ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 78 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${z.sla_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
