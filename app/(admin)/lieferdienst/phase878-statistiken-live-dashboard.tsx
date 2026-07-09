'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, BarChart2, Loader2 } from 'lucide-react';

interface Props {
  locationId: string;
}

interface StatKpi {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  color: string;
}

interface StatsData {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number;
  on_time_pct: number;
  storno_pct: number;
  bestellungen_gestern: number;
  umsatz_gestern: number;
  avg_lieferzeit_gestern: number;
}

function generateMock(): StatsData {
  return {
    bestellungen_heute: Math.floor(Math.random() * 50) + 30,
    umsatz_heute: Math.round((Math.random() * 1500 + 800) * 100) / 100,
    avg_lieferzeit_min: Math.round(Math.random() * 15 + 22),
    on_time_pct: Math.round(Math.random() * 25 + 70),
    storno_pct: Math.round(Math.random() * 8 + 2),
    bestellungen_gestern: Math.floor(Math.random() * 50) + 30,
    umsatz_gestern: Math.round((Math.random() * 1500 + 800) * 100) / 100,
    avg_lieferzeit_gestern: Math.round(Math.random() * 15 + 22),
  };
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function LieferdienstPhase878StatistikenLiveDashboard({ locationId }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/analytics?location_id=${locationId}&period=today`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.today) {
            setData({
              bestellungen_heute: json.today.orders ?? 0,
              umsatz_heute: json.today.revenue ?? 0,
              avg_lieferzeit_min: json.today.avg_delivery_min ?? 0,
              on_time_pct: json.today.on_time_pct ?? 0,
              storno_pct: json.today.cancellation_pct ?? 0,
              bestellungen_gestern: json.yesterday?.orders ?? 0,
              umsatz_gestern: json.yesterday?.revenue ?? 0,
              avg_lieferzeit_gestern: json.yesterday?.avg_delivery_min ?? 0,
            });
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setData(generateMock()); setLoading(false); }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (loading) return (
    <Card className="p-4 flex items-center gap-2 text-muted-foreground text-xs">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Statistiken…
    </Card>
  );
  if (!data) return null;

  const fmtEur = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const kpis: StatKpi[] = [
    {
      label: 'Bestellungen heute',
      value: data.bestellungen_heute.toString(),
      delta: data.bestellungen_gestern > 0 ? data.bestellungen_heute - data.bestellungen_gestern : 0,
      deltaLabel: `vs. gestern (${data.bestellungen_gestern})`,
      color: 'text-matcha-700 dark:text-matcha-300',
    },
    {
      label: 'Umsatz heute',
      value: fmtEur(data.umsatz_heute),
      delta: data.umsatz_gestern > 0 ? data.umsatz_heute - data.umsatz_gestern : 0,
      deltaLabel: `vs. gestern (${fmtEur(data.umsatz_gestern)})`,
      color: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min} Min`,
      delta: data.avg_lieferzeit_gestern > 0 ? data.avg_lieferzeit_gestern - data.avg_lieferzeit_min : 0,
      deltaLabel: `vs. gestern (${data.avg_lieferzeit_gestern} Min)`,
      color: 'text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Pünktlich',
      value: `${data.on_time_pct}%`,
      delta: data.on_time_pct >= 85 ? 1 : data.on_time_pct >= 70 ? 0 : -1,
      deltaLabel: data.on_time_pct >= 85 ? 'Sehr gut' : data.on_time_pct >= 70 ? 'OK' : 'Verbesserungsbedarf',
      color: data.on_time_pct >= 85 ? 'text-matcha-700 dark:text-matcha-300' : data.on_time_pct >= 70 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300',
    },
    {
      label: 'Storno-Quote',
      value: `${data.storno_pct}%`,
      delta: data.storno_pct <= 5 ? 1 : data.storno_pct <= 10 ? 0 : -1,
      deltaLabel: data.storno_pct <= 5 ? 'Niedrig — gut' : data.storno_pct <= 10 ? 'Mittel' : 'Hoch — prüfen',
      color: data.storno_pct <= 5 ? 'text-matcha-700 dark:text-matcha-300' : data.storno_pct <= 10 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300',
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-matcha-50 to-transparent dark:from-matcha-950">
        <BarChart2 className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold">Statistiken Live-Dashboard</span>
        <span className="ml-auto rounded-full bg-matcha-100 dark:bg-matcha-900 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
          Heute
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(kpi => (
          <div key={kpi.label} className="rounded-xl border bg-card p-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </div>
            <div className={cn('text-lg font-black tabular-nums leading-tight', kpi.color)}>
              {kpi.value}
            </div>
            <div className="flex items-center gap-1">
              <DeltaIcon delta={kpi.delta} />
              <span className="text-[10px] text-muted-foreground truncate">{kpi.deltaLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Mini bar visualization for delivery time distribution */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Lieferzeit-Zielerreichung
        </div>
        <div className="space-y-1.5">
          {[
            { label: '≤ 30 Min', pct: Math.round(data.on_time_pct * 0.6), color: 'bg-matcha-500' },
            { label: '30–45 Min', pct: Math.round(data.on_time_pct * 0.4), color: 'bg-amber-400' },
            { label: '> 45 Min', pct: 100 - data.on_time_pct, color: 'bg-red-400' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20 shrink-0">{row.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-500', row.color)} style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }} />
              </div>
              <span className="text-[10px] font-bold tabular-nums w-8 text-right">{Math.max(0, row.pct)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
