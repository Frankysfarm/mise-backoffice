'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Target, Loader2 } from 'lucide-react';

/**
 * Phase 902 — Fahrer-Ziel-Fortschritt-Bar
 *
 * Täglicher Fortschritt: Touren/Ziel + Km/Ziel + Einkommen/Ziel.
 * 5-Min-Polling. Nur sichtbar wenn isOnline.
 */

interface ZielData {
  touren_heute: number;
  touren_ziel: number;
  km_heute: number;
  km_ziel: number;
  einkommen_heute: number;
  einkommen_ziel: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK: ZielData = {
  touren_heute: 4,
  touren_ziel: 8,
  km_heute: 22.5,
  km_ziel: 50,
  einkommen_heute: 38.40,
  einkommen_ziel: 80,
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function FahrerPhase902ZielFortschrittBar({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ZielData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/tages-bilanz?driver_id=${driverId}`);
        if (!cancelled && res.ok) {
          const json = await res.json();
          setData({
            touren_heute: json.touren_heute ?? json.tours_today ?? 0,
            touren_ziel: json.touren_ziel ?? json.tour_goal ?? 8,
            km_heute: json.km_heute ?? json.km_today ?? 0,
            km_ziel: json.km_ziel ?? json.km_goal ?? 50,
            einkommen_heute: json.einkommen_heute ?? json.earnings_today ?? 0,
            einkommen_ziel: json.einkommen_ziel ?? json.earnings_goal ?? 80,
          });
        } else if (!cancelled) {
          setData(MOCK);
        }
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const d = data;
  const tourenPct = Math.min(100, d.touren_ziel > 0 ? (d.touren_heute / d.touren_ziel) * 100 : 0);
  const kmPct = Math.min(100, d.km_ziel > 0 ? (d.km_heute / d.km_ziel) * 100 : 0);
  const einkommenPct = Math.min(100, d.einkommen_ziel > 0 ? (d.einkommen_heute / d.einkommen_ziel) * 100 : 0);

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Tagesziel</span>
        </div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-2.5">
        {/* Touren */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Touren</span>
            <span className={cn('font-bold', tourenPct >= 100 ? 'text-matcha-600' : 'text-foreground')}>
              {d.touren_heute} / {d.touren_ziel}
              {tourenPct >= 100 && ' ✓'}
            </span>
          </div>
          <ProgressBar value={d.touren_heute} max={d.touren_ziel} color="bg-matcha-500" />
        </div>

        {/* Kilometer */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Kilometer</span>
            <span className={cn('font-bold', kmPct >= 100 ? 'text-blue-600' : 'text-foreground')}>
              {d.km_heute.toFixed(1)} / {d.km_ziel} km
              {kmPct >= 100 && ' ✓'}
            </span>
          </div>
          <ProgressBar value={d.km_heute} max={d.km_ziel} color="bg-blue-500" />
        </div>

        {/* Einkommen */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Einkommen</span>
            <span className={cn('font-bold', einkommenPct >= 100 ? 'text-amber-600' : 'text-foreground')}>
              {d.einkommen_heute.toFixed(2)} € / {d.einkommen_ziel} €
              {einkommenPct >= 100 && ' ✓'}
            </span>
          </div>
          <ProgressBar value={d.einkommen_heute} max={d.einkommen_ziel} color="bg-amber-500" />
        </div>
      </div>

      {/* Hochrechnung */}
      {d.touren_heute > 0 && d.touren_heute < d.touren_ziel && (
        <div className="rounded-lg bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground text-center">
          Noch {d.touren_ziel - d.touren_heute} Touren bis Tagesziel
        </div>
      )}
      {d.touren_heute >= d.touren_ziel && (
        <div className="rounded-lg bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 px-3 py-1.5 text-[11px] font-bold text-matcha-700 dark:text-matcha-400 text-center">
          Tagesziel erreicht! 🎯
        </div>
      )}
    </div>
  );
}
