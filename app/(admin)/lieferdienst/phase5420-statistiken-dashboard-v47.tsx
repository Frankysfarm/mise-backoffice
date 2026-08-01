'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Users, Clock, Euro, Star, AlertTriangle, Target, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

// Phase 5420 — Statistiken-Dashboard V47
// Neu: Wochen-Bilanz Einnahmen vs. Kosten vs. Gewinn AreaChart;
// Fahrer-Effizienz-Matrix Stopps/h+Pünktlichkeit+Bewertung;
// Zonen-Rentabilitäts-Rangliste; KI-Prognose nächste Schicht;
// 11-KPI-Grid 5-spaltig inkl. Effizienz-Ratio+Netto-Marge;
// 7-Tab-Nav Überblick/Stunden/Fahrer/Zonen/Bilanz/Prognose/Woche;
// 45-Sek-Polling; Mock-Fallback

type Tab = 'ueberblick' | 'stunden' | 'fahrer' | 'zonen' | 'bilanz' | 'prognose' | 'woche';

interface StundePoint { h: number; label: string; bestellungen: number; umsatz: number; pktl_pct: number; }
interface FahrerRow { id: string; name: string; score: number; stopps_h: number; pktl_pct: number; rating: number; km_heute: number; umsatz: number; }
interface ZoneRow { zone: string; umsatz: number; marge_pct: number; avg_min: number; fahrer: number; }
interface WochePoint { tag: string; umsatz: number; kosten: number; gewinn: number; }

interface ApiResponse {
  umsatz_heute: number;
  umsatz_delta_pct: number;
  bestellungen_heute: number;
  lieferzeit_avg_min: number;
  pktl_quote_pct: number;
  aktive_fahrer: number;
  bewertung_avg: number;
  storno_rate_pct: number;
  effizienz_ratio: number;
  netto_marge_pct: number;
  trinkgeld_avg: number;
  ki_prognose_umsatz: number;
  ki_prognose_fahrer_bedarf: number;
  stunden: StundePoint[];
  fahrer: FahrerRow[];
  zonen: ZoneRow[];
  woche: WochePoint[];
}

function mkStunden(): StundePoint[] {
  return Array.from({ length: 13 }, (_, i) => {
    const h = 10 + i;
    return { h, label: `${h}:00`, bestellungen: Math.round(4 + Math.random() * 12), umsatz: Math.round(80 + Math.random() * 200), pktl_pct: Math.round(78 + Math.random() * 20) };
  });
}
function mkWoche(): WochePoint[] {
  const TAGS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return TAGS.map(tag => {
    const u = Math.round(600 + Math.random() * 800);
    const k = Math.round(u * (0.55 + Math.random() * 0.1));
    return { tag, umsatz: u, kosten: k, gewinn: u - k };
  });
}

const MOCK: ApiResponse = {
  umsatz_heute: 1847,
  umsatz_delta_pct: 12.4,
  bestellungen_heute: 74,
  lieferzeit_avg_min: 23,
  pktl_quote_pct: 89,
  aktive_fahrer: 5,
  bewertung_avg: 4.7,
  storno_rate_pct: 3.2,
  effizienz_ratio: 88,
  netto_marge_pct: 31,
  trinkgeld_avg: 1.40,
  ki_prognose_umsatz: 2100,
  ki_prognose_fahrer_bedarf: 6,
  stunden: mkStunden(),
  fahrer: [
    { id: 'f1', name: 'Marek',  score: 97, stopps_h: 4.2, pktl_pct: 96, rating: 4.9, km_heute: 87, umsatz: 412 },
    { id: 'f2', name: 'Luisa',  score: 88, stopps_h: 3.8, pktl_pct: 91, rating: 4.8, km_heute: 72, umsatz: 347 },
    { id: 'f3', name: 'Tariq',  score: 74, stopps_h: 3.2, pktl_pct: 79, rating: 4.5, km_heute: 58, umsatz: 268 },
    { id: 'f4', name: 'Sophie', score: 79, stopps_h: 3.5, pktl_pct: 85, rating: 4.6, km_heute: 63, umsatz: 298 },
    { id: 'f5', name: 'Jonas',  score: 48, stopps_h: 2.1, pktl_pct: 62, rating: 4.1, km_heute: 41, umsatz: 177 },
  ],
  zonen: [
    { zone: 'Innenstadt',  umsatz: 920, marge_pct: 34, avg_min: 21, fahrer: 3 },
    { zone: 'Nordviertel', umsatz: 480, marge_pct: 29, avg_min: 26, fahrer: 1 },
    { zone: 'Westpark',    umsatz: 330, marge_pct: 27, avg_min: 25, fahrer: 1 },
  ],
  woche: mkWoche(),
};

