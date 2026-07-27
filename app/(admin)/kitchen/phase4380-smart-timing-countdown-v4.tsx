'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, TrendingUp, Clock } from 'lucide-react';

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
}

interface KpiData {
  bestellungen: OrderCountdown[];
  timing_score: number;
  on_time_pct: number;
  ueberfaellig: number;
  fahrer_wartet_anzahl: number;
  avg_prep_min: number;
  ziel_min: number;
}

const MOCK: KpiData = {
  timing_score: 82,
  on_time_pct: 85,
  ueberfaellig: 1,
  fahrer_wartet_anzahl: 2,
  avg_prep_min: 16,
  ziel_min: 18,
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0051', kunde_name: 'K. Schmidt',  status: 'in_zubereitung', geschaetzte_min: 18, remaining_sec: 620,  fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 5  },
    { order_id: 'o2', bestellnummer: '0052', kunde_name: 'A. Müller',   status: 'in_zubereitung', geschaetzte_min: 15, remaining_sec: 190,  fahrer_wartet: false, ampel: 'gelb',  prep_min_bisher: 12 },
    { order_id: 'o3', bestellnummer: '0053', kunde_name: 'B. Weber',    status: 'in_zubereitung', geschaetzte_min: 14, remaining_sec: 65,   fahrer_wartet: true,  ampel: 'orange', prep_min_bisher: 13 },
    { order_id: 'o4', bestellnummer: '0050', kunde_name: 'T. Bauer',    status: 'fertig',          geschaetzte_min: 16, remaining_sec: -90,  fahrer_wartet: true,  ampel: 'rot',   prep_min_bisher: 17 },
    { order_id: 'o5', bestellnummer: '0054', kunde_name: 'S. Fischer',  status: 'wartend',         geschaetzte_min: 20, remaining_sec: 1180, fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 0  },
  ],
};

const AMPEL = {
  gruen:  { dot: 'bg-green-400',  ring: 'bg-green-100',  text: 'text-green-700',  label: '>5m'  },
  gelb:   { dot: 'bg-yellow-400', ring: 'bg-yellow-50',  text: 'text-yellow-700', label: '2–5m' },
  orange: { dot: 'bg-orange-400', ring: 'bg-orange-50',  text: 'text-orange-700', label: '0–2m' },
  rot:    { dot: 'bg-red-500',    ring: 'bg-red-50 animate-pulse', text: 'text-red-600', label: 'überfällig' },
} as const;

function fmtSec(sec: number): string {
  if (sec <= 0) return `+${Math.abs(Math.floor(-sec / 60))}m`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="flex-shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="14" cy="14" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

interface Props { locationId: string | null }

export function KitchenPhase4380SmartTimingCountdownV4({ locationId }: Props) {
  const [data, setData] = useState<KpiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
  const efficienz = Math.min(100, Math.round((data.ziel_min / Math.max(1, data.avg_prep_min)) * 100));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900">Smart-Timing V4</span>
          {loading && <span className="w-2 h-2 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          {data.fahrer_wartet_anzahl > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
              <Zap className="w-3 h-3" />{data.fahrer_wartet_anzahl} warten
            </span>
          )}
          {data.ueberfaellig > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
              <AlertTriangle className="w-3 h-3" />{data.ueberfaellig}
            </span>
          )}
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="bg-indigo-50 rounded-lg p-1.5">
          <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-wide">Score</p>
          <p className={`text-sm font-bold ${scoreColor}`}>{data.timing_score}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-1.5">
          <p className="text-[8px] text-green-500 font-bold uppercase tracking-wide">Pünktl.</p>
          <p className="text-sm font-bold text-green-700">{data.on_time_pct}%</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-1.5">
          <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wide">Ø Prep</p>
          <p className="text-sm font-bold text-blue-700">{data.avg_prep_min}m</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-1.5">
          <p className="text-[8px] text-purple-400 font-bold uppercase tracking-wide">Effizienz</p>
          <p className="text-sm font-bold text-purple-700">{efficienz}%</p>
        </div>
      </div>

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
          const dispSec = Math.max(-9999, b.remaining_sec - tick);
          const prepPct = b.status === 'wartend' ? 0 : Math.min(100, Math.round((b.prep_min_bisher / Math.max(1, b.geschaetzte_min)) * 100));
          const ringColor = b.ampel === 'gruen' ? '#22c55e' : b.ampel === 'gelb' ? '#eab308' : b.ampel === 'orange' ? '#f97316' : '#ef4444';
          const isExpanded = expanded.has(b.order_id);

          return (
            <div key={b.order_id}>
              <button
                onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(b.order_id) ? n.delete(b.order_id) : n.add(b.order_id); return n; })}
                className={`w-full flex items-center gap-1.5 rounded-lg px-2 py-1 ${st.ring} text-left`}
              >
                <ProgressRing pct={prepPct} color={ringColor} />
                <span className="text-[10px] font-semibold text-gray-500 w-9 flex-shrink-0">#{b.bestellnummer}</span>
                <span className="text-[10px] text-gray-700 flex-1 truncate">{b.kunde_name}</span>
                <span className={`text-[9px] font-medium ${b.status === 'wartend' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {b.status === 'wartend' ? 'wartet' : b.status === 'fertig' ? 'fertig' : 'kocht'}
                </span>
                {b.fahrer_wartet && <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${st.text}`}>{b.status === 'wartend' ? '—' : fmtSec(dispSec)}</span>
              </button>
              {isExpanded && (
                <div className="ml-8 mt-0.5 px-2 py-1 bg-gray-50 rounded text-[9px] text-gray-500 flex gap-3">
                  <span>Ziel: {b.geschaetzte_min}m</span>
                  <span>Bisher: {b.prep_min_bisher}m</span>
                  <span>Fortschritt: {prepPct}%</span>
                  <span className="flex items-center gap-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legende */}
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
