'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, Brain, TrendingUp, Layers, Target, Coins } from 'lucide-react';

// Phase 5408 — Smart-Timing Countdown V51
// Neu: Trinkgeld-Potential-Indikator je Order (Kundenbewertungs-Prognose);
// Priorisierungs-Score + Trinkgeld-Faktor kombiniert;
// Stations-Überlast-Alert; Fahrer-Ankunfts-Prognose Ampel;
// Batch-Effizienz-Index; 7-KPI-Grid Aktiv/Kritisch/Überfällig/Fertig/KI/Velocity/Trinkgeld-Score;
// Farbkodierung 6-stufig queued/ok/warn/critical/overdue/done;
// 3-Tab Countdown/KI/Stationen; 1s-Tick+15s-Polling; Mock-Fallback

type OrderState = 'queued' | 'ok' | 'warn' | 'critical' | 'overdue' | 'done';
type StationKey = 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen' | 'pizza';
type Tab = 'countdown' | 'ki' | 'stationen';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: StationKey;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'queued';
  priority: 'high' | 'normal';
  prio_score: number;
  trinkgeld_potential: 'hoch' | 'mittel' | 'niedrig';
  ki_start_empfehlung_min: number | null;
  fahrer_ankunft_ampel: 'gruen' | 'gelb' | 'rot';
}

interface StationStat {
  key: StationKey;
  label: string;
  aktiv: number;
  kapazitaet: number;
  ueberlast: boolean;
  effizienz_pct: number;
}