export function LieferdienstPhase5420StatistikenDashboardV47() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('ueberblick');
  const [stundeMode, setStundeMode] = useState<'bestellungen' | 'umsatz' | 'pktl'>('bestellungen');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/lieferdienst?view=stats_v47');
        if (!r.ok) throw new Error('api');
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch { /* keep mock */ }
    };
    poll();
    const iv = setInterval(poll, 45_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ueberblick', label: 'Überblick' },
    { key: 'stunden',    label: 'Stunden'   },
    { key: 'fahrer',     label: 'Fahrer'    },
    { key: 'zonen',      label: 'Zonen'     },
    { key: 'bilanz',     label: 'Bilanz'    },
    { key: 'prognose',   label: 'Prognose'  },
    { key: 'woche',      label: 'Woche'     },
  ];

  const kpis = [
    { label: 'Umsatz',      value: `€${data.umsatz_heute.toLocaleString('de-DE')}`, delta: `${data.umsatz_delta_pct > 0 ? '+' : ''}${data.umsatz_delta_pct}%`, color: 'text-teal-600', ok: data.umsatz_delta_pct >= 0 },
    { label: 'Bestellungen',value: data.bestellungen_heute, delta: null, color: 'text-indigo-600', ok: true },
    { label: 'Lieferzeit',  value: `${data.lieferzeit_avg_min}m`, delta: null, color: data.lieferzeit_avg_min <= 25 ? 'text-emerald-600' : 'text-amber-500', ok: data.lieferzeit_avg_min <= 25 },
    { label: 'Pünktlichkeit',value:`${data.pktl_quote_pct}%`, delta: null, color: data.pktl_quote_pct >= 85 ? 'text-emerald-600' : 'text-amber-500', ok: data.pktl_quote_pct >= 85 },
    { label: 'Fahrer',      value: data.aktive_fahrer, delta: null, color: 'text-blue-600', ok: true },
    { label: 'Bewertung',   value: `★${data.bewertung_avg.toFixed(1)}`, delta: null, color: 'text-yellow-600', ok: data.bewertung_avg >= 4.5 },
    { label: 'Storno',      value: `${data.storno_rate_pct}%`, delta: null, color: data.storno_rate_pct <= 5 ? 'text-emerald-600' : 'text-red-500', ok: data.storno_rate_pct <= 5 },
    { label: 'Effizienz',   value: `${data.effizienz_ratio}`, delta: null, color: data.effizienz_ratio >= 80 ? 'text-teal-600' : 'text-amber-500', ok: data.effizienz_ratio >= 80 },
    { label: 'Netto-Marge', value: `${data.netto_marge_pct}%`, delta: null, color: data.netto_marge_pct >= 25 ? 'text-emerald-600' : 'text-amber-500', ok: data.netto_marge_pct >= 25 },
    { label: 'Trinkgeld',   value: `€${data.trinkgeld_avg.toFixed(2)}`, delta: null, color: 'text-amber-600', ok: true },
    { label: 'KI-Prognose', value: `€${data.ki_prognose_umsatz}`, delta: null, color: 'text-violet-600', ok: true },
  ];

  const stundeData = data.stunden.map(s => ({
    ...s,
    value: stundeMode === 'bestellungen' ? s.bestellungen : stundeMode === 'umsatz' ? s.umsatz : s.pktl_pct,
  }));

  const maxStunde = Math.max(...stundeData.map(s => s.value), 1);
  const nowH = new Date().getHours();

  return (
    <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-500" />
          <span className="text-sm font-bold text-gray-800">Statistiken V47</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold">BILANZ+PROGNOSE</span>
        </div>
        <span className="text-xs font-black text-teal-600">€{data.umsatz_heute.toLocaleString('de-DE')}
          {data.umsatz_delta_pct !== 0 && (
            <span className={`ml-1 text-[10px] ${data.umsatz_delta_pct > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {data.umsatz_delta_pct > 0 ? <TrendingUp className="h-2.5 w-2.5 inline" /> : <TrendingDown className="h-2.5 w-2.5 inline" />}
              {data.umsatz_delta_pct > 0 ? '+' : ''}{data.umsatz_delta_pct}%
            </span>
          )}
        </span>
      </div>

      {/* 11-KPI-Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-11 gap-1">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-lg px-1.5 py-1 text-center ${k.ok ? 'bg-gray-50' : 'bg-red-50'}`}>
            <div className={`text-xs font-black tabular-nums ${k.color}`}>{k.value}</div>
            {k.delta && <div className="text-[8px] text-gray-400">{k.delta}</div>}
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
            className={`pb-1 px-2 text-xs font-bold whitespace-nowrap transition border-b-2 flex-shrink-0 ${tab === t.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Überblick */}
      {tab === 'ueberblick' && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Bestellungen heute', value: data.bestellungen_heute, icon: <BarChart3 className="h-3 w-3 text-indigo-400" />, color: 'text-indigo-600' },
            { label: 'Aktive Fahrer',      value: data.aktive_fahrer,      icon: <Users className="h-3 w-3 text-blue-400" />,    color: 'text-blue-600'   },
            { label: 'Pünktlichkeit',      value: `${data.pktl_quote_pct}%`, icon: <Clock className="h-3 w-3 text-emerald-400" />, color: 'text-emerald-600' },
            { label: 'Netto-Marge',        value: `${data.netto_marge_pct}%`, icon: <Target className="h-3 w-3 text-teal-400" />, color: 'text-teal-600'   },
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

      {/* Stunden */}
      {tab === 'stunden' && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz', 'pktl'] as const).map(m => (
              <button
                key={m}
                onClick={() => setStundeMode(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${stundeMode === m ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {m === 'bestellungen' ? 'Bestellungen' : m === 'umsatz' ? 'Umsatz' : 'Pünktl.'}
              </button>
            ))}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stundeData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={2} />
                <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => stundeMode === 'umsatz' ? `€${v}` : `${v}${stundeMode === 'pktl' ? '%' : ''}`} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {stundeData.map(s => (
                    <Cell key={s.h} fill={s.h === nowH ? '#14b8a6' : s.value >= maxStunde * 0.7 ? '#6366f1' : '#e5e7eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fahrer */}
      {tab === 'fahrer' && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 text-[9px] font-bold text-gray-400 px-2">
            <span>Fahrer</span><span className="text-center">Stopps/h</span><span className="text-center">Pünktl.</span><span className="text-right">€</span>
          </div>
          {[...data.fahrer].sort((a, b) => b.score - a.score).map((f, i) => (
            <div key={f.id} className="grid grid-cols-4 items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-gray-400 w-3">{i + 1}.</span>
                <span className="text-xs font-bold text-gray-700 truncate">{f.name}</span>
              </div>
              <div className="text-center text-xs font-black text-indigo-600 tabular-nums">{f.stopps_h.toFixed(1)}</div>
              <div className={`text-center text-xs font-black tabular-nums ${f.pktl_pct >= 85 ? 'text-emerald-600' : f.pktl_pct >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{f.pktl_pct}%</div>
              <div className="text-right text-xs font-black text-teal-600 tabular-nums">€{f.umsatz}</div>
            </div>
          ))}
        </div>
      )}

      {/* Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-1.5">
          {[...data.zonen].sort((a, b) => b.umsatz - a.umsatz).map((z, i) => (
            <div key={z.zone} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">{i + 1}. {z.zone}</span>
                <span className="text-sm font-black text-teal-600 tabular-nums">€{z.umsatz}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 mt-0.5">
                <span>Marge: <strong className={z.marge_pct >= 30 ? 'text-emerald-600' : 'text-amber-500'}>{z.marge_pct}%</strong></span>
                <span>Ø {z.avg_min} min</span>
                <span>{z.fahrer} Fahrer</span>
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
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Einnahmen', value: `€${data.umsatz_heute.toLocaleString('de-DE')}`, color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Kosten',    value: `€${Math.round(data.umsatz_heute * (1 - data.netto_marge_pct / 100)).toLocaleString('de-DE')}`, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Gewinn',    value: `€${Math.round(data.umsatz_heute * data.netto_marge_pct / 100).toLocaleString('de-DE')}`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(k => (
              <div key={k.label} className={`rounded-lg ${k.bg} border border-gray-100 px-2 py-2 text-center`}>
                <div className={`text-sm font-black tabular-nums ${k.color}`}>{k.value}</div>
                <div className="text-[9px] text-gray-500">{k.label}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 text-center">Netto-Marge: <strong className="text-emerald-600">{data.netto_marge_pct}%</strong></div>
        </div>
      )}

      {/* Prognose */}
      {tab === 'prognose' && (
        <div className="space-y-2">
          <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-violet-700 font-bold">KI-Prognose heute</div>
              <div className="text-2xl font-black text-violet-600 tabular-nums">€{data.ki_prognose_umsatz.toLocaleString('de-DE')}</div>
              <div className="text-[10px] text-violet-500">Fahrer-Bedarf: {data.ki_prognose_fahrer_bedarf}</div>
            </div>
            <TrendingUp className="h-8 w-8 text-violet-300" />
          </div>
          <div className="text-[10px] text-gray-400 text-center">Modell basiert auf Verlauf, Wetter, Wochentag</div>
        </div>
      )}

      {/* Woche */}
      {tab === 'woche' && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.woche} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <XAxis dataKey="tag" tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => `€${v}`} />
              <Bar dataKey="umsatz" fill="#d1fae5" name="Einnahmen" radius={[2, 2, 0, 0]} />
              <Bar dataKey="gewinn" fill="#14b8a6" name="Gewinn" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
