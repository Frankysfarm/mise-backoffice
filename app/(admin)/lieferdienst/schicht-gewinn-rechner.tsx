'use client';

/**
 * SchichtGewinnRechner — Echtzeit-Rentabilitätsrechner für die aktuelle Schicht.
 * Zeigt: Umsatz, Kosten (Fahrerlohn + Benzin + Fix), Deckungsbeitrag und Marge.
 * Aktualisiert alle 90 Sekunden.
 */

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Euro, Users, Bike, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftProfitData {
  revenueEur: number;
  deliveryFeeRevenueEur: number;
  driverCostEur: number;
  variableCostEur: number;
  fixedCostEur: number;
  totalCostEur: number;
  contributionEur: number;
  marginPct: number;
  orderCount: number;
  driverCount: number;
  costPerDelivery: number;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function KpiCard({ label, value, sub, color = 'text-foreground', bg = 'bg-card', trend }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border border-border p-3', bg)}>
      <div className={cn('text-lg font-black tabular-nums', color)}>{value}</div>
      <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</div>
      {(sub || trend) && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up'      && <TrendingUp   className="h-3 w-3 text-matcha-500" />}
          {trend === 'down'    && <TrendingDown  className="h-3 w-3 text-red-500" />}
          {trend === 'neutral' && <Minus         className="h-3 w-3 text-muted-foreground" />}
          {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

const MOCK: ShiftProfitData = {
  revenueEur:             842.50,
  deliveryFeeRevenueEur:  210.00,
  driverCostEur:          186.00,
  variableCostEur:         52.40,
  fixedCostEur:            35.00,
  totalCostEur:           273.40,
  contributionEur:        569.10,
  marginPct:               67.6,
  orderCount:              47,
  driverCount:              4,
  costPerDelivery:          5.82,
};

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function SchichtGewinnRechner({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ShiftProfitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/stats?action=shift_profit&location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.revenueEur !== undefined) {
          setData(d as ShiftProfitData);
          setLastUpdated(new Date());
        } else {
          setData(MOCK);
        }
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 90_000);
    return () => clearInterval(interval);
  }, [load]);

  const marginColor = data
    ? data.marginPct >= 60 ? 'text-matcha-700' : data.marginPct >= 40 ? 'text-amber-700' : 'text-red-700'
    : 'text-muted-foreground';
  const marginBg = data
    ? data.marginPct >= 60 ? 'bg-matcha-50' : data.marginPct >= 40 ? 'bg-amber-50' : 'bg-red-50'
    : 'bg-muted/30';

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition"
      >
        <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Rentabilität</span>
        {data && (
          <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold', marginBg, marginColor)}>
            {data.marginPct.toFixed(1)}% Marge
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); load(); }}
          className="ml-auto mr-1 rounded-lg p-1 hover:bg-muted transition"
          title="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && data && (
        <div className="border-t px-4 py-4 space-y-3">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiCard
              label="Umsatz (Schicht)"
              value={fmtEur(data.revenueEur)}
              color="text-foreground"
              trend="up"
            />
            <KpiCard
              label="Gesamtkosten"
              value={fmtEur(data.totalCostEur)}
              color="text-red-700"
              bg="bg-red-50"
              sub={`${data.driverCount} Fahrer`}
            />
            <KpiCard
              label="Deckungsbeitrag"
              value={fmtEur(data.contributionEur)}
              color="text-matcha-700"
              bg="bg-matcha-50"
            />
            <KpiCard
              label="Marge"
              value={`${data.marginPct.toFixed(1)}%`}
              color={marginColor}
              bg={marginBg}
              trend={data.marginPct >= 60 ? 'up' : data.marginPct >= 40 ? 'neutral' : 'down'}
            />
          </div>

          {/* Cost breakdown */}
          <div className="rounded-xl border border-border divide-y overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Fahrerlohn</span>
              </div>
              <span className="text-xs font-bold tabular-nums">{fmtEur(data.driverCostEur)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Variable Kosten (Sprit/KM)</span>
              </div>
              <span className="text-xs font-bold tabular-nums">{fmtEur(data.variableCostEur)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Fixkosten (Anteil)</span>
              </div>
              <span className="text-xs font-bold tabular-nums">{fmtEur(data.fixedCostEur)}</span>
            </div>
          </div>

          {/* Per-delivery stats */}
          <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              {data.orderCount} Lieferungen · Kosten je Lieferung
            </span>
            <span className="text-xs font-bold tabular-nums">{fmtEur(data.costPerDelivery)}</span>
          </div>

          {lastUpdated && (
            <div className="text-[9px] text-muted-foreground text-right">
              Aktualisiert: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}

      {open && !data && (
        <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          Keine Daten verfügbar.
        </div>
      )}
    </div>
  );
}