interface ApiResponse {
  orders: KitchenOrder[];
  effizienz_index: number;
  ki_score: number;
  velocity: number;
  kritisch_count: number;
  ueberfaellig_count: number;
  fertig_count: number;
  ki_empfohlen_count: number;
  trinkgeld_score: number;
  stationen: StationStat[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  ki_score: 92,
  velocity: 28,
  kritisch_count: 1,
  ueberfaellig_count: 0,
  fertig_count: 9,
  ki_empfohlen_count: 2,
  effizienz_index: 89,
  trinkgeld_score: 76,
  timestamp: new Date().toISOString(),
  stationen: [
    { key: 'grill',   label: 'Grill',   aktiv: 2, kapazitaet: 3, ueberlast: false, effizienz_pct: 93 },
    { key: 'friture', label: 'Friture', aktiv: 3, kapazitaet: 3, ueberlast: true,  effizienz_pct: 79 },
    { key: 'kalt',    label: 'Kalt',    aktiv: 1, kapazitaet: 4, ueberlast: false, effizienz_pct: 96 },
    { key: 'pasta',   label: 'Pasta',   aktiv: 2, kapazitaet: 3, ueberlast: false, effizienz_pct: 85 },
    { key: 'ofen',    label: 'Ofen',    aktiv: 1, kapazitaet: 2, ueberlast: false, effizienz_pct: 89 },
    { key: 'pizza',   label: 'Pizza',   aktiv: 2, kapazitaet: 2, ueberlast: true,  effizienz_pct: 72 },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1201', station: 'grill',   prep_started_at: new Date(Date.now() - 8  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 5,  batch_id: 'B1', status: 'in_progress', priority: 'high',   prio_score: 91, trinkgeld_potential: 'hoch',    ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'rot' },
    { id: 'o2', bestellnummer: '#1202', station: 'friture', prep_started_at: new Date(Date.now() - 5  * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 8,  batch_id: 'B1', status: 'in_progress', priority: 'normal', prio_score: 56, trinkgeld_potential: 'mittel',  ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'gelb' },
    { id: 'o3', bestellnummer: '#1203', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 6,  fahrer_eta_min: 10, batch_id: 'B2', status: 'queued',      priority: 'normal', prio_score: 36, trinkgeld_potential: 'niedrig', ki_start_empfehlung_min: 4,    fahrer_ankunft_ampel: 'gruen' },
    { id: 'o4', bestellnummer: '#1204', station: 'pasta',   prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 3,  batch_id: 'B2', status: 'in_progress', priority: 'high',   prio_score: 79, trinkgeld_potential: 'hoch',    ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'rot' },
    { id: 'o5', bestellnummer: '#1205', station: 'ofen',    prep_started_at: null,                                              prep_target_min: 15, fahrer_eta_min: 12, batch_id: 'B3', status: 'queued',      priority: 'normal', prio_score: 29, trinkgeld_potential: 'mittel',  ki_start_empfehlung_min: 6,    fahrer_ankunft_ampel: 'gruen' },
    { id: 'o6', bestellnummer: '#1200', station: 'pizza',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',   priority: 'normal', prio_score: 5,  trinkgeld_potential: 'niedrig', ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'gruen' },
  ],
};

function elapsed(startedAt: string | null): number {
  if (!startedAt) return 0;
  return (Date.now() - new Date(startedAt).getTime()) / 60_000;
}

function orderState(o: KitchenOrder, elapsedMin: number): OrderState {
  if (o.status === 'ready') return 'done';
  if (o.status === 'queued') return 'queued';
  const remaining = o.prep_target_min - elapsedMin;
  if (remaining < -2) return 'overdue';
  if (remaining < 0)  return 'critical';
  if (remaining < 2)  return 'warn';
  return 'ok';
}

const STATE_BG: Record<OrderState, string> = {
  queued:   'bg-gray-800 border-gray-700',
  ok:       'bg-emerald-950/40 border-emerald-700/40',
  warn:     'bg-amber-950/40 border-amber-700/40',
  critical: 'bg-red-950/50 border-red-600/50',
  overdue:  'bg-red-950/70 border-red-500',
  done:     'bg-gray-900 border-gray-700 opacity-50',
};

const TIP_BADGE: Record<string, string> = {
  hoch:    'bg-orange-500/20 text-orange-300',
  mittel:  'bg-amber-500/20 text-amber-400',
  niedrig: 'bg-gray-700 text-gray-500',
};

const ARRIVAL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-400',
  gelb:  'bg-amber-400',
  rot:   'bg-red-400',
};

export function KitchenPhase5408SmartTimingCountdownV51() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/delivery/kitchen/smart-timing');
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    pollRef.current = setInterval(load, 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const activeOrders = data.orders.filter(o => o.status !== 'ready');

  const kpis = [
    { label: 'Aktiv',     value: activeOrders.length,       color: 'text-blue-400' },
    { label: 'Kritisch',  value: data.kritisch_count,        color: 'text-red-400' },
    { label: 'Überfällig',value: data.ueberfaellig_count,    color: 'text-orange-400' },
    { label: 'Fertig',    value: data.fertig_count,          color: 'text-emerald-400' },
    { label: 'KI-Score',  value: `${data.ki_score}`,        color: 'text-indigo-400' },
    { label: 'Velocity',  value: `${data.velocity}/h`,       color: 'text-cyan-400' },
    { label: 'Tip-Score', value: `${data.trinkgeld_score}`,  color: 'text-orange-400' },
  ];

  const ueberlastCount = data.stationen.filter(s => s.ueberlast).length;

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Smart-Timing Countdown V51</span>
        </div>
        <div className="flex items-center gap-2">
          {ueberlastCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-400 bg-red-950/40 rounded px-1.5 py-0.5">
              <AlertTriangle className="h-3 w-3" />{ueberlastCount} Station{ueberlastCount > 1 ? 'en' : ''} überlastet
            </div>
          )}
          <div className="text-xs text-indigo-300 bg-indigo-950/40 rounded px-1.5 py-0.5">Effizienz {data.effizienz_index}%</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-800 rounded-lg p-1.5 text-center">
            <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['countdown', 'ki', 'stationen'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-2 py-1 rounded transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t === 'countdown' ? 'Countdown' : t === 'ki' ? 'KI-Prognose' : 'Stationen'}
          </button>
        ))}
      </div>

      {/* Countdown Tab */}
      {tab === 'countdown' && (
        <div className="space-y-1.5">
          {data.orders.map(o => {
            const elapsedMin = elapsed(o.prep_started_at);
            const state = orderState(o, elapsedMin);
            const remainSec = state !== 'done' && state !== 'queued' && o.prep_started_at
              ? Math.max(0, (o.prep_target_min * 60) - (Date.now() - new Date(o.prep_started_at).getTime()) / 1000) + tick * 0 /* tick forces re-render */
              : null;
            const mm = remainSec !== null ? Math.floor(remainSec / 60) : null;
            const ss = remainSec !== null ? Math.floor(remainSec % 60) : null;
            return (
              <div key={o.id} className={`rounded-lg border p-2 flex items-center gap-2 flex-wrap ${STATE_BG[state]}`}>
                <span className="text-xs font-mono text-gray-300 w-12 shrink-0">{o.bestellnummer}</span>
                <span className="text-[10px] text-gray-400 w-10 shrink-0">{o.station}</span>
                {mm !== null && ss !== null ? (
                  <span className={`text-xs font-mono font-bold w-12 ${state === 'critical' || state === 'overdue' ? 'text-red-400 animate-pulse' : 'text-gray-200'}`}>
                    {state === 'overdue' ? '-' : ''}{mm}:{String(ss).padStart(2, '0')}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 w-12">{state === 'done' ? '✓' : '—'}</span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIP_BADGE[o.trinkgeld_potential]}`}>
                  <Coins className="h-2.5 w-2.5 inline mr-0.5" />{o.trinkgeld_potential}
                </span>
                {o.fahrer_eta_min !== null && (
                  <div className="flex items-center gap-1 ml-auto">
                    <div className={`h-2 w-2 rounded-full ${ARRIVAL_DOT[o.fahrer_ankunft_ampel]}`} />
                    <span className="text-[10px] text-gray-400">Fahrer {o.fahrer_eta_min}min</span>
                  </div>
                )}
                {o.ki_start_empfehlung_min !== null && (
                  <span className="text-[10px] text-indigo-400">KI: start in {o.ki_start_empfehlung_min}min</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KI Tab */}
      {tab === 'ki' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-indigo-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-indigo-400">{data.ki_score}</div>
              <div className="text-xs text-gray-400">KI-Score</div>
            </div>
            <div className="bg-orange-950/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-400">{data.trinkgeld_score}</div>
              <div className="text-xs text-gray-400">Tip-Score</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 text-center">
            KI empfiehlt {data.ki_empfohlen_count} Kochstart{data.ki_empfohlen_count !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Pünktliche Lieferungen → höheres Trinkgeld-Potential
          </div>
        </div>
      )}

      {/* Stationen Tab */}
      {tab === 'stationen' && (
        <div className="space-y-1.5">
          {data.stationen.map(s => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-14">{s.label}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${s.effizienz_pct}%`, backgroundColor: s.ueberlast ? '#f87171' : s.effizienz_pct >= 85 ? '#34d399' : '#fbbf24' }}
                />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{s.effizienz_pct}%</span>
              <span className="text-[10px] text-gray-500 w-8">{s.aktiv}/{s.kapazitaet}</span>
              {s.ueberlast && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-gray-600 text-right">1s-Tick · 15s-Polling · V51</div>
    </div>
  );
}
