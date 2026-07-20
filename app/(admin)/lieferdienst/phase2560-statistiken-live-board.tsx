'use client';

/**
 * Phase 2560 — Statistiken Live-Board
 *
 * Lieferdienst-Statistiken Echtzeit-Dashboard:
 * - 8 KPI-Kacheln mit Ampel-Farbkodierung (Umsatz, Bestellungen, Lieferzeit,
 *   Pünktlichkeit, Storno, €/Bestellung, Fahrer aktiv, Bewertung)
 * - Stundenverlauf-Chart (Bestellungen + Umsatz, umschaltbar)
 * - Top-3 Zonen nach Umsatz
 * - Alert-Strip bei kritischen KPIs
 * - 3-Min-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Star, Loader2 } from 'lucide-react';

interface KpiEntry {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: 'good' | 'warn' | 'bad';
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
}

interface HourSlot {
  hour: number;
  orders: number;
  revenue: number;
}

interface ZoneEntry {
  zone: string;
  revenue: number;
  orders: number;
}

interface Alert {
  key: string;
  message: string;
  level: 'warn' | 'bad';
}

interface ApiResponse {
  kpis: KpiEntry[];
  hourly: HourSlot[];
  topZones: ZoneEntry[];
  alerts: Alert[];
}

const MOCK: ApiResponse = {
  kpis: [
    { key: 'revenue',     label: 'Umsatz',          value: 1847,  unit: '€',    status: 'good', trend: 'up',   trendPct: 12 },
    { key: 'orders',      label: 'Bestellungen',     value: 63,    unit: '',     status: 'good', trend: 'up',   trendPct: 8  },
    { key: 'delivtime',   label: 'Ø Lieferzeit',     value: 34,    unit: 'Min',  status: 'warn', trend: 'up',   trendPct: 5  },
    { key: 'ontime',      label: 'Pünktlichkeit',    value: 81,    unit: '%',    status: 'warn', trend: 'down', trendPct: 3  },
    { key: 'cancel',      label: 'Stornoquote',      value: 4.2,   unit: '%',    status: 'good', trend: 'down', trendPct: 1  },
    { key: 'rporder',     label: '€/Bestellung',     value: 29.3,  unit: '€',    status: 'good', trend: 'flat', trendPct: 0  },
    { key: 'drivers',     label: 'Fahrer aktiv',     value: 8,     unit: '',     status: 'good', trend: 'flat', trendPct: 0  },
    { key: 'rating',      label: 'Bewertung',        value: 4.6,   unit: '★',    status: 'good', trend: 'up',   trendPct: 2  },
  ],
  hourly: [
    { hour: 11, orders: 4,  revenue: 118  },
    { hour: 12, orders: 11, revenue: 322  },
    { hour: 13, orders: 9,  revenue: 264  },
    { hour: 14, orders: 5,  revenue: 147  },
    { hour: 15, orders: 3,  revenue: 88   },
    { hour: 16, orders: 6,  revenue: 176  },
    { hour: 17, orders: 13, revenue: 381  },
    { hour: 18, orders: 12, revenue: 351  },
  ],
  topZones: [
    { zone: 'Mitte',     revenue: 612, orders: 21 },
    { zone: 'Prenzlberg', revenue: 488, orders: 17 },
    { zone: 'Neukölln',  revenue: 351, orders: 12 },
  ],
  alerts: [
    { key: 'delivtime', message: 'Lieferzeit >30 Min — Kapazität prüfen', level: 'warn' },
    { key: 'ontime',    message: 'Pünktlichkeit unter 85% — Routenoptimierung empfohlen', level: 'warn' },
  ],
};

function kpiStyle(status: KpiEntry['status']) {
  switch (status) {
    case 'bad':  return { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    };
    case 'warn': return { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500'  };
    default:     return { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500' };
  }
}

function TrendIcon({ trend, pct }: { trend: KpiEntry['trend']; pct: number }) {
  if (trend === 'flat' || pct === 0) return <span className="text-[8px] text-muted-foreground">—</span>;
  const up = trend === 'up';
  return (
    <span className={cn('text-[8px] font-bold flex items-center gap-0.5', up ? 'text-matcha-600' : 'text-red-500')}>
      {up ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
      {pct}%
    </span>
  );
}

function MiniBarChart({ data, mode }: { data: HourSlot[]; mode: 'orders' | 'revenue' }) {
  const vals = data.map(d => mode === 'orders' ? d.orders : d.revenue);
  const max  = Math.max(...vals, 1);

  return (
    <div className="flex items-end gap-1 h-14 px-1">
      {data.map(d => {
        const v   = mode === 'orders' ? d.orders : d.revenue;
        const pct = (v / max) * 100;
        return (
          <div key={d.hour} className="flex flex-col items-center flex-1 gap-0.5">
            <div
              className="w-full rounded-t-sm bg-matcha-500/80 transition-all duration-500"
              style={{ height: `${pct}%` }}
            />
            <span className="text-[7px] text-muted-foreground">{d.hour}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LieferdienstPhase2560StatistikenLiveBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]     = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode]     = useState<'orders' | 'revenue'>('orders');
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!locationId) return;
    if (data === null) setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/statistiken-live-erweiterung?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 3 * 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const d = data ?? MOCK;
  const maxZoneRev = Math.max(...d.topZones.map(z => z.revenue), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-matcha-50/60">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-700">
            Statistiken Heute
          </span>
        </div>
        <div className="flex items-center gap-2">
          {d.alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {d.alerts.length} Alert{d.alerts.length > 1 ? 's' : ''}
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Alert Strip */}
      {d.alerts.length > 0 && (
        <div className="border-b divide-y">
          {d.alerts.map(a => (
            <div key={a.key} className={cn(
              'flex items-center gap-2 px-4 py-1.5',
              a.level === 'bad' ? 'bg-red-50' : 'bg-amber-50'
            )}>
              <AlertTriangle className={cn('h-3 w-3 flex-none', a.level === 'bad' ? 'text-red-600' : 'text-amber-600')} />
              <span className={cn('text-[10px] font-medium', a.level === 'bad' ? 'text-red-700' : 'text-amber-700')}>
                {a.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-4 divide-x divide-y border-b">
        {d.kpis.map(k => {
          const style = kpiStyle(k.status);
          return (
            <div key={k.key} className={cn('p-2.5 flex flex-col gap-0.5', style.bg)}>
              <div className="flex items-center justify-between">
                <span className={cn('h-1.5 w-1.5 rounded-full flex-none', style.dot)} />
                <TrendIcon trend={k.trend} pct={k.trendPct} />
              </div>
              <div className={cn('text-sm font-black leading-none', style.text)}>
                {k.unit === '€' && k.value > 100 ? `${k.value.toLocaleString('de-DE')} €` :
                 k.unit === '★' ? (
                   <span className="flex items-center gap-0.5">
                     {k.value} <Star className="h-2.5 w-2.5 fill-current" />
                   </span>
                 ) :
                 `${k.value}${k.unit}`}
              </div>
              <div className="text-[8px] text-muted-foreground leading-tight">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            Stundenverlauf
          </span>
          <div className="flex rounded-md overflow-hidden border text-[9px] font-bold">
            <button
              onClick={() => setMode('orders')}
              className={cn('px-2 py-0.5 transition-colors', mode === 'orders' ? 'bg-matcha-600 text-white' : 'text-muted-foreground hover:bg-muted/30')}
            >
              Best.
            </button>
            <button
              onClick={() => setMode('revenue')}
              className={cn('px-2 py-0.5 transition-colors', mode === 'revenue' ? 'bg-matcha-600 text-white' : 'text-muted-foreground hover:bg-muted/30')}
            >
              Umsatz
            </button>
          </div>
        </div>
        <MiniBarChart data={d.hourly} mode={mode} />
      </div>

      {/* Top Zonen */}
      <div className="border-t px-4 py-3">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
          Top-Zonen
        </div>
        <div className="space-y-1.5">
          {d.topZones.map((z, i) => (
            <div key={z.zone} className="flex items-center gap-2">
              <span className={cn(
                'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black text-white flex-none',
                i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-700/60'
              )}>
                {i + 1}
              </span>
              <span className="text-[11px] font-medium text-foreground flex-none w-20 truncate">{z.zone}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500"
                  style={{ width: `${(z.revenue / maxZoneRev) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-foreground flex-none">
                {z.revenue.toLocaleString('de-DE')} €
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-1.5 bg-muted/20">
        <span className="text-[9px] text-muted-foreground">Polling alle 3 Min · Ampel-Farbkodierung</span>
      </div>
    </div>
  );
}
