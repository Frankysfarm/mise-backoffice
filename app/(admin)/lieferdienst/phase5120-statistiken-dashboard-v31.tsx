'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Award, Star, AlertCircle, Euro, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  label: string;
  wert: number | string;
  delta?: number;
  ziel?: number;
  einheit?: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Fahrer { name: string; score: number; touren: number; trinkgeld: number; puenktl: number; delta: number; }
interface ZoneRow { zone: string; sla: number; avg_min: number; umsatz: number; kapazitaet: number; }
interface StundeBar { stunde: string; wert: number; jetzt: boolean; }

interface DashData {
  gesamt_score: number;
  score_delta: number;
  ziel_score: number;
  kpis: KPI[];
  stunden: StundeBar[];
  wochen: { tag: string; heute: number; vw: number }[];
  fahrer: Fahrer[];
  zonen: ZoneRow[];
  alerts: string[];
}

const MOCK: DashData = {
  gesamt_score: 88,
  score_delta: +4,
  ziel_score: 92,
  alerts: ['Zone Nord: SLA unter 80%', '3 Fahrer offline'],
  kpis: [
    { label: 'Umsatz',      wert: '1.842 €', ampel: 'gruen', delta: +12, ziel: 2000 },
    { label: 'Bestellungen',wert: 47,         ampel: 'gruen', delta: +5,  ziel: 55 },
    { label: 'Lieferzeit',  wert: '24 min',   ampel: 'gelb',  delta: +2,  ziel: 22 },
    { label: 'Pünktlichkeit',wert: '82 %',    ampel: 'gelb',  delta: -3,  ziel: 90 },
    { label: 'Storno-Quote',wert: '3.2 %',    ampel: 'rot',   delta: +1,  ziel: 2 },
    { label: 'Bewertung',   wert: '4.6 ★',    ampel: 'gruen', delta: 0,   ziel: 4.5 },
    { label: 'Trinkgeld',   wert: '127 €',    ampel: 'gruen', delta: +8,  ziel: 120 },
    { label: 'Marge',       wert: '34 %',     ampel: 'gelb',  delta: -1,  ziel: 38 },
  ],
  stunden: [
    { stunde: '11', wert: 3, jetzt: false },
    { stunde: '12', wert: 8, jetzt: false },
    { stunde: '13', wert: 12, jetzt: false },
    { stunde: '14', wert: 9, jetzt: false },
    { stunde: '15', wert: 6, jetzt: false },
    { stunde: '16', wert: 4, jetzt: false },
    { stunde: '17', wert: 7, jetzt: false },
    { stunde: '18', wert: 14, jetzt: false },
    { stunde: '19', wert: 11, jetzt: true },
    { stunde: '20', wert: 0, jetzt: false },
    { stunde: '21', wert: 0, jetzt: false },
  ],
  wochen: [
    { tag: 'Mo', heute: 31, vw: 28 },
    { tag: 'Di', heute: 44, vw: 40 },
    { tag: 'Mi', heute: 38, vw: 35 },
    { tag: 'Do', heute: 47, vw: 42 },
    { tag: 'Fr', heute: 0, vw: 55 },
    { tag: 'Sa', heute: 0, vw: 68 },
    { tag: 'So', heute: 0, vw: 52 },
  ],
  fahrer: [
    { name: 'Marco R.',  score: 94, touren: 8, trinkgeld: 42, puenktl: 96, delta: +3 },
    { name: 'Lena K.',   score: 81, touren: 6, trinkgeld: 31, puenktl: 82, delta: -2 },
    { name: 'Tobias M.', score: 67, touren: 5, trinkgeld: 18, puenktl: 71, delta: +1 },
  ],
  zonen: [
    { zone: 'Mitte',   sla: 91, avg_min: 22, umsatz: 820, kapazitaet: 80 },
    { zone: 'Nord',    sla: 74, avg_min: 28, umsatz: 540, kapazitaet: 95 },
    { zone: 'Süd',     sla: 88, avg_min: 24, umsatz: 482, kapazitaet: 60 },
  ],
};

const AMPEL = {
  gruen: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  gelb:  { bg: 'bg-amber-900/40',   text: 'text-amber-300',   dot: 'bg-amber-400' },
  rot:   { bg: 'bg-red-900/40',     text: 'text-red-300',     dot: 'bg-red-500' },
};

