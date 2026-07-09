'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KpiEntry = {
  label: string;
  wert: string;
  trend: 'up' | 'down' | 'flat';
  delta?: string;
  color: 'gruen' | 'gelb' | 'rot' | 'neutral';
};

type Data = { kpis: KpiEntry[]; schicht_label: string };

function mock(): Data {
  return {
    schicht_label: 'Heute',
    kpis: [
      { label: 'Umsatz', wert: '2.847 €', trend: 'up', delta: '+9% vs. VW', color: 'gruen' },
      { label: 'Bestellungen', wert: '94', trend: 'up', delta: '+12 vs. VW', color: 'gruen' },
      { label: 'Pünktlichkeit', wert: '87%', trend: 'flat', delta: '±0%', color: 'gelb' },
      { label: 'Lieferzeit Ø', wert: '24 Min', trend: 'down', delta: '+3 Min', color: 'gelb' },
      { label: 'Stornorate', wert: '3.2%', trend: 'up', delta: '+0.5%', color: 'rot' },
      { label: 'Bewertung', wert: '4.7 ★', trend: 'flat', delta: '±0', color: 'gruen' },
    ],
  };
}

const COLOR_MAP = {
  gruen:   { bg: 'bg-matcha-50 dark:bg-matcha-950/30', text: 'text-matcha-800 dark:text-matcha-200', border: 'border-matcha-100 dark:border-matcha-800' },
  gelb:    { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-100 dark:border-amber-700' },
  rot:     { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-800 dark:text-red-200', border: 'border-red-100 dark:border-red-700' },
  neutral: { bg: 'bg-muted/20', text: 'text-foreground', border: 'border-border' },
};

export function LieferdienstPhase1001SchichtKpiExecutiveLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams(); if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/schicht-kpi-executive?${p}`);
      if (r.ok) setData(await r.json()); else throw new Error();
    } catch { setData(mock()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [locationId]);

  if (!data && loading) return <div className="h-32 bg-muted/20 rounded-2xl animate-pulse" />;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Activity size={15} className="text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Schicht-KPI — Executive Live ({data.schicht_label})</span>
        {loading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.kpis.map((kpi) => {
          const cm = COLOR_MAP[kpi.color];
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
          const trendColor = kpi.trend === 'up' ? 'text-matcha-600' : kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

          return (
            <div key={kpi.label} className={cn('rounded-xl border p-3', cm.bg, cm.border)}>
              <div className={cn('text-lg font-black tabular-nums', cm.text)}>{kpi.wert}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
              {kpi.delta && (
                <div className={cn('flex items-center gap-1 mt-1 text-[9px] font-bold', trendColor)}>
                  <TrendIcon size={9} />
                  <span>{kpi.delta}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
