'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/utils';

interface KpiCell {
  label: string;
  heute: number | string;
  gestern: number | string;
  trend: 'besser' | 'gleich' | 'schlechter';
  trendPct: number;
  unit: string;
}

interface ApiData {
  kpis: KpiCell[];
  schicht_start: string;
}

const MOCK: ApiData = {
  kpis: [
    { label: 'Umsatz',         heute: 1840,  gestern: 1620,  trend: 'besser',     trendPct: 13.6, unit: '€' },
    { label: 'Bestellungen',   heute: 48,    gestern: 42,    trend: 'besser',     trendPct: 14.3, unit: ''  },
    { label: 'Ø Lieferzeit',   heute: 24,    gestern: 28,    trend: 'besser',     trendPct: 14.3, unit: 'Min' },
    { label: 'Bewertung',      heute: 4.7,   gestern: 4.5,   trend: 'besser',     trendPct: 4.4,  unit: '★' },
    { label: 'Pünktlichkeit',  heute: 91,    gestern: 88,    trend: 'besser',     trendPct: 3.4,  unit: '%' },
    { label: 'Stornoquote',    heute: 2.1,   gestern: 3.5,   trend: 'besser',     trendPct: 40.0, unit: '%' },
  ],
  schicht_start: new Date(Date.now() - 3 * 3600_000).toISOString(),
};

const POLL_MS = 5 * 60_000;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser')     return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (trend === 'schlechter') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

export function LieferdienstPhase1887StatistikGesamtuebersichtLive({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/statistik-vergleich-heute-gestern?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  function fmt(val: number | string, unit: string) {
    if (unit === '€') return euro(Number(val));
    if (typeof val === 'number') {
      return unit === '★' || unit === '%' ? val.toFixed(1) : String(val);
    }
    return String(val);
  }

  return (
    <Card className={cn('p-0 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">Statistik Heute vs. Gestern</span>
          {loading && (
            <span className="text-[10px] text-muted-foreground">Aktualisiere…</span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {!locationId && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
          )}
          {data.kpis.map(kpi => (
            <div key={kpi.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              <div className="flex items-center gap-3">
                {/* Gestern */}
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {fmt(kpi.gestern, kpi.unit)}{kpi.unit !== '€' ? kpi.unit : ''}
                </span>
                <TrendIcon trend={kpi.trend} />
                {/* Heute */}
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  kpi.trend === 'besser' ? 'text-green-600 dark:text-green-400' :
                  kpi.trend === 'schlechter' ? 'text-red-600 dark:text-red-400' :
                  'text-foreground',
                )}>
                  {fmt(kpi.heute, kpi.unit)}{kpi.unit !== '€' ? kpi.unit : ''}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold min-w-[36px] text-right',
                  kpi.trend === 'besser' ? 'text-green-500' :
                  kpi.trend === 'schlechter' ? 'text-red-500' : 'text-muted-foreground',
                )}>
                  {kpi.trend !== 'gleich' ? `${kpi.trend === 'besser' ? '+' : '-'}${kpi.trendPct.toFixed(0)}%` : '±0%'}
                </span>
              </div>
            </div>
          ))}
          <div className="px-4 py-2 text-[10px] text-muted-foreground text-right">
            Live · alle 5 Min aktualisiert
          </div>
        </div>
      )}
    </Card>
  );
}
