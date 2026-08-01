'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Target, Clock, Users, BarChart3, Euro, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis, AreaChart, Area, ReferenceLine } from 'recharts';

// Phase 5468 — Statistiken-Dashboard V48
// Neu: Echtzeit-Umsatz-Velocity-AreaChart (letzte 15 Min);
// Storno-Trend-LineChart mit Alarmgrenze;
// Fahrer-Belastungs-Ampel (Heatmap-Balken);
// Spitzenzeit-Countdown; Ø-Warte-Zeit-Monitor;
// 12-KPI-Grid 4-spaltig inkl. Velocity/Storno-Trend/Warte-Zeit/Peak-Countdown;
// 7-Tab-Nav Überblick/Velocity/Storno/Fahrer/Zonen/Bilanz/Peak;
// 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'velocity' | 'storno' | 'fahrer' | 'zonen' | 'bilanz' | 'peak';

interface VelocityPoint { min: number; label: string; umsatz: number; bestellungen: number; }
interface StornoPoint   { h: string; rate: number; }
interface FahrerLoad    { id: string; name: string; load_pct: number; stopps: number; umsatz: number; tier: 'voll' | 'mittel' | 'frei'; }
interface ZoneRow       { zone: string; umsatz: number; marge_pct: number; avg_min: number; }

interface ApiData {
  umsatz_heute: number;
  delta_pct: number;
  bestellungen: number;
  lieferzeit_avg: number;
  pktl_pct: number;
  aktive_fahrer: number;
  bewertung: number;
  storno_rate: number;
  velocity_eur_min: number;
  storno_trend: number;
  warte_min: number;
  peak_in_min: number;
  velocity: VelocityPoint[];
  storno_verlauf: StornoPoint[];
  fahrer: FahrerLoad[];
  zonen: ZoneRow[];
}

function mkVelocity(): VelocityPoint[] {
  return Array.from({ length: 15 }, (_, i) => ({
    min: i,
    label: `${-14 + i}m`,
    umsatz: Math.round(20 + Math.random() * 60),
    bestellungen: Math.round(1 + Math.random() * 3),
  }));
}
function mkStorno(): StornoPoint[] {
  const HRS = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
  return HRS.map(h => ({ h, rate: parseFloat((1 + Math.random() * 6).toFixed(1)) }));
}

const MOCK: ApiData = {
  umsatz_heute: 2134,
  delta_pct: 8.7,
  bestellungen: 91,
  lieferzeit_avg: 22,
  pktl_pct: 91,
  aktive_fahrer: 6,
  bewertung: 4.8,
  storno_rate: 2.8,
  velocity_eur_min: 43.2,
  storno_trend: -0.4,
  warte_min: 2.1,
  peak_in_min: 34,
  velocity: mkVelocity(),
  storno_verlauf: mkStorno(),
  fahrer: [
    { id: 'f1', name: 'Marek',  load_pct: 95, stopps: 8, umsatz: 487, tier: 'voll'  },
    { id: 'f2', name: 'Luisa',  load_pct: 72, stopps: 6, umsatz: 362, tier: 'mittel'},
    { id: 'f3', name: 'Tariq',  load_pct: 60, stopps: 5, umsatz: 298, tier: 'mittel'},
    { id: 'f4', name: 'Sophie', load_pct: 45, stopps: 3, umsatz: 210, tier: 'frei'  },
    { id: 'f5', name: 'Jonas',  load_pct: 30, stopps: 2, umsatz: 145, tier: 'frei'  },
    { id: 'f6', name: 'Rana',   load_pct: 88, stopps: 7, umsatz: 415, tier: 'voll'  },
  ],
  zonen: [
    { zone: 'Innenstadt',  umsatz: 1040, marge_pct: 35, avg_min: 20 },
    { zone: 'Nordviertel', umsatz: 620,  marge_pct: 30, avg_min: 26 },
    { zone: 'Westpark',    umsatz: 474,  marge_pct: 27, avg_min: 24 },
  ],
};

