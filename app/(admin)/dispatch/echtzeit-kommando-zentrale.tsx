'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Package, Truck, Users, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIData {
  aktiveTourenCount: number;
  offeneBestellungenCount: number;
  aktiveFahrerCount: number;
  gesamtFahrerCount: number;
  avgScore: number;
  bestellungenHeute: number;
}

interface Props {
  locationId: string | null;
  /** Online-Fahrer aus Dispatch-State (keine API nötig) */
  onlineFahrerCount?: number;
  /** Alle Fahrer der Location */
  gesamtFahrerCount?: number;
  /** Aktive Touren aus Dispatch-State */
  aktiveTourenCount?: number;
  /** Offene (bereite) Bestellungen */
  offeneBestellungenCount?: number;
}

function kpiColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function auslastungColor(pct: number): string {
  if (pct >= 0.9) return 'bg-red-500';
  if (pct >= 0.6) return 'bg-amber-400';
  return 'bg-green-500';
}

export function DispatchEchtzeitKommandoZentrale({
  locationId,
  onlineFahrerCount = 0,
  gesamtFahrerCount = 0,
  aktiveTourenCount = 0,
  offeneBestellungenCount = 0,
}: Props) {
  const [kpi, setKpi] = useState<KPIData>({
    aktiveTourenCount,
    offeneBestellungenCount,
    aktiveFahrerCount: onlineFahrerCount,
    gesamtFahrerCount,
    avgScore: 0,
    bestellungenHeute: 0,
  });
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      try {
        // Fetch live driver scores for avg score
        const [scoreRes, statsRes] = await Promise.allSettled([
          fetch(`/api/delivery/admin/driver-score?action=live&location_id=${locationId}`),
          fetch(`/api/delivery/admin/stats?period=today&location_id=${locationId}`),
        ]);

        let avgScore = 0;
        let bestellungenHeute = 0;

        if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
          const scores: { score: number }[] = await scoreRes.value.json().catch(() => []);
          if (Array.isArray(scores) && scores.length > 0) {
            avgScore = Math.round(scores.reduce((s, d) => s + (d.score ?? 0), 0) / scores.length);
          }
        }

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const stats = await statsRes.value.json().catch(() => null);
          if (stats?.bestellungen_heute != null) bestellungenHeute = Number(stats.bestellungen_heute);
          else if (stats?.total_orders != null) bestellungenHeute = Number(stats.total_orders);
        }

        if (!mountedRef.current) return;
        setKpi(prev => ({
          ...prev,
          avgScore,
          bestellungenHeute,
          aktiveTourenCount: aktiveTourenCount || prev.aktiveTourenCount,
          offeneBestellungenCount: offeneBestellungenCount || prev.offeneBestellungenCount,
          aktiveFahrerCount: onlineFahrerCount || prev.aktiveFahrerCount,
          gesamtFahrerCount: gesamtFahrerCount || prev.gesamtFahrerCount,
        }));
      } catch {
        // silent
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId, onlineFahrerCount, gesamtFahrerCount, aktiveTourenCount, offeneBestellungenCount]);

  // Also update from props when they change
  useEffect(() => {
    setKpi(prev => ({
      ...prev,
      aktiveTourenCount: aktiveTourenCount,
      offeneBestellungenCount: offeneBestellungenCount,
      aktiveFahrerCount: onlineFahrerCount,
      gesamtFahrerCount: gesamtFahrerCount,
    }));
  }, [aktiveTourenCount, offeneBestellungenCount, onlineFahrerCount, gesamtFahrerCount]);

  const auslastungPct = kpi.gesamtFahrerCount > 0
    ? kpi.aktiveFahrerCount / kpi.gesamtFahrerCount
    : 0;

  const tiles = [
    {
      icon: <Truck className="h-4 w-4" />,
      label: 'Aktive Touren',
      value: kpi.aktiveTourenCount,
      color: kpi.aktiveTourenCount > 0 ? 'text-blue-700' : 'text-muted-foreground',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      icon: <Package className="h-4 w-4" />,
      label: 'Offen / Bereit',
      value: kpi.offeneBestellungenCount,
      color: kpi.offeneBestellungenCount > 5 ? 'text-red-600' : kpi.offeneBestellungenCount > 2 ? 'text-amber-600' : 'text-green-700',
      bg: kpi.offeneBestellungenCount > 5 ? 'bg-red-50 border-red-200' : kpi.offeneBestellungenCount > 2 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200',
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Fahrer online',
      value: `${kpi.aktiveFahrerCount}/${kpi.gesamtFahrerCount}`,
      color: auslastungPct >= 0.9 ? 'text-red-600' : auslastungPct >= 0.6 ? 'text-amber-600' : 'text-green-700',
      bg: auslastungPct >= 0.9 ? 'bg-red-50 border-red-200' : 'bg-matcha-50 border-matcha-200',
      bar: true,
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Ø Fahrer-Score',
      value: loading ? '…' : kpi.avgScore > 0 ? kpi.avgScore : '–',
      color: kpi.avgScore > 0 ? kpiColor(kpi.avgScore) : 'text-muted-foreground',
      bg: 'bg-violet-50 border-violet-200',
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: 'Bestellungen heute',
      value: loading ? '…' : kpi.bestellungenHeute,
      color: 'text-foreground',
      bg: 'bg-stone-50 border-stone-200',
    },
  ] as const;

  return (
    <div className="rounded-xl border bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-matcha-700 to-matcha-600">
        <Zap className="h-4 w-4 text-matcha-100 shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest text-matcha-50">
          Echtzeit-Kommandozentrale
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-matcha-300 animate-pulse" />
          <span className="text-[10px] text-matcha-200 font-semibold">Live</span>
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={cn('rounded-lg border px-3 py-2 flex flex-col gap-0.5', tile.bg)}
          >
            <div className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider', tile.color)}>
              {tile.icon}
              {tile.label}
            </div>
            <div className={cn('text-2xl font-black tabular-nums leading-tight', tile.color)}>
              {tile.value}
            </div>
            {'bar' in tile && tile.bar && kpi.gesamtFahrerCount > 0 && (
              <div className="h-1 w-full rounded-full bg-black/10 overflow-hidden mt-1">
                <div
                  className={cn('h-full rounded-full transition-all', auslastungColor(auslastungPct))}
                  style={{ width: `${Math.round(auslastungPct * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
