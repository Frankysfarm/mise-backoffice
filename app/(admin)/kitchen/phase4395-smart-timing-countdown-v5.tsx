'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, TrendingUp, Clock, Flame, Bell } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'in_zubereitung' | 'fertig' | 'wartend';
  geschaetzte_min: number;
  remaining_sec: number;
  fahrer_wartet: boolean;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  prep_min_bisher: number;
  station: string;
}

interface KpiData {
  bestellungen: OrderCountdown[];
  timing_score: number;
  on_time_pct: number;
  ueberfaellig: number;
  fahrer_wartet_anzahl: number;
  avg_prep_min: number;
  ziel_min: number;
  kritisch_anzahl: number;
}

const MOCK: KpiData = {
  timing_score: 84,
  on_time_pct: 88,
  ueberfaellig: 1,
  fahrer_wartet_anzahl: 2,
  avg_prep_min: 15,
  ziel_min: 18,
  kritisch_anzahl: 1,
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0051', kunde_name: 'K. Schmidt',  status: 'in_zubereitung', geschaetzte_min: 18, remaining_sec: 620,  fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 5,  station: 'Pizza' },
    { order_id: 'o2', bestellnummer: '0052', kunde_name: 'A. Müller',   status: 'in_zubereitung', geschaetzte_min: 15, remaining_sec: 190,  fahrer_wartet: false, ampel: 'gelb',  prep_min_bisher: 12, station: 'Grill' },
    { order_id: 'o3', bestellnummer: '0053', kunde_name: 'B. Weber',    status: 'in_zubereitung', geschaetzte_min: 14, remaining_sec: 65,   fahrer_wartet: true,  ampel: 'orange', prep_min_bisher: 13, station: 'Pasta' },
    { order_id: 'o4', bestellnummer: '0050', kunde_name: 'T. Bauer',    status: 'fertig',          geschaetzte_min: 16, remaining_sec: -360, fahrer_wartet: true,  ampel: 'rot',   prep_min_bisher: 22, station: 'Grill' },
    { order_id: 'o5', bestellnummer: '0054', kunde_name: 'S. Fischer',  status: 'wartend',         geschaetzte_min: 20, remaining_sec: 1180, fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 0,  station: 'Pizza' },
  ],
};

const AMPEL = {
  gruen:  { dot: 'bg-green-400',  ring: 'bg-green-50',   text: 'text-green-700',  bar: 'bg-green-500',  label: '>5m' },
  gelb:   { dot: 'bg-yellow-400', ring: 'bg-yellow-50',  text: 'text-yellow-700', bar: 'bg-yellow-500', label: '2–5m' },
  orange: { dot: 'bg-orange-400', ring: 'bg-orange-50',  text: 'text-orange-700', bar: 'bg-orange-500', label: '0–2m' },
  rot:    { dot: 'bg-red-500',    ring: 'bg-red-50',     text: 'text-red-600',    bar: 'bg-red-500',    label: 'überfällig', pulse: true },
} as const;

