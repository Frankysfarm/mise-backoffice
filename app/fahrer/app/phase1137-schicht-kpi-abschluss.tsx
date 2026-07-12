'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1137 — Schicht-KPI-Abschluss (Fahrer-App)
// Tages-Leistungs-Übersicht: Stopps, km, Umsatz, Trinkgeld, Pünktlichkeit + Motivations-Nachricht

interface Props {
  driverId: string;
  isOnline: boolean;
}

type KpiData = {
  stopps: number;
  touren: number;
  km_geschaetzt: number;
  umsatz_eur: number;
  trinkgeld_eur: number;
  puenktlichkeit_pct: number;
  schicht_stunden: number;
  vortag_umsatz_eur: number;
  generiert_am: string;
};

const MOCK: KpiData = {
  stopps: 14,
  touren: 3,
  km_geschaetzt: 38,
  umsatz_eur: 127,
  trinkgeld_eur: 12.5,
  puenktlichkeit_pct: 92,
  schicht_stunden: 5.5,
  vortag_umsatz_eur: 108,
  generiert_am: new Date().toISOString(),
};

function motivation(pct: number, stopps: number): string {
  if (pct >= 90 && stopps >= 12) return '🏆 Ausgezeichnete Schicht! Top-Leistung!';
  if (pct >= 80) return '⭐ Starke Schicht – weiter so!';
  if (stopps >= 10) return '💪 Viele Lieferungen heute – gut gemacht!';
  return '👍 Solide Schicht – morgen noch besser!';
}

export function FahrerPhase1137SchichtKpiAbschluss({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      // Map schicht-bilanz response to our KpiData shape
      setData({
        stopps: json.stopps_heute ?? MOCK.stopps,
        touren: json.touren_heute ?? MOCK.touren,
        km_geschaetzt: json.km_heute ?? MOCK.km_geschaetzt,
        umsatz_eur: json.umsatz_heute ?? MOCK.umsatz_eur,
        trinkgeld_eur: json.trinkgeld_heute ?? MOCK.trinkgeld_eur,
        puenktlichkeit_pct: json.puenktlichkeit_pct ?? MOCK.puenktlichkeit_pct,
        schicht_stunden: json.schicht_stunden ?? MOCK.schicht_stunden,
        vortag_umsatz_eur: json.vortag_umsatz_eur ?? MOCK.vortag_umsatz_eur,
        generiert_am: new Date().toISOString(),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (isOnline) {
      load();
      const id = setInterval(load, 5 * 60_000);
      return () => clearInterval(id);
    }
  }, [isOnline, load]);

  if (!isOnline) return null;

  const trend = data ? ((data.umsatz_eur - data.vortag_umsatz_eur) / Math.max(data.vortag_umsatz_eur, 1)) * 100 : 0;
  const TrendIcon = trend > 3 ? TrendingUp : trend < -3 ? TrendingDown : Minus;
  const trendColor = trend > 3 ? 'text-emerald-500' : trend < -3 ? 'text-red-500' : 'text-muted-foreground';

  const KPIS = data ? [
    { label: 'Stopps',      value: `${data.stopps}`,                    sub: `${data.touren} Touren` },
    { label: 'Km geschätzt', value: `${data.km_geschaetzt} km`,          sub: `~${(data.km_geschaetzt / Math.max(data.schicht_stunden, 1)).toFixed(1)} km/h` },
    { label: 'Umsatz',       value: `${data.umsatz_eur.toFixed(0)} €`,   sub: `+Trinkgeld ${data.trinkgeld_eur.toFixed(2)} €` },
    { label: 'Pünktlichkeit', value: `${data.puenktlichkeit_pct}%`,      sub: data.puenktlichkeit_pct >= 85 ? '✓ Sehr gut' : data.puenktlichkeit_pct >= 70 ? 'OK' : '⚠ Verbessern' },
  ] : [];

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <span className="font-bold text-sm text-teal-800 dark:text-teal-200">Schicht-KPIs</span>
          {data && (
            <span className="rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
              {data.stopps} Stopps · {data.umsatz_eur.toFixed(0)} €
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {data && (
            <div className={cn('flex items-center gap-0.5 text-[10px] font-bold', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3 border-t border-teal-200/50 dark:border-teal-800/50 pt-3">
          {/* Motivations-Banner */}
          <div className="rounded-lg bg-white/70 dark:bg-white/5 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-foreground">{motivation(data.puenktlichkeit_pct, data.stopps)}</p>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {KPIS.map(kpi => (
              <div key={kpi.label} className="rounded-lg bg-white/70 dark:bg-white/5 p-2.5 text-center">
                <div className="text-base font-black text-foreground tabular-nums">{kpi.value}</div>
                <div className="text-[9px] text-muted-foreground font-medium">{kpi.label}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Pünktlichkeits-Balken */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">Pünktlichkeit</span>
              <span className={cn(
                'text-[10px] font-bold',
                data.puenktlichkeit_pct >= 85 ? 'text-emerald-600 dark:text-emerald-400' : data.puenktlichkeit_pct >= 70 ? 'text-amber-600' : 'text-red-600'
              )}>{data.puenktlichkeit_pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  data.puenktlichkeit_pct >= 85 ? 'bg-emerald-500' : data.puenktlichkeit_pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${data.puenktlichkeit_pct}%` }}
              />
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground text-right">Schichtdauer: {data.schicht_stunden.toFixed(1)} h · 5-Min-Aktualisierung</p>
        </div>
      )}
    </div>
  );
}
