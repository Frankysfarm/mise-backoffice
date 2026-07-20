'use client';

/**
 * Phase 2565 — Statistiken Heute Final
 *
 * Tages-Statistiken Echtzeit-Dashboard:
 * - 9 KPI-Kacheln mit Ampel-Farbkodierung
 * - Stundenverlauf-Chart (Bestellungen, umschaltbar auf Umsatz)
 * - Top-3 Zonen mit Balkendiagramm
 * - Alert-Strip bei kritischen Werten
 * - Fahrer-Effizienz-Übersicht (kompakt)
 * - 2-Min-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle, Euro, Star, Clock, Truck, Loader2 } from 'lucide-react';

interface KpiTile {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: 'good' | 'warn' | 'bad';
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
  thresholds: { warn: number; bad: number };
  higherIsBetter: boolean;
}

interface HourSlot {
  hour: number;
  label: string;
  orders: number;
  revenue: number;
}

interface ZoneStats {
  zone: string;
  orders: number;
  revenue: number;
  avgTime: number;
}

interface DriverOverview {
  name: string;
  score: number;
  deliveries: number;
  onTimePct: number;
}

interface ApiResponse {
  kpis: KpiTile[];
  hourly: HourSlot[];
  zones: ZoneStats[];
  drivers: DriverOverview[];
  alerts: { key: string; message: string; level: 'warn' | 'bad' }[];
}

const MOCK: ApiResponse = {
  kpis: [
    { key: 'revenue',   label: 'Umsatz',          value: 2143,  unit: '€',   status: 'good', trend: 'up',   trendPct: 15, thresholds: { warn: 500,  bad: 200  }, higherIsBetter: true },
    { key: 'orders',    label: 'Bestellungen',     value: 71,    unit: '',    status: 'good', trend: 'up',   trendPct: 9,  thresholds: { warn: 15,   bad: 5    }, higherIsBetter: true },
    { key: 'delivtime', label: 'Ø Lieferzeit',     value: 32,    unit: 'Min', status: 'good', trend: 'down', trendPct: 4,  thresholds: { warn: 40,   bad: 55   }, higherIsBetter: false },
    { key: 'ontime',    label: 'Pünktlichkeit',    value: 86,    unit: '%',   status: 'good', trend: 'up',   trendPct: 2,  thresholds: { warn: 75,   bad: 60   }, higherIsBetter: true },
    { key: 'cancel',    label: 'Stornoquote',      value: 3.1,   unit: '%',   status: 'good', trend: 'down', trendPct: 1,  thresholds: { warn: 8,    bad: 15   }, higherIsBetter: false },
    { key: 'aov',       label: '⌀ Bestellwert',    value: 30.18, unit: '€',   status: 'good', trend: 'up',   trendPct: 3,  thresholds: { warn: 15,   bad: 10   }, higherIsBetter: true },
    { key: 'drivers',   label: 'Fahrer aktiv',     value: 7,     unit: '',    status: 'good', trend: 'flat', trendPct: 0,  thresholds: { warn: 2,    bad: 1    }, higherIsBetter: true },
    { key: 'rating',    label: 'Ø Bewertung',      value: 4.7,   unit: '★',   status: 'good', trend: 'flat', trendPct: 0,  thresholds: { warn: 3.5,  bad: 2.5  }, higherIsBetter: true },
    { key: 'tip',       label: 'Ø Trinkgeld',      value: 2.45,  unit: '€',   status: 'warn', trend: 'down', trendPct: 5,  thresholds: { warn: 2,    bad: 0.5  }, higherIsBetter: true },
  ],
  hourly: [
    { hour: 11, label: '11h', orders: 3,  revenue: 89  },
    { hour: 12, label: '12h', orders: 11, revenue: 324 },
    { hour: 13, label: '13h', orders: 14, revenue: 412 },
    { hour: 14, label: '14h', orders: 9,  revenue: 271 },
    { hour: 17, label: '17h', orders: 7,  revenue: 210 },
    { hour: 18, label: '18h', orders: 13, revenue: 389 },
    { hour: 19, label: '19h', orders: 14, revenue: 448 },
  ],
  zones: [
    { zone: 'A', orders: 28, revenue: 841,  avgTime: 29 },
    { zone: 'B', orders: 22, revenue: 664,  avgTime: 34 },
    { zone: 'C', orders: 21, revenue: 638,  avgTime: 32 },
  ],
  drivers: [
    { name: 'Max M.',  score: 94, deliveries: 18, onTimePct: 97 },
    { name: 'Anna S.', score: 82, deliveries: 14, onTimePct: 86 },
    { name: 'Tom R.',  score: 71, deliveries: 12, onTimePct: 77 },
    { name: 'Lisa K.', score: 55, deliveries: 10, onTimePct: 62 },
  ],
  alerts: [],
};

function tileColors(tile: KpiTile): { bg: string; text: string; border: string } {
  switch (tile.status) {
    case 'bad':  return { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    };
    case 'warn': return { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  };
    default:     return { bg: 'bg-matcha-50', text: 'text-matcha-700', border: 'border-matcha-200' };
  }
}

function TrendIcon({ trend }: { trend: KpiTile['trend'] }) {
  if (trend === 'up')   return <TrendingUp className="h-3 w-3" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function scoreCol(s: number): string {
  if (s >= 80) return 'text-matcha-600';
  if (s >= 65) return 'text-amber-600';
  return 'text-red-600';
}

export function LieferdienstPhase2565StatistikenHeuteFinal() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [chartMode, setChartMode] = useState<'orders' | 'revenue'>('orders');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/lieferdienst/statistiken-heute');
      if (res.ok) setData(await res.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 120_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const maxVal = Math.max(...data.hourly.map(h => chartMode === 'orders' ? h.orders : h.revenue), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider">Statistiken Heute Final</span>
        <span className="text-[10px] text-muted-foreground ml-1">Phase 2565</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1 text-muted-foreground" />}
        <span className="ml-auto text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t space-y-4 p-4">
          {/* Alert strip */}
          {data.alerts.length > 0 && (
            <div className="space-y-1">
              {data.alerts.map(a => (
                <div key={a.key} className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold',
                  a.level === 'bad' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                )}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {a.message}
                </div>
              ))}
            </div>
          )}

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {data.kpis.map(tile => {
              const c = tileColors(tile);
              const trendOk = tile.higherIsBetter
                ? tile.trend === 'up'
                : tile.trend === 'down';
              return (
                <div key={tile.key} className={cn('rounded-xl border p-2.5', c.bg, c.border)}>
                  <div className={cn('text-lg font-black leading-none tabular-nums', c.text)}>
                    {tile.value.toFixed(tile.unit === '€' || tile.unit === '★' ? (tile.value < 10 ? 2 : 0) : 0)}{tile.unit}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{tile.label}</div>
                  {tile.trendPct > 0 && (
                    <div className={cn('mt-1 flex items-center gap-0.5 text-[9px]', trendOk ? 'text-matcha-600' : 'text-red-600')}>
                      <TrendIcon trend={tile.trend} />
                      {tile.trendPct}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hourly chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stundenverlauf</span>
              <div className="flex rounded-lg border overflow-hidden text-[10px]">
                {(['orders', 'revenue'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={cn(
                      'px-2 py-1 font-bold transition',
                      chartMode === m ? 'bg-matcha-600 text-white' : 'hover:bg-muted/40',
                    )}
                  >
                    {m === 'orders' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {data.hourly.map(h => {
                const val = chartMode === 'orders' ? h.orders : h.revenue;
                const pct = (val / maxVal) * 100;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 64 }}>
                      <div
                        className="w-full rounded-t-sm bg-matcha-500 min-h-[2px]"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{h.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zones */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Zonen</div>
            <div className="space-y-1.5">
              {data.zones.map((z, i) => {
                const maxRev = data.zones[0]?.revenue ?? 1;
                return (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[11px] font-bold">Zone {z.zone}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-matcha-500 rounded-full"
                        style={{ width: `${(z.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums w-16 text-right">{z.revenue} €</span>
                    <span className="text-[9px] text-muted-foreground w-12 text-right">{z.orders} Bst.</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drivers compact */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fahrer-Übersicht</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {data.drivers.map(d => (
                <div key={d.name} className="rounded-lg border bg-muted/30 px-2.5 py-2">
                  <div className="text-[11px] font-bold truncate">{d.name}</div>
                  <div className={cn('font-black text-base tabular-nums', scoreCol(d.score))}>{d.score}</div>
                  <div className="text-[9px] text-muted-foreground">{d.deliveries} Liefer. · {d.onTimePct}% pünktl.</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
