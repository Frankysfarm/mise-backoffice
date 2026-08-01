'use client';

import { useEffect, useRef, useState } from 'react';
import { Brain, Clock, AlertTriangle, CheckCircle2, Zap, Timer, TrendingUp, ChefHat, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Phase 5475 — Smart-Timing Countdown V54
// Neu: KI-Stapel-Prognose (Batching-Forecast für nächste 15 Min);
// Multi-Station-Farbkodierung (Warm/Kalt/Backen/Fritteuse);
// Übergabe-Zeit-Optimierer (Δmin bis Fahrer-Ankunft);
// Burn-Rate-Indikator (Bestellungen/h live);
// 10-KPI-Grid Aktiv/Kritisch/Überfällig/KI-Empf./Batch/Sync/Fahrer↑/Fertig/Velocity/Burn;
// 4-Tab Countdown/Stationen/Prognose/Übergabe; 1s-Tick+15s-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';
type Station = 'warm' | 'kalt' | 'backen' | 'fritteuse';

interface KochOrder {
  id: string;
  nr: string;
  artikel: string;
  start_at: number;
  finish_at: number;
  status: 'waiting' | 'cooking' | 'done';
  prio: number;
  ki_korrektur_min: number;
  station: Station;
  fahrer_eta_min: number;
  uebergabe_delta_min: number;
}

interface StationLoad {
  station: Station;
  label: string;
  aktiv: number;
  kapazitaet: number;
  load_pct: number;
  ampel: Ampel;
}

interface ForecastPoint {
  min_label: string;
  bestellungen: number;
  ki_kapazitaet: number;
}

interface ApiData {
  aktiv: number;
  kritisch: number;
  ueberfaellig: number;
  ki_empfohlen: number;
  batch_score: number;
  sync_score: number;
  fahrer_nahe: number;
  fertig: number;
  velocity: number;
  burn_rate: number;
  orders: KochOrder[];
  stationen: StationLoad[];
  prognose: ForecastPoint[];
}

const STATION_COLORS: Record<Station, string> = {
  warm:      '#f97316',
  kalt:      '#38bdf8',
  backen:    '#a78bfa',
  fritteuse: '#fb923c',
};

const STATION_LABELS: Record<Station, string> = {
  warm:      'Warm',
  kalt:      'Kalt',
  backen:    'Backen',
  fritteuse: 'Fritteuse',
};

function ampelColor(a: Ampel) {
  if (a === 'rot')  return '#ef4444';
  if (a === 'gelb') return '#eab308';
  return '#22c55e';
}

function countdown(finish_at: number, now: number): string {
  const s = Math.max(0, Math.round((finish_at - now) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function statusColor(status: KochOrder['status']): string {
  if (status === 'done')    return 'text-green-400';
  if (status === 'cooking') return 'text-amber-400';
  return 'text-gray-500';
}

const MOCK: ApiData = {
  aktiv: 8, kritisch: 2, ueberfaellig: 1, ki_empfohlen: 3,
  batch_score: 78, sync_score: 82, fahrer_nahe: 2, fertig: 5,
  velocity: 14, burn_rate: 18,
  orders: [
    { id: 'o1', nr: '#301', artikel: 'Döner+Pommes', start_at: Date.now() - 480_000, finish_at: Date.now() + 120_000, status: 'cooking', prio: 1, ki_korrektur_min: -1, station: 'warm',      fahrer_eta_min: 4,  uebergabe_delta_min:  2 },
    { id: 'o2', nr: '#302', artikel: 'Pizza Marg.',  start_at: Date.now() - 300_000, finish_at: Date.now() + 420_000, status: 'cooking', prio: 2, ki_korrektur_min:  0, station: 'backen',    fahrer_eta_min: 8,  uebergabe_delta_min:  1 },
    { id: 'o3', nr: '#303', artikel: 'Salat+Wrap',   start_at: Date.now() - 60_000,  finish_at: Date.now() + 600_000, status: 'waiting', prio: 3, ki_korrektur_min:  2, station: 'kalt',      fahrer_eta_min: 12, uebergabe_delta_min: -2 },
    { id: 'o4', nr: '#304', artikel: 'Nuggets',      start_at: Date.now() - 200_000, finish_at: Date.now() + 240_000, status: 'cooking', prio: 4, ki_korrektur_min: -2, station: 'fritteuse', fahrer_eta_min: 6,  uebergabe_delta_min:  0 },
    { id: 'o5', nr: '#305', artikel: 'Burger',       start_at: Date.now() - 720_000, finish_at: Date.now() -  30_000, status: 'done',    prio: 5, ki_korrektur_min:  0, station: 'warm',      fahrer_eta_min: 1,  uebergabe_delta_min:  3 },
  ],
  stationen: [
    { station: 'warm',      label: 'Warm',      aktiv: 3, kapazitaet: 5, load_pct: 60, ampel: 'gelb'  },
    { station: 'kalt',      label: 'Kalt',      aktiv: 1, kapazitaet: 4, load_pct: 25, ampel: 'gruen' },
    { station: 'backen',    label: 'Backen',    aktiv: 2, kapazitaet: 3, load_pct: 67, ampel: 'gelb'  },
    { station: 'fritteuse', label: 'Fritteuse', aktiv: 2, kapazitaet: 2, load_pct: 100, ampel: 'rot'  },
  ],
  prognose: [
    { min_label: '+0',  bestellungen: 8,  ki_kapazitaet: 10 },
    { min_label: '+5',  bestellungen: 11, ki_kapazitaet: 10 },
    { min_label: '+10', bestellungen: 9,  ki_kapazitaet: 12 },
    { min_label: '+15', bestellungen: 6,  ki_kapazitaet: 12 },
  ],
};

type Tab = 'countdown' | 'stationen' | 'prognose' | 'uebergabe';

export function KitchenPhase5475SmartTimingCountdownV54() {
  const [data, setData]   = useState<ApiData>(MOCK);
  const [now, setNow]     = useState(Date.now());
  const [tab, setTab]     = useState<Tab>('countdown');
  const [loading, setLoading] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/kitchen/timing');
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15_000);
    tickRef.current  = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (tickRef.current)  clearInterval(tickRef.current);
    };
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'countdown',  label: 'Countdown' },
    { key: 'stationen',  label: 'Stationen' },
    { key: 'prognose',   label: 'Prognose'  },
    { key: 'uebergabe',  label: 'Übergabe'  },
  ];

  const ueberfaellig = data.orders.filter(o => o.status !== 'done' && now > o.finish_at);

  return (
    <div className="rounded-lg bg-gray-900 border border-indigo-700/40 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-white">Smart-Timing V54</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.kritisch > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.kritisch} kritisch
          </div>
        )}
      </div>

      {/* 10-KPI-Grid */}
      <div className="grid grid-cols-5 gap-1 text-center">
        {[
          { label: 'Aktiv',    value: data.aktiv,       color: 'text-white'       },
          { label: 'Kritisch', value: data.kritisch,    color: 'text-red-400'     },
          { label: 'Überfäll.', value: ueberfaellig.length, color: ueberfaellig.length > 0 ? 'text-orange-400' : 'text-gray-500' },
          { label: 'KI-Empf.', value: data.ki_empfohlen, color: 'text-indigo-400' },
          { label: 'Batch',    value: `${data.batch_score}%`, color: 'text-cyan-400' },
          { label: 'Sync',     value: `${data.sync_score}%`,  color: 'text-teal-400' },
          { label: 'Fahrer↑',  value: data.fahrer_nahe,  color: 'text-green-400'  },
          { label: 'Fertig',   value: data.fertig,       color: 'text-emerald-400' },
          { label: 'Vel./h',   value: data.velocity,    color: 'text-amber-400'   },
          { label: 'Burn/h',   value: data.burn_rate,   color: 'text-purple-400'  },
        ].map(k => (
          <div key={k.label} className="rounded bg-gray-800 px-1 py-1">
            <div className="text-[9px] text-gray-500 leading-none">{k.label}</div>
            <div className={`text-xs font-bold leading-tight ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Countdown */}
      {tab === 'countdown' && (
        <div className="space-y-1">
          {data.orders.map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded bg-gray-800/60 px-2 py-1">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: STATION_COLORS[o.station] }}
              />
              <span className="text-[10px] text-gray-400 w-9 shrink-0">{o.nr}</span>
              <span className="text-[10px] text-white truncate flex-1">{o.artikel}</span>
              <div className="flex items-center gap-1">
                {o.ki_korrektur_min !== 0 && (
                  <span className={`text-[9px] ${o.ki_korrektur_min < 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    {o.ki_korrektur_min > 0 ? '+' : ''}{o.ki_korrektur_min}m
                  </span>
                )}
                <Timer className={`h-3 w-3 ${statusColor(o.status)}`} />
                <span className={`text-[10px] font-mono ${statusColor(o.status)}`}>
                  {o.status === 'done' ? 'Fertig' : countdown(o.finish_at, now)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stationen */}
      {tab === 'stationen' && (
        <div className="space-y-1.5">
          {data.stationen.map(s => (
            <div key={s.station} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATION_COLORS[s.station] }} />
                  <span className="text-[10px] text-white">{STATION_LABELS[s.station]}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">{s.aktiv}/{s.kapazitaet}</span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ampelColor(s.ampel) }}
                  />
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${s.load_pct}%`, backgroundColor: STATION_COLORS[s.station] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Prognose */}
      {tab === 'prognose' && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-400">KI-Batching-Prognose nächste 15 Min</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data.prognose} barSize={14}>
              <XAxis dataKey="min_label" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', fontSize: 10 }}
                formatter={(v: number) => [`${v}`, '']}
              />
              <Bar dataKey="bestellungen" fill="#818cf8" name="Bestellungen" radius={[2,2,0,0]} />
              <Bar dataKey="ki_kapazitaet" fill="#34d399" name="KI-Kapazität" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block" />Bestellungen</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />KI-Kapazität</span>
          </div>
        </div>
      )}

      {/* Tab: Übergabe */}
      {tab === 'uebergabe' && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-400">Übergabe-Optimierung (Δ Fahrer-Ankunft)</div>
          {data.orders.filter(o => o.status !== 'done').map(o => {
            const delta = o.uebergabe_delta_min;
            const color = delta < 0 ? 'text-orange-400' : delta === 0 ? 'text-green-400' : 'text-gray-400';
            return (
              <div key={o.id} className="flex items-center gap-2 rounded bg-gray-800/60 px-2 py-1">
                <ChefHat className="h-3 w-3 text-gray-500 shrink-0" />
                <span className="text-[10px] text-white truncate flex-1">{o.nr} {o.artikel}</span>
                <span className={`text-[10px] font-mono ${color}`}>
                  {delta === 0 ? 'Optimal' : `${delta > 0 ? '+' : ''}${delta}m`}
                </span>
                <Flame className={`h-3 w-3 ${delta < 0 ? 'text-red-400' : 'text-gray-600'}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
