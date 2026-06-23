'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Trend = 'stark_besser' | 'besser' | 'neutral' | 'schlechter' | 'stark_schlechter';
type GesamtTrend = 'stark' | 'besser' | 'neutral' | 'schwaecher' | 'schwach';

interface MetrikBenchmark {
  istWert:       number | null;
  benchmarkWert: number | null;
  abweichungPct: number | null;
  trend:         Trend;
}

interface BenchmarkSummary {
  locationId:        string;
  schichtDatum:      string;
  bestellungen:      MetrikBenchmark;
  umsatzEur:         MetrikBenchmark;
  puenktlichkeitPct: MetrikBenchmark;
  compositeScore:    MetrikBenchmark;
  avgDeliveryMin:    MetrikBenchmark;
  gesamtTrend:       GesamtTrend;
  berechnetAm:       string;
}

interface Props {
  locationId: string | null;
}

const TREND_ICON: Record<Trend, React.ReactNode> = {
  stark_besser:       <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />,
  besser:             <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />,
  neutral:            <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
  schlechter:         <TrendingDown className="h-3.5 w-3.5 text-amber-500" />,
  stark_schlechter:   <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
};

const TREND_COLOR: Record<Trend, string> = {
  stark_besser:     'text-matcha-700 font-black',
  besser:           'text-matcha-600 font-bold',
  neutral:          'text-muted-foreground',
  schlechter:       'text-amber-600 font-bold',
  stark_schlechter: 'text-red-600 font-black',
};

const GESAMT_BADGE: Record<GesamtTrend, { label: string; cls: string }> = {
  stark:      { label: '★ Stark', cls: 'bg-matcha-500 text-white' },
  besser:     { label: '▲ Besser', cls: 'bg-matcha-100 text-matcha-800 border border-matcha-300' },
  neutral:    { label: '– Neutral', cls: 'bg-muted text-muted-foreground' },
  schwaecher: { label: '▼ Schwächer', cls: 'bg-amber-100 text-amber-800 border border-amber-300' },
  schwach:    { label: '↓ Schwach', cls: 'bg-red-100 text-red-700 border border-red-300' },
};

function fmt(val: number | null, suffix = ''): string {
  if (val === null) return '—';
  if (suffix === '€') return `${val.toFixed(0)}€`;
  if (suffix === '%') return `${val.toFixed(1)}%`;
  if (suffix === 'min') return `${val.toFixed(1)} min`;
  return `${val.toFixed(1)}${suffix}`;
}

function AbwPct({ pct, trend }: { pct: number | null; trend: Trend }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const sign = pct > 0 ? '+' : '';
  return (
    <span className={cn('text-xs tabular-nums', TREND_COLOR[trend])}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

interface MetrikRowProps {
  label:   string;
  metrik:  MetrikBenchmark;
  istFmt:  string;
  benchFmt: string;
}

function MetrikRow({ label, metrik, istFmt, benchFmt }: MetrikRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0">
      <div className="w-4 shrink-0">{TREND_ICON[metrik.trend]}</div>
      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{label}</span>
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className={cn('text-xs tabular-nums font-semibold', TREND_COLOR[metrik.trend])}>
          {istFmt}
        </span>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Ø {benchFmt}
        </span>
        <AbwPct pct={metrik.abweichungPct} trend={metrik.trend} />
      </div>
    </div>
  );
}

export function DispatchSchichtBenchmarkCard({ locationId }: Props) {
  const [data, setData] = useState<BenchmarkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(withRefresh = false) {
    if (!locationId) { setLoading(false); return; }
    if (withRefresh) setRefreshing(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-benchmark?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      const json = await res.json() as { ok: boolean; benchmarks?: BenchmarkSummary };
      if (json.ok && json.benchmarks) {
        setData(json.benchmarks);
      } else if (withRefresh) {
        // Trigger computation then reload
        await fetch('/api/delivery/admin/schicht-benchmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'compute', location_id: locationId }),
        });
        const res2 = await fetch(
          `/api/delivery/admin/schicht-benchmark?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        const json2 = await res2.json() as { ok: boolean; benchmarks?: BenchmarkSummary };
        if (json2.ok && json2.benchmarks) setData(json2.benchmarks);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const id = setInterval(() => load(), 10 * 60_000);
    return () => clearInterval(id);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locationId) return null;
  if (loading) {
    return (
      <Card className="p-3 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-3 w-full bg-muted rounded mb-2" />
        ))}
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Schicht-Benchmark
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-xs text-matcha-600 hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Berechnen
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Noch keine Benchmark-Daten für heute.</p>
      </Card>
    );
  }

  const gesamt = GESAMT_BADGE[data.gesamtTrend];
  const berechnetMin = Math.round((Date.now() - new Date(data.berechnetAm).getTime()) / 60_000);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <BarChart2 className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht vs. 4-Wochen-Ø
        </span>
        <Badge className={cn('ml-auto text-[10px] px-1.5 py-0.5', gesamt.cls)}>
          {gesamt.label}
        </Badge>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="ml-1 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          title="Neu berechnen"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="px-4 py-2 divide-y divide-border/50">
        <MetrikRow
          label="Bestellungen"
          metrik={data.bestellungen}
          istFmt={fmt(data.bestellungen.istWert)}
          benchFmt={fmt(data.bestellungen.benchmarkWert)}
        />
        <MetrikRow
          label="Umsatz"
          metrik={data.umsatzEur}
          istFmt={fmt(data.umsatzEur.istWert, '€')}
          benchFmt={fmt(data.umsatzEur.benchmarkWert, '€')}
        />
        <MetrikRow
          label="Pünktlichkeit"
          metrik={data.puenktlichkeitPct}
          istFmt={fmt(data.puenktlichkeitPct.istWert, '%')}
          benchFmt={fmt(data.puenktlichkeitPct.benchmarkWert, '%')}
        />
        <MetrikRow
          label="Fahrer-Score"
          metrik={data.compositeScore}
          istFmt={fmt(data.compositeScore.istWert)}
          benchFmt={fmt(data.compositeScore.benchmarkWert)}
        />
        <MetrikRow
          label="Ø Lieferzeit"
          metrik={data.avgDeliveryMin}
          istFmt={fmt(data.avgDeliveryMin.istWert, 'min')}
          benchFmt={fmt(data.avgDeliveryMin.benchmarkWert, 'min')}
        />
      </div>

      <div className="px-4 py-1.5 bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>{data.schichtDatum}</span>
        <span>
          Berechnet vor {berechnetMin < 1 ? '<1' : berechnetMin} Min
        </span>
      </div>
    </Card>
  );
}
