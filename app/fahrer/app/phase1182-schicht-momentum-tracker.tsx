'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1182 — Schicht-Momentum-Tracker (Fahrer-App)
// Live-Schicht-Tempo: Stopps/Stunde + Hochrechnung Tagesende-Verdienst

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface MomentumData {
  stoppsHeute: number;
  schichtStunden: number;
  stoppsMittelung: number; // Stopps/Stunde
  verdienstHeute: number;
  prognoseBisSchichtende: number;
  schichtRestStunden: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

const MOCK: MomentumData = {
  stoppsHeute: 7,
  schichtStunden: 3.5,
  stoppsMittelung: 2.0,
  verdienstHeute: 58.4,
  prognoseBisSchichtende: 120.0,
  schichtRestStunden: 4.5,
  trend: 'steigend',
};

const TREND_CFG = {
  steigend: { label: '↑ Steigend', cls: 'text-matcha-700' },
  stabil:   { label: '→ Stabil',   cls: 'text-amber-600' },
  fallend:  { label: '↓ Fallend',  cls: 'text-red-600' },
};

export function FahrerPhase1182SchichtMomentumTracker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/schicht-bilanz?driver_id=${driverId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const stopps = d.stops_completed ?? d.stoppsHeute ?? 0;
      const stunden = Math.max(0.5, (d.shift_duration_min ?? 210) / 60);
      const rate = stopps / stunden;
      const restH = Math.max(0, (d.shift_remaining_min ?? 270) / 60);
      const verdienst = d.earnings_eur ?? d.verdienstHeute ?? 0;
      const prognose = verdienst + rate * restH * (verdienst / Math.max(1, stopps));
      const prevRate = d.prev_rate ?? rate * 0.9;
      const trend: MomentumData['trend'] = rate > prevRate * 1.05 ? 'steigend' : rate < prevRate * 0.95 ? 'fallend' : 'stabil';
      setData({ stoppsHeute: stopps, schichtStunden: stunden, stoppsMittelung: rate, verdienstHeute: verdienst, prognoseBisSchichtende: prognose, schichtRestStunden: restH, trend });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const fmtEur = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const pct = Math.min(100, Math.round((data.verdienstHeute / Math.max(1, data.prognoseBisSchichtende)) * 100));
  const trendCfg = TREND_CFG[data.trend];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-stone-800">Schicht-Momentum</span>
          <span className={cn('text-xs font-semibold', trendCfg.cls)}>{trendCfg.label}</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-stone-300" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 p-2.5 text-center">
              <div className="text-lg font-black text-amber-700 tabular-nums">{data.stoppsHeute}</div>
              <div className="text-[10px] font-semibold text-amber-600/70">Stopps heute</div>
            </div>
            <div className="rounded-xl bg-sky-50 p-2.5 text-center">
              <div className="text-lg font-black text-sky-700 tabular-nums">{data.stoppsMittelung.toFixed(1)}</div>
              <div className="text-[10px] font-semibold text-sky-600/70">Stopps/Std</div>
            </div>
            <div className="rounded-xl bg-matcha-50 p-2.5 text-center">
              <div className="text-base font-black text-matcha-700 tabular-nums">{fmtEur(data.verdienstHeute)}</div>
              <div className="text-[10px] font-semibold text-matcha-600/70">Verdienst</div>
            </div>
          </div>

          {/* Fortschrittsbalken zur Prognose */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-stone-500">
              <span>Schicht-Prognose</span>
              <span className="font-bold text-matcha-700">{fmtEur(data.prognoseBisSchichtende)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-matcha-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>{pct}% erreicht</span>
              <span>{data.schichtRestStunden.toFixed(1)}h verbleibend</span>
            </div>
          </div>

          <p className="text-[10px] text-stone-400">
            Hochrechnung basiert auf aktuellem Tempo ({data.stoppsMittelung.toFixed(1)} Stopps/h) × Restschicht.
          </p>
        </div>
      )}
    </div>
  );
}