function fmtSec(sec: number): string {
  if (sec <= 0) return `+${Math.abs(Math.floor(-sec / 60))}m`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

interface Props { locationId: string | null }

export function KitchenPhase4395SmartTimingCountdownV5({ locationId }: Props) {
  const [data, setData] = useState<KpiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [silenced, setSilenced] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 12_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(iv); }, []);

  const scoreColor = data.timing_score >= 85 ? 'text-green-600' : data.timing_score >= 70 ? 'text-yellow-600' : 'text-red-500';
  const scoreBg   = data.timing_score >= 85 ? 'bg-green-50'    : data.timing_score >= 70 ? 'bg-yellow-50'    : 'bg-red-50';
  const efficienz = Math.min(100, Math.round((data.ziel_min / Math.max(1, data.avg_prep_min)) * 100));
  const hasCritical = data.kritisch_anzahl > 0 || data.ueberfaellig > 0;

  const stations = Array.from(new Set(data.bestellungen.map((b) => b.station)));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">

      {/* Kritisch-Alert-Banner */}
      {hasCritical && !silenced && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <Flame className="w-3.5 h-3.5 text-red-500 flex-shrink-0 animate-pulse" />
          <span className="text-[10px] font-bold text-red-700 flex-1">
            {data.ueberfaellig} überfällig · {data.fahrer_wartet_anzahl} Fahrer warten
          </span>
          <button onClick={() => setSilenced(true)} className="text-[9px] text-red-400 hover:text-red-600">
            <Bell className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900">Smart-Timing V5</span>
          {loading && <span className="w-2 h-2 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${scoreBg}`}>
          <span className="text-[9px] font-bold text-gray-400">Score</span>
          <span className={`text-xs font-bold ${scoreColor}`}>{data.timing_score}</span>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="bg-green-50 rounded-lg p-1.5">
          <p className="text-[8px] text-green-500 font-bold uppercase tracking-wide">Pünktl.</p>
          <p className="text-sm font-bold text-green-700">{data.on_time_pct}%</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-1.5">
          <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wide">Ø Prep</p>
          <p className="text-sm font-bold text-blue-700">{data.avg_prep_min}m</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-1.5">
          <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wide">Überfällig</p>
          <p className={`text-sm font-bold ${data.ueberfaellig > 0 ? 'text-red-600' : 'text-gray-400'}`}>{data.ueberfaellig}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-1.5">
          <p className="text-[8px] text-purple-400 font-bold uppercase tracking-wide">Effizienz</p>
          <p className="text-sm font-bold text-purple-700">{efficienz}%</p>
        </div>
      </div>

      {/* Stations mini-heatmap */}
      {stations.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {stations.map((st) => {
            const stOrders = data.bestellungen.filter((b) => b.station === st);
            const busy = stOrders.filter((b) => b.status === 'in_zubereitung').length;
            const done = stOrders.filter((b) => b.status === 'fertig').length;
            const hasRed = stOrders.some((b) => b.ampel === 'rot');
            return (
              <span key={st} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${hasRed ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasRed ? 'bg-red-400' : 'bg-green-400'}`} />
                {st} ({busy} aktiv{done > 0 ? `, ${done} fertig` : ''})
              </span>
            );
          })}
        </div>
      )}

      {/* Efficiency bar */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[9px] text-gray-400">
          <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" />Ø {data.avg_prep_min}m vs. Ziel {data.ziel_min}m</span>
          <span>{efficienz}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${efficienz >= 90 ? 'bg-green-500' : efficienz >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, efficienz)}%` }}
          />
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-1">
        {data.bestellungen.map((b) => {
          const st = AMPEL[b.ampel];
          const dispSec = b.remaining_sec - tick;
          const prepPct = b.status === 'wartend' ? 0 : Math.min(100, Math.round((b.prep_min_bisher / Math.max(1, b.geschaetzte_min)) * 100));
          const isExpanded = expanded.has(b.order_id);
          const isCritical = b.ampel === 'rot';

          return (
            <div key={b.order_id}>
              <button
                onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(b.order_id) ? n.delete(b.order_id) : n.add(b.order_id); return n; })}
                className={`w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left border ${isCritical ? 'border-red-200 ' + st.ring : 'border-transparent ' + st.ring} ${st.pulse ? 'animate-pulse' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                <span className="text-[10px] font-semibold text-gray-500 w-9 flex-shrink-0">#{b.bestellnummer}</span>
                <span className="text-[10px] text-gray-700 flex-1 truncate">{b.kunde_name}</span>
                <span className="text-[9px] text-gray-400 hidden sm:block">{b.station}</span>
                {b.fahrer_wartet && <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                {isCritical && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${st.text}`}>
                  {b.status === 'wartend' ? '—' : b.status === 'fertig' && b.remaining_sec < 0 ? fmtSec(dispSec) : fmtSec(dispSec)}
                </span>
              </button>
              {isExpanded && (
                <div className="ml-4 mt-0.5 px-2 py-1.5 bg-gray-50 rounded space-y-1">
                  <div className="flex gap-3 text-[9px] text-gray-500">
                    <span>Ziel: {b.geschaetzte_min}m</span>
                    <span>Bisher: {b.prep_min_bisher}m</span>
                    <span>Station: {b.station}</span>
                  </div>
                  <MiniBar pct={prepPct} color={st.bar} />
                  <div className="flex justify-between text-[8px] text-gray-400">
                    <span>Fortschritt {prepPct}%</span>
                    <span className="flex items-center gap-0.5"><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-[8px] text-gray-400 pt-1 border-t border-gray-100 flex-wrap">
        {(Object.entries(AMPEL) as [keyof typeof AMPEL, (typeof AMPEL)[keyof typeof AMPEL]][]).map(([k, v]) => (
          <span key={k} className="flex items-center gap-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />{v.label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-0.5"><Clock className="w-2 h-2" />12s</span>
      </div>
    </div>
  );
}
