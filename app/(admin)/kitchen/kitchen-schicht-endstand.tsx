'use client';

/**
 * KitchenSchichtEndstand — Schicht-Abschluss-Übersicht für die Küche.
 *
 * Zeigt kumulierte KPIs der aktuellen Schicht als kompakte Scorecard:
 *   Bestellungen gesamt · ø Zubereitungszeit · Pünktlichkeitsrate ·
 *   Beste Stunde · Stornoquote
 *
 * Öffnet sich per Toggle, Polling alle 5 Min auf /api/delivery/admin/analytics.
 */

import { useEffect, useState } from 'react';
import {
  ChevronDown, ChevronUp, Award, Clock, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Zap, Loader2, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ShiftStats = {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgPrepMin: number | null;
  onTimePct: number | null;
  bestHourLabel: string | null;
  bestHourOrders: number | null;
  throughputPerHour: number | null;
};

function StatTile({
  label, value, suffix, color, icon: Icon,
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-xl p-3', color ?? 'bg-muted/30')}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-black tabular-nums leading-none">
          {value ?? '—'}
        </span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function KitchenSchichtEndstand({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/analytics?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const today = json?.today;
        if (!today) return;

        const hourly: { hour: number; orders: number }[] = json?.hourly ?? [];
        const best = hourly.reduce<{ hour: number; orders: number } | null>((acc, h) => {
          if (!acc || h.orders > acc.orders) return h;
          return acc;
        }, null);

        const completed = today.totalOrders ?? 0;
        const cancelled = today.cancelledOrders ?? 0;
        const total = completed + cancelled;

        setData({
          totalOrders: total,
          completedOrders: completed,
          cancelledOrders: cancelled,
          avgPrepMin: today.avgPrepMin ?? today.avgDeliveryMin ?? null,
          onTimePct: today.slaCompliancePct ?? null,
          bestHourLabel: best ? `${best.hour}:00 – ${best.hour + 1}:00` : null,
          bestHourOrders: best?.orders ?? null,
          throughputPerHour: today.throughputPerHour ?? null,
        });
      } catch {
        // Kein Fehler anzeigen wenn API nicht verfügbar
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;

  const onTimePct = data?.onTimePct ?? null;
  const headerColor =
    onTimePct == null
      ? 'border-border'
      : onTimePct >= 90
      ? 'border-matcha-200 bg-matcha-50/40'
      : onTimePct >= 70
      ? 'border-amber-200 bg-amber-50/40'
      : 'border-red-200 bg-red-50/40';

  return (
    <div className={cn('rounded-xl border overflow-hidden transition-colors', headerColor)}>
      {/* Toggle Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-black/5 transition"
      >
        <Award className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-black uppercase tracking-wider text-foreground flex-1 text-left">
          Schicht-Endstand
        </span>
        {data && (
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold tabular-nums">
            {data.totalOrders} Aufträge
          </span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4">
          {loading && !data && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Schicht-Daten…
            </div>
          )}

          {data && (
            <>
              {/* KPI-Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatTile
                  label="Fertiggestellt"
                  value={data.completedOrders}
                  icon={CheckCircle2}
                  color="bg-matcha-50"
                />
                <StatTile
                  label="Storniert"
                  value={data.cancelledOrders}
                  icon={XCircle}
                  color={data.cancelledOrders > 0 ? 'bg-red-50' : 'bg-muted/20'}
                />
                <StatTile
                  label="Ø Zubereitungszeit"
                  value={data.avgPrepMin != null ? Math.round(data.avgPrepMin) : null}
                  suffix=" Min"
                  icon={Clock}
                  color={
                    data.avgPrepMin == null
                      ? 'bg-muted/20'
                      : data.avgPrepMin <= 15
                      ? 'bg-matcha-50'
                      : data.avgPrepMin <= 20
                      ? 'bg-amber-50'
                      : 'bg-red-50'
                  }
                />
                <StatTile
                  label="Pünktlichkeitsrate"
                  value={data.onTimePct != null ? `${Math.round(data.onTimePct)}` : null}
                  suffix="%"
                  icon={Target}
                  color={
                    data.onTimePct == null
                      ? 'bg-muted/20'
                      : data.onTimePct >= 90
                      ? 'bg-matcha-50'
                      : data.onTimePct >= 70
                      ? 'bg-amber-50'
                      : 'bg-red-50'
                  }
                />
                {data.throughputPerHour != null && (
                  <StatTile
                    label="Ø Orders/h"
                    value={data.throughputPerHour.toFixed(1)}
                    icon={Zap}
                    color="bg-blue-50"
                  />
                )}
                {data.bestHourLabel && data.bestHourOrders != null && (
                  <StatTile
                    label={`Beste Stunde: ${data.bestHourLabel}`}
                    value={data.bestHourOrders}
                    suffix=" Orders"
                    icon={TrendingUp}
                    color="bg-purple-50"
                  />
                )}
              </div>

              {/* Pünktlichkeits-Bar */}
              {data.onTimePct != null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Pünktlichkeit
                    </span>
                    <span className={cn(
                      'text-xs font-black tabular-nums',
                      data.onTimePct >= 90 ? 'text-matcha-700' :
                      data.onTimePct >= 70 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      {Math.round(data.onTimePct)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        data.onTimePct >= 90 ? 'bg-matcha-500' :
                        data.onTimePct >= 70 ? 'bg-amber-400' : 'bg-red-400',
                      )}
                      style={{ width: `${Math.min(100, data.onTimePct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-muted-foreground">0%</span>
                    <span className={cn(
                      'text-[9px] font-bold',
                      data.onTimePct >= 90 ? 'text-matcha-600' : 'text-muted-foreground',
                    )}>
                      Ziel: 90%
                    </span>
                    <span className="text-[9px] text-muted-foreground">100%</span>
                  </div>
                </div>
              )}

              {/* Schicht-Note */}
              <div className={cn(
                'rounded-xl border p-3 flex items-center gap-3',
                data.onTimePct == null ? 'border-border bg-muted/20' :
                data.onTimePct >= 90 ? 'border-matcha-200 bg-matcha-50' :
                data.onTimePct >= 70 ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50',
              )}>
                {data.onTimePct == null ? (
                  <TrendingDown className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : data.onTimePct >= 90 ? (
                  <TrendingUp className="h-5 w-5 text-matcha-600 shrink-0" />
                ) : data.onTimePct >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-amber-600 shrink-0" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-black text-foreground">
                    Schicht-Bewertung:{' '}
                    <span className={cn(
                      data.onTimePct == null ? 'text-muted-foreground' :
                      data.onTimePct >= 90 ? 'text-matcha-700' :
                      data.onTimePct >= 70 ? 'text-amber-700' : 'text-red-700',
                    )}>
                      {data.onTimePct == null ? 'Keine Daten' :
                       data.onTimePct >= 90 ? 'Ausgezeichnet 🏆' :
                       data.onTimePct >= 70 ? 'Gut' : 'Verbesserungsbedarf'}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {data.completedOrders} abgeschlossene Aufträge ·{' '}
                    {data.cancelledOrders > 0
                      ? `${data.cancelledOrders} Storno${data.cancelledOrders !== 1 ? 's' : ''}`
                      : 'Kein Storno'}
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && !data && (
            <div className="text-sm text-muted-foreground py-2">
              Keine Schicht-Daten verfügbar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
