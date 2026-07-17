'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, ArrowDown, ArrowUp, BarChart2, Bike, ChevronDown, ChevronUp,
  Clock, Euro, Package, Star, TrendingUp, Users,
} from 'lucide-react';

interface DayKpi {
  bestellungen_heute: number;
  umsatz_heute: number;
  avg_lieferzeit_min: number;
  kundenzufriedenheit: number;
  aktive_fahrer: number;
  abbruchrate_pct: number;
  vs_gestern: {
    bestellungen: number;
    umsatz: number;
    lieferzeit: number;
    zufriedenheit: number;
  };
  stunden_verlauf: { h: number; label: string; orders: number; umsatz: number }[];
}

const MOCK: DayKpi = {
  bestellungen_heute: 47,
  umsatz_heute: 1834.50,
  avg_lieferzeit_min: 28,
  kundenzufriedenheit: 4.6,
  aktive_fahrer: 4,
  abbruchrate_pct: 4.2,
  vs_gestern: {
    bestellungen: +12,
    umsatz: +8.3,
    lieferzeit: -2,
    zufriedenheit: +0.2,
  },
  stunden_verlauf: [
    { h: 10, label: '10 Uhr', orders: 3,  umsatz: 118 },
    { h: 11, label: '11 Uhr', orders: 5,  umsatz: 196 },
    { h: 12, label: '12 Uhr', orders: 12, umsatz: 472 },
    { h: 13, label: '13 Uhr', orders: 9,  umsatz: 351 },
    { h: 14, label: '14 Uhr', orders: 4,  umsatz: 156 },
    { h: 17, label: '17 Uhr', orders: 6,  umsatz: 234 },
    { h: 18, label: '18 Uhr', orders: 8,  umsatz: 308 },
  ],
};

const POLL_MS = 60_000;

function TrendBadge({ value, unit = '', invert = false }: { value: number; unit?: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[10px] font-bold rounded px-1 py-0.5',
      neutral ? 'text-muted-foreground' :
      positive ? 'text-matcha-700 bg-matcha-50 border border-matcha-200' :
                 'text-red-700 bg-red-50 border border-red-200',
    )}>
      {!neutral && (positive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
      {Math.abs(value)}{unit}
    </span>
  );
}

