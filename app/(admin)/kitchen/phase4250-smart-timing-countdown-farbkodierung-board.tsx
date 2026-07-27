'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Timer, Zap } from 'lucide-react';

interface BestellCountdown {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'in_zubereitung' | 'fertig';
  prep_start_at: string | null;
  geschaetzte_min: number;
  fahrer_wartet: boolean;
  remaining_sec: number;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
}

interface ApiData {
  bestellungen: BestellCountdown[];
  timing_score: number;
  on_time_pct: number;
  ueberfaellig: number;
  synced: number;
}

const MOCK: ApiData = {
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0042', kunde_name: 'M. Schulz',   status: 'in_zubereitung', prep_start_at: null, geschaetzte_min: 20, fahrer_wartet: false, remaining_sec: 480,  ampel: 'gruen' },
    { order_id: 'o2', bestellnummer: '0043', kunde_name: 'T. Bauer',    status: 'in_zubereitung', prep_start_at: null, geschaetzte_min: 18, fahrer_wartet: false, remaining_sec: 195,  ampel: 'gelb'  },
    { order_id: 'o3', bestellnummer: '0044', kunde_name: 'S. Koch',     status: 'in_zubereitung', prep_start_at: null, geschaetzte_min: 15, fahrer_wartet: true,  remaining_sec: 72,   ampel: 'orange'},
    { order_id: 'o4', bestellnummer: '0041', kunde_name: 'J. Fischer',  status: 'fertig',          prep_start_at: null, geschaetzte_min: 20, fahrer_wartet: true,  remaining_sec: -120, ampel: 'rot'   },
  ],
  timing_score: 78,
  on_time_pct: 82,
  ueberfaellig: 1,
  synced: 3,
};

function fmtSec(sec: number): string {
  if (sec < 0) return `+${Math.abs(Math.floor(sec / 60))}m`;
  const m = Math.floor(sec / 60);
  const s = Math.abs(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AMPEL_STYLES = {
  gruen:  { dot: 'bg-green-400',  text: 'text-green-600',  bg: 'bg-green-50'  },
  gelb:   { dot: 'bg-yellow-400', text: 'text-yellow-600', bg: 'bg-yellow-50' },
  orange: { dot: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50' },
  rot:    { dot: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50 animate-pulse' },
} as const;

interface Props { locationId: string | null; }

export function KitchenPhase4250SmartTimingCountdownFarbkodierungBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(id); }, []);

  const scoreColor = data.timing_score >= 90 ? 'text-green-600' : data.timing_score >= 70 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900">Smart-Timing Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.ueberfaellig > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle className="w-3 h-3" />{data.ueberfaellig} überfällig
            </span>
          )}
          <span className={`text-sm font-bold ${scoreColor}`}>{data.timing_score}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-indigo-50 rounded-lg p-1.5">
          <p className="text-[9px] text-indigo-500 font-medium uppercase tracking-wide">Score</p>
          <p className={`text-base font-bold ${scoreColor}`}>{data.timing_score}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5">
          <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wide">Pünktlich</p>
          <p className="text-base font-bold text-gray-700">{data.on_time_pct}%</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-1.5">
          <p className="text-[9px] text-emerald-600 font-medium uppercase tracking-wide">Synced</p>
          <p className="text-base font-bold text-emerald-700">{data.synced}</p>
        </div>
      </div>

      <div className="space-y-1">
        {data.bestellungen.map((b) => {
          const st = AMPEL_STYLES[b.ampel];
          const dispSec = b.remaining_sec - tick;
          return (
            <div key={b.order_id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${st.bg}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
              <span className="text-[10px] text-gray-500 font-medium w-9 flex-shrink-0">#{b.bestellnummer}</span>
              <span className="text-[10px] text-gray-700 flex-1 truncate">{b.kunde_name}</span>
              {b.fahrer_wartet && <Zap className="w-3 h-3 text-amber-500 flex-shrink-0" aria-label="Fahrer wartet" />}
              <span className={`text-[11px] font-bold tabular-nums ${st.text}`}>{fmtSec(dispSec)}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> grün&gt;5m · gelb 2–5m · orange 0–2m · rot überfällig</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />10s</span>
      </div>
    </div>
  );
}