type Tab = 'stunden' | 'fahrer' | 'zonen' | 'woche';

export function LieferdienstPhase5120StatistikenDashboardV31({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('stunden');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-intelligence?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scorePct = (data.gesamt_score / data.ziel_score) * 100;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/60 overflow-hidden text-sm space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-400" />
          <span className="font-semibold text-white">Statistiken V31</span>
          {loading && <span className="w-3 h-3 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          {data.score_delta >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-lg font-bold text-white">{data.gesamt_score}</span>
          <span className="text-xs text-slate-500">/ {data.ziel_score}</span>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="px-4 py-2 border-b border-slate-700/40">
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, scorePct)}%` }} />
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-700/40 flex flex-wrap gap-1.5">
          {data.alerts.map((a) => (
            <span key={a} className="flex items-center gap-1 bg-red-950/50 text-red-300 ring-1 ring-red-500/30 text-[10px] px-2 py-0.5 rounded-full">
              <AlertCircle className="w-2.5 h-2.5" />{a}
            </span>
          ))}
        </div>
      )}

      {/* 8-KPI Grid */}
      <div className="grid grid-cols-4 gap-px bg-slate-700/30 border-b border-slate-700/40">
        {data.kpis.map((k) => {
          const a = AMPEL[k.ampel];
          return (
            <div key={k.label} className={cn('flex flex-col items-center py-3 px-2', a.bg)}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', a.dot)} />
                <span className={cn('text-xs font-bold', a.text)}>{k.wert}</span>
              </div>
              <span className="text-[10px] text-slate-500 text-center leading-tight">{k.label}</span>
              {k.delta != null && (
                <span className={cn('text-[9px] mt-0.5', k.delta > 0 ? 'text-emerald-500' : k.delta < 0 ? 'text-red-500' : 'text-slate-600')}>
                  {k.delta > 0 ? '+' : ''}{k.delta}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700/40">
        {([['stunden', 'Stunden'], ['fahrer', 'Fahrer'], ['zonen', 'Zonen'], ['woche', 'Woche']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 text-xs py-2 transition-colors',
              tab === key ? 'text-teal-400 border-b-2 border-teal-400 -mb-px' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-3">
        {tab === 'stunden' && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stunden} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="wert" radius={[2, 2, 0, 0]}>
                  {data.stunden.map((s, i) => (
                    <rect key={i} fill={s.jetzt ? '#14b8a6' : '#475569'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'fahrer' && (
          <div className="space-y-2">
            {data.fahrer.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-2.5">
                <span className="text-lg">{['🥇', '🥈', '🥉'][i] ?? '·'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{f.name}</span>
                    <span className={cn('text-[10px]', f.delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {f.delta >= 0 ? '+' : ''}{f.delta}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span>{f.touren} Tour{f.touren !== 1 ? 'en' : ''}</span>
                    <span>{f.puenktl}% pünktl.</span>
                    <span>{f.trinkgeld} € Tg.</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-white">{f.score}</span>
                  <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'zonen' && (
          <div className="space-y-2">
            {data.zonen.map((z) => (
              <div key={z.zone} className="bg-slate-800/50 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{z.zone}</span>
                  <span className={cn('text-[10px] font-bold', z.sla >= 90 ? 'text-emerald-400' : z.sla >= 80 ? 'text-amber-400' : 'text-red-400')}>{z.sla}% SLA</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', z.kapazitaet >= 90 ? 'bg-red-500' : z.kapazitaet >= 70 ? 'bg-amber-400' : 'bg-emerald-500')}
                    style={{ width: `${z.kapazitaet}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span><Clock className="w-2.5 h-2.5 inline mr-0.5" />{z.avg_min} min</span>
                  <span><Euro className="w-2.5 h-2.5 inline mr-0.5" />{z.umsatz} €</span>
                  <span className="ml-auto">Kap. {z.kapazitaet}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'woche' && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.wochen} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} />
                <Line type="monotone" dataKey="heute" stroke="#14b8a6" strokeWidth={2} dot={false} name="Heute" />
                <Line type="monotone" dataKey="vw" stroke="#475569" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Vorwoche" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/40 text-center text-[10px] text-slate-600">
        60-Sek-Polling · Mock-Fallback
      </div>
    </div>
  );
}
