'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp } from 'lucide-react';

/**
 * Phase 1005 — Verdienst-Ziel-Tracker (Fahrer-App)
 *
 * Zeigt den aktuellen Tagesverdienst vs. Schichtziel mit SVG-Fortschrittsbalken.
 * Polling: 10 Min.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface BilanzData {
  umsatz_eur: number;
  stopps: number;
  trinkgeld_eur: number;
  bonus_eur: number;
  schicht_dauer_min: number;
}

const TAGESZIEL_EUR = 120;

const MOCK: BilanzData = {
  umsatz_eur: 74.50,
  stopps: 6,
  trinkgeld_eur: 5.20,
  bonus_eur: 0,
  schicht_dauer_min: 210,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function FahrerPhase1005VerdienstZielTracker({ driverId, isOnline }: Props) {
  const [data, setData] = useState<BilanzData | null>(null);

  const load = useCallback(async () => {
    if (!driverId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`, { cache: 'no-store' });
      const json: BilanzData = res.ok ? await res.json() : MOCK;
      setData(json);
    } catch {
      setData(MOCK);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    void load();
    const id = setInterval(() => { void load(); }, 600_000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  if (!isOnline || !data) return null;

  const verdienst = (data.umsatz_eur ?? 0) + (data.trinkgeld_eur ?? 0) + (data.bonus_eur ?? 0);
  const pct = Math.min(100, Math.round((verdienst / TAGESZIEL_EUR) * 100));
  const restEur = Math.max(0, TAGESZIEL_EUR - verdienst);
  const erreicht = pct >= 100;

  const barColor = erreicht
    ? 'bg-matcha-500'
    : pct >= 70
    ? 'bg-amber-400'
    : 'bg-blue-400';

  const motivMsg = erreicht
    ? '🏆 Tagesziel erreicht!'
    : pct >= 70
    ? `💪 Nur noch ${fmtEur(restEur)} bis zum Ziel!`
    : `🎯 Ziel: ${fmtEur(TAGESZIEL_EUR)} · Noch ${fmtEur(restEur)}`;

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Target className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-bold">Verdienst-Ziel</span>
        </div>
        <span className={cn(
          'rounded-full px-2.5 py-0.5 text-[10px] font-black',
          erreicht ? 'bg-matcha-500 text-white' : 'bg-white/10 text-white/70',
        )}>
          {pct}%
        </span>
      </div>

      {/* Big number */}
      <div className="flex items-end gap-2">
        <span className="text-3xl font-black text-white tabular-nums">{fmtEur(verdienst)}</span>
        <span className="text-xs text-white/50 mb-1">/ {fmtEur(TAGESZIEL_EUR)}</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Motivation */}
      <p className="text-xs text-white/80 font-medium">{motivMsg}</p>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: 'Umsatz', val: fmtEur(data.umsatz_eur) },
          { label: 'Trinkgeld', val: fmtEur(data.trinkgeld_eur) },
          { label: 'Stopps', val: String(data.stopps) },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-center">
            <div className="text-xs font-bold text-white tabular-nums">{k.val}</div>
            <div className="text-[9px] text-white/40 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {erreicht && (
        <div className="flex items-center gap-1.5 rounded-lg bg-matcha-500/20 border border-matcha-400/30 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-300" />
          <span className="text-xs font-bold text-matcha-200">Super Schicht! Ziel übertroffen.</span>
        </div>
      )}
    </section>
  );
}
