'use client';

/**
 * Phase 567 — Lieferdienst: Schicht-KPI-Live-Panel
 *
 * Kompaktes Echtzeit-Dashboard mit den 6 wichtigsten Schicht-KPIs.
 * Polling 60s. Mock-Daten als Fallback wenn API nicht verfügbar.
 *
 * KPIs:
 *   1. Bestellungen heute        (mit Vergleich zu gestern)
 *   2. Ø Zubereitungszeit        (Min, Ziel 15 Min)
 *   3. Pünktlichkeitsquote       (%, Ziel 90%)
 *   4. Aktive Fahrer             (von insgesamt verfügbaren)
 *   5. Umsatz heute              (€)
 *   6. Storno-Rate               (%, Ziel < 3%)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Activity, RefreshCw } from 'lucide-react';
import { euro } from '@/lib/utils';

interface ShiftKpi {
  ordersToday: number;
  ordersYesterday: number;
  avgPrepMin: number;
  punctualityPct: number;
  activeDrivers: number;
  totalDrivers: number;
  revenueToday: number;
  cancelRatePct: number;
}

interface Props {
  locationId: string | null;
}

function kpiStatus(value: number, target: number, invert = false): 'good' | 'warn' | 'bad' {
  const ratio = invert ? target / Math.max(value, 0.01) : value / target;
  if (ratio >= 0.9) return 'good';
  if (ratio >= 0.7) return 'warn';
  return 'bad';
}

const STATUS_COLORS: Record<'good' | 'warn' | 'bad', string> = {
  good: 'text-matcha-700',
  warn: 'text-amber-600',
  bad:  'text-red-600',
};

const STATUS_BG: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-matcha-50 border-matcha-200',
  warn: 'bg-amber-50 border-amber-200',
  bad:  'bg-red-50 border-red-200',
};

export function LieferdienstPhase567SchichtKpiLivePanel({ locationId }: Props) {
  const [kpi, setKpi]       = useState<ShiftKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const [statsRes, shiftsRes] = await Promise.all([
        fetch(`/api/delivery/stats?location_id=${locationId}&period=today`, { cache: 'no-store' }),
        fetch(`/api/delivery/shifts?location_id=${locationId}&active=true`, { cache: 'no-store' }),
      ]);

      let data: Partial<ShiftKpi> = {};

      if (statsRes.ok) {
        const s = await statsRes.json();
        data.ordersToday    = s.orders_today  ?? s.total_orders     ?? 0;
        data.ordersYesterday= s.orders_yesterday ?? 0;
        data.avgPrepMin     = s.avg_prep_min   ?? s.avg_prep_time_min ?? 0;
        data.punctualityPct = (s.on_time_rate  ?? s.punctuality_pct  ?? 0) * (s.on_time_rate > 1 ? 1 : 100);
        data.revenueToday   = s.revenue_today  ?? s.total_revenue     ?? 0;
        data.cancelRatePct  = (s.cancel_rate   ?? s.storno_rate       ?? 0) * (s.cancel_rate > 1 ? 1 : 100);
      }

      if (shiftsRes.ok) {
        const d = await shiftsRes.json();
        data.activeDrivers = d.active_count   ?? d.active_drivers ?? 0;
        data.totalDrivers  = d.total_drivers  ?? d.total_count    ?? 0;
      }

      // Fill mock if critical fields missing
      if (data.ordersToday === undefined) {
        data = {
          ordersToday: 0, ordersYesterday: 0,
          avgPrepMin: 0, punctualityPct: 0,
          activeDrivers: 0, totalDrivers: 0,
          revenueToday: 0, cancelRatePct: 0,
        };
      }

      setKpi(data as ShiftKpi);
      setLastUpdate(new Date());
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const kpis = kpi ? [
    {
      label:  'Bestellungen',
      value:  kpi.ordersToday.toString(),
      sub:    kpi.ordersYesterday > 0
                ? `${kpi.ordersToday >= kpi.ordersYesterday ? '+' : ''}${kpi.ordersToday - kpi.ordersYesterday} vs. gestern`
                : 'heute',
      status: 'good' as const,
    },
    {
      label:  'Ø Prepzeit',
      value:  kpi.avgPrepMin > 0 ? `${kpi.avgPrepMin.toFixed(1)}m` : '—',
      sub:    'Ziel: 15 Min',
      status: kpi.avgPrepMin === 0 ? 'good' as const : kpiStatus(15, kpi.avgPrepMin),
    },
    {
      label:  'Pünktlichkeit',
      value:  kpi.punctualityPct > 0 ? `${Math.round(kpi.punctualityPct)}%` : '—',
      sub:    'Ziel: 90%',
      status: kpi.punctualityPct === 0 ? 'good' as const : kpiStatus(kpi.punctualityPct, 90),
    },
    {
      label:  'Fahrer',
      value:  kpi.activeDrivers > 0 || kpi.totalDrivers > 0
                ? `${kpi.activeDrivers}/${kpi.totalDrivers}`
                : '—',
      sub:    'aktiv/gesamt',
      status: kpi.totalDrivers === 0 ? 'good' as const
              : kpiStatus(kpi.activeDrivers, kpi.totalDrivers),
    },
    {
      label:  'Umsatz',
      value:  kpi.revenueToday > 0 ? euro(kpi.revenueToday) : '—',
      sub:    'heute',
      status: 'good' as const,
    },
    {
      label:  'Storno-Rate',
      value:  kpi.cancelRatePct > 0 ? `${kpi.cancelRatePct.toFixed(1)}%` : '—',
      sub:    'Ziel: < 3%',
      status: kpi.cancelRatePct === 0 ? 'good' as const
              : kpi.cancelRatePct < 3 ? 'good' as const
              : kpi.cancelRatePct < 6 ? 'warn' as const
              : 'bad' as const,
    },
  ] : [];

  const badCount = kpis.filter(k => k.status === 'bad').length;

  return (
    <Card className={cn('overflow-hidden', badCount > 0 && 'border-red-200')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          badCount > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700',
        )}>
          <Activity className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Schicht-KPIs Live
            {badCount > 0 && (
              <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black">
                {badCount} unter Ziel
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {lastUpdate
              ? `Aktualisiert: ${lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Live-Schicht-Kennzahlen'}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Lade KPIs…
            </div>
          ) : !locationId ? (
            <div className="text-sm text-muted-foreground py-2">Bitte Filiale auswählen.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className={cn(
                    'rounded-xl border p-3 space-y-0.5',
                    STATUS_BG[k.status],
                  )}
                >
                  <div className={cn('text-xl font-black tabular-nums leading-none', STATUS_COLORS[k.status])}>
                    {k.value}
                  </div>
                  <div className="text-[10px] font-bold text-foreground">{k.label}</div>
                  <div className="text-[9px] text-muted-foreground">{k.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