const TIER_COLOR: Record<'voll' | 'mittel' | 'frei', string> = { voll: 'bg-red-400', mittel: 'bg-amber-400', frei: 'bg-emerald-400' };
const TIER_TEXT: Record<'voll' | 'mittel' | 'frei', string>  = { voll: 'text-red-600', mittel: 'text-amber-600', frei: 'text-emerald-600' };

export function LieferdienstPhase5468StatistikenDashboardV48() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/lieferdienst?view=stats_v48');
        if (r.ok) { const j = await r.json(); if (!cancelled) setData(j); }
      } catch { /* keep mock */ }
    };
    poll();
    const iv = setInterval(poll, 45_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick', label: 'Überblick' },
    { key: 'velocity',   label: 'Velocity'  },
    { key: 'storno',     label: 'Storno'    },
    { key: 'fahrer',     label: 'Fahrer'    },
    { key: 'zonen',      label: 'Zonen'     },
    { key: 'bilanz',     label: 'Bilanz'    },
    { key: 'peak',       label: 'Peak'      },
  ];

  const kpis = [
    { label: 'Umsatz',       value: `€${data.umsatz_heute.toLocaleString('de-DE')}`, color: 'text-teal-600', ok: true },
    { label: 'Δ%',           value: `${data.delta_pct > 0 ? '+' : ''}${data.delta_pct}%`, color: data.delta_pct >= 0 ? 'text-emerald-600' : 'text-red-500', ok: data.delta_pct >= 0 },
    { label: 'Bestellungen', value: data.bestellungen, color: 'text-indigo-600', ok: true },
    { label: 'Lieferzeit',   value: `${data.lieferzeit_avg}m`, color: data.lieferzeit_avg <= 25 ? 'text-emerald-600' : 'text-amber-500', ok: data.lieferzeit_avg <= 25 },
    { label: 'Pünktlichkeit',value: `${data.pktl_pct}%`, color: data.pktl_pct >= 85 ? 'text-emerald-600' : 'text-amber-500', ok: data.pktl_pct >= 85 },
    { label: 'Fahrer',       value: data.aktive_fahrer, color: 'text-blue-600', ok: true },
    { label: 'Bewertung',    value: `★${data.bewertung.toFixed(1)}`, color: 'text-yellow-600', ok: data.bewertung >= 4.5 },
    { label: 'Storno',       value: `${data.storno_rate}%`, color: data.storno_rate <= 5 ? 'text-emerald-600' : 'text-red-500', ok: data.storno_rate <= 5 },
    { label: 'Velocity',     value: `€${data.velocity_eur_min.toFixed(0)}/m`, color: 'text-violet-600', ok: true },
    { label: 'Storno-Trend', value: `${data.storno_trend > 0 ? '+' : ''}${data.storno_trend}%`, color: data.storno_trend <= 0 ? 'text-emerald-600' : 'text-red-500', ok: data.storno_trend <= 0 },
    { label: 'Wartezeit',    value: `${data.warte_min.toFixed(1)}m`, color: data.warte_min <= 3 ? 'text-emerald-600' : 'text-amber-500', ok: data.warte_min <= 3 },
    { label: 'Peak in',      value: `${data.peak_in_min}m`, color: 'text-orange-500', ok: true },
  ];

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-500" />
          <span className="text-sm font-bold text-gray-800">Statistiken V48</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold">VELOCITY+STORNO+PEAK</span>
        </div>
        <div className="flex items-center gap-2">
          {data.storno_trend > 1 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="h-2.5 w-2.5" />Storno steigt
            </span>
          )}
          <span className="text-xs font-black text-teal-600">€{data.umsatz_heute.toLocaleString('de-DE')}</span>
        </div>
      </div>

      {/* 12-KPI-Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-lg px-1.5 py-1 text-center ${k.ok ? 'bg-gray-50' : 'bg-red-50'}`}>
            <div className={`text-xs font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[8px] text-gray-400 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-1 px-2 text-xs font-bold whitespace-nowrap border-b-2 flex-shrink-0 transition ${tab === t.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Überblick */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Velocity/min', value: `€${data.velocity_eur_min.toFixed(0)}`, icon: <Zap className="h-3 w-3 text-violet-400" />, color: 'text-violet-600' },
            { label: 'Wartezeit Ø',  value: `${data.warte_min.toFixed(1)}m`,         icon: <Clock className="h-3 w-3 text-amber-400" />, color: 'text-amber-600' },
            { label: 'Pünktlichkeit',value: `${data.pktl_pct}%`,                      icon: <Target className="h-3 w-3 text-emerald-400" />, color: 'text-emerald-600' },
            { label: 'Nächster Peak',value: `${data.peak_in_min}m`,                   icon: <TrendingUp className="h-3 w-3 text-orange-400" />, color: 'text-orange-600' },
          ].map(k => (
            <div key={k.label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex items-center gap-2">
              {k.icon}
              <div>
                <div className={`text-sm font-black tabular-nums ${k.color}`}>{k.value}</div>
                <div className="text-[10px] text-gray-500">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Velocity */}
      {tab === 'velocity' && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Umsatz letzte 15 Minuten (€/min)</div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.velocity} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={4} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => `€${v}`} />
                <Area type="monotone" dataKey="umsatz" stroke="#14b8a6" fill="#ccfbf1" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-center text-teal-600 font-bold">Ø €{data.velocity_eur_min.toFixed(1)}/min</div>
        </div>
      )}

      {/* Storno */}
      {tab === 'storno' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Storno-Rate Tagesverlauf</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${data.storno_trend <= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              Trend: {data.storno_trend > 0 ? '+' : ''}{data.storno_trend}%
            </span>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.storno_verlauf} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <XAxis dataKey="h" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={false} />
                {/* Alarmgrenze 5% */}
                <ReferenceLine y={5} stroke="#fca5a5" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[9px] text-gray-400 text-center">Rote Linie = Alarmgrenze 5%</div>
        </div>
      )}

      {/* Fahrer-Belastung */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5">
          <div className="text-xs text-gray-500">Fahrer-Belastung (Heatmap)</div>
          {data.fahrer.map(f => (
            <div key={f.id} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-700">{f.name}</span>
                  <span className={`text-[9px] font-bold ${TIER_TEXT[f.tier]}`}>{f.tier}</span>
                </div>
                <span className="text-gray-500 tabular-nums">{f.stopps} Stopps · €{f.umsatz}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full rounded-full ${TIER_COLOR[f.tier]}`} style={{ width: `${f.load_pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {data.zonen.map((z, i) => (
            <div key={z.zone} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">{i + 1}. {z.zone}</span>
                <span className="text-sm font-black text-teal-600 tabular-nums">€{z.umsatz}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 mt-0.5">
                <span>Marge: <strong className={z.marge_pct >= 30 ? 'text-emerald-600' : 'text-amber-500'}>{z.marge_pct}%</strong></span>
                <span>Ø {z.avg_min} min</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-teal-400 rounded-full" style={{ width: `${(z.umsatz / data.umsatz_heute) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bilanz */}
      {tab === 'bilanz' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Einnahmen', value: `€${data.umsatz_heute.toLocaleString('de-DE')}`, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Kosten',    value: `€${Math.round(data.umsatz_heute * 0.65).toLocaleString('de-DE')}`, color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Gewinn',    value: `€${Math.round(data.umsatz_heute * 0.35).toLocaleString('de-DE')}`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(k => (
            <div key={k.label} className={`rounded-lg ${k.bg} border border-gray-100 px-2 py-3 text-center`}>
              <div className={`text-lg font-black tabular-nums ${k.color}`}>{k.value}</div>
              <div className="text-[9px] text-gray-500">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Peak */}
      {tab === 'peak' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-center">
            <div className="text-xs text-orange-700 font-bold">Nächster Spitzenzeitraum</div>
            <div className="text-4xl font-black text-orange-500 tabular-nums">{data.peak_in_min}m</div>
            <div className="text-[10px] text-orange-400 mt-0.5">Empfehlung: +1 Fahrer einplanen</div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-teal-500 shrink-0" />
            <div className="text-xs text-gray-600">
              Bei aktuellem Bestelleingang ({data.bestellungen} heute) wird die Spitzenlastzone voraussichtlich die Kapazität
              der {data.aktive_fahrer} aktiven Fahrer ausreizen.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