export function LieferdienstPhase2020StatistikenTagesKpiDashboard({
  locationId,
  className,
}: {
  locationId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DayKpi | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/bestellungen-heute?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: DayKpi = await res.json();
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

  const d = data ?? MOCK;
  const maxOrders = Math.max(...d.stunden_verlauf.map(h => h.orders), 1);
  const maxUmsatz = Math.max(...d.stunden_verlauf.map(h => h.umsatz), 1);

  const kpis = [
    {
      label: 'Bestellungen',
      value: d.bestellungen_heute,
      unit: '',
      icon: <Package className="h-4 w-4" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      trend: d.vs_gestern.bestellungen,
      trendUnit: '',
    },
    {
      label: 'Umsatz',
      value: `${d.umsatz_heute.toFixed(0)} €`,
      unit: '',
      icon: <Euro className="h-4 w-4" />,
      color: 'text-matcha-600',
      bg: 'bg-matcha-50',
      border: 'border-matcha-200',
      trend: d.vs_gestern.umsatz,
      trendUnit: '%',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${d.avg_lieferzeit_min} Min`,
      unit: '',
      icon: <Clock className="h-4 w-4" />,
      color: d.avg_lieferzeit_min > 40 ? 'text-red-600' : d.avg_lieferzeit_min > 30 ? 'text-amber-600' : 'text-matcha-600',
      bg: d.avg_lieferzeit_min > 40 ? 'bg-red-50' : d.avg_lieferzeit_min > 30 ? 'bg-amber-50' : 'bg-matcha-50',
      border: d.avg_lieferzeit_min > 40 ? 'border-red-200' : d.avg_lieferzeit_min > 30 ? 'border-amber-200' : 'border-matcha-200',
      trend: d.vs_gestern.lieferzeit,
      trendUnit: ' Min',
      trendInvert: true,
    },
    {
      label: 'Bewertung',
      value: d.kundenzufriedenheit.toFixed(1),
      unit: '★',
      icon: <Star className="h-4 w-4" />,
      color: d.kundenzufriedenheit >= 4.5 ? 'text-amber-600' : d.kundenzufriedenheit >= 4.0 ? 'text-matcha-600' : 'text-red-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      trend: d.vs_gestern.zufriedenheit,
      trendUnit: '',
    },
    {
      label: 'Fahrer online',
      value: d.aktive_fahrer,
      unit: '',
      icon: <Bike className="h-4 w-4" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      trend: null,
      trendUnit: '',
    },
    {
      label: 'Abbruchrate',
      value: `${d.abbruchrate_pct.toFixed(1)}%`,
      unit: '',
      icon: <Activity className="h-4 w-4" />,
      color: d.abbruchrate_pct > 8 ? 'text-red-600' : d.abbruchrate_pct > 4 ? 'text-amber-600' : 'text-matcha-600',
      bg: d.abbruchrate_pct > 8 ? 'bg-red-50' : d.abbruchrate_pct > 4 ? 'bg-amber-50' : 'bg-matcha-50',
      border: d.abbruchrate_pct > 8 ? 'border-red-200' : d.abbruchrate_pct > 4 ? 'border-amber-200' : 'border-matcha-200',
      trend: null,
      trendUnit: '',
    },
  ];

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
          Tages-Statistiken
          {loading && <span className="text-[10px] text-muted-foreground font-normal normal-case">aktualisiert…</span>}
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-matcha-100 text-matcha-700 border border-matcha-200 font-bold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {d.bestellungen_heute} Bestellungen heute
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpis.map((kpi, i) => (
              <div key={i} className={cn('rounded-xl border p-3 space-y-1', kpi.bg, kpi.border)}>
                <div className="flex items-center justify-between">
                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-white/60', kpi.color)}>
                    {kpi.icon}
                  </div>
                  {kpi.trend !== null && (
                    <TrendBadge value={kpi.trend} unit={kpi.trendUnit} invert={kpi.trendInvert} />
                  )}
                </div>
                <div className={cn('text-2xl font-black tabular-nums', kpi.color)}>
                  {kpi.value}{kpi.unit}
                </div>
                <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Stundenverlauf */}
          {d.stunden_verlauf.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Stundenverlauf — Bestellungen &amp; Umsatz
              </div>
              <div className="flex items-end gap-1.5 h-20">
                {d.stunden_verlauf.map(h => {
                  const orderH = Math.round((h.orders / maxOrders) * 100);
                  const umsatzH = Math.round((h.umsatz / maxUmsatz) * 100);
                  return (
                    <div key={h.h} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.label}: ${h.orders} Bestellungen, ${h.umsatz.toFixed(0)} €`}>
                      <div className="w-full flex gap-0.5 h-16 items-end">
                        <div
                          className="flex-1 rounded-t bg-blue-400"
                          style={{ height: `${orderH}%` }}
                        />
                        <div
                          className="flex-1 rounded-t bg-matcha-400"
                          style={{ height: `${umsatzH}%` }}
                        />
                      </div>
                      <div className="text-[8px] text-muted-foreground text-center">{h.h}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-400" />Bestellungen</div>
                <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-matcha-400" />Umsatz (€)</div>
              </div>
            </div>
          )}

          {/* Vs. Gestern Summary */}
          <div className="rounded-xl bg-muted/30 border border-border px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Vergleich vs. gestern</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Bestellungen', v: d.vs_gestern.bestellungen, u: '' },
                { label: 'Umsatz', v: d.vs_gestern.umsatz, u: '%' },
                { label: 'Lieferzeit', v: d.vs_gestern.lieferzeit, u: ' Min', inv: true },
                { label: 'Bewertung', v: d.vs_gestern.zufriedenheit, u: ' ★' },
              ].map(({ label, v, u, inv }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <TrendBadge value={v} unit={u} invert={inv} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
