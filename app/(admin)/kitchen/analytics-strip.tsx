'use client';

/**
 * KitchenAnalyticsStrip — kompakter Analytik-Streifen für die Küche.
 *
 * Zeigt heutige KPIs aus dem Delivery Analytics Dashboard:
 *   SLA-Einhaltung, ø Lieferzeit, Lieferrate, Stornoquote
 * + Δ vs. Vortag (grün/rot).
 *
 * Polling alle 5 Minuten auf /api/delivery/admin/analytics?action=dashboard.
 */

import { useEffect, useRef, useState } from 'react';
import { BarChart2, Clock, CheckCircle2, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsKpis {
  slaCompliancePct: number | null;
  avgDeliveryMin: number | null;
  deliveryRate: number | null;
  cancellationRate: number | null;
  slaComplianceDelta: number | null;
  avgDeliveryDelta: number | null;
}

function DeltaChip({ delta, invertColors }: { delta: number | null; invertColors?: boolean }) {
  if (delta == null) return null;
  const positive = delta >= 0;
  const good = invertColors ? !positive : positive;
  const Icon = delta > 0.5 ? TrendingUp : delta < -0.5 ? TrendingDown : Minus;
  return (
    <span className={cn(
      'ml-1 inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums',
      good ? 'text-matcha-600' : 'text-red-500',
    )}>
      <Icon className="h-2.5 w-2.5" />
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

function Kpi({ label, value, suffix, delta, invertColors }: {
  label: string; value: string | null; suffix?: string;
  delta?: number | null; invertColors?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5">
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-black tabular-nums text-foreground">
          {value ?? '—'}
        </span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
        {delta !== undefined && <DeltaChip delta={delta ?? null} invertColors={invertColors} />}
      </div>
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function KitchenAnalyticsStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<AnalyticsKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/analytics?action=dashboard&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.today) return;
        const today = json.today;
        const yesterday = (json.trend30 as Array<{ analyticsDate: string; slaCompliancePct: number | null; avgDeliveryMin: number | null }>)?.[0];
        const prevSla = yesterday?.slaCompliancePct ?? null;
        const prevMin = yesterday?.avgDeliveryMin ?? null;

        setData({
          slaCompliancePct: today.slaCompliancePct,
          avgDeliveryMin: today.avgDeliveryMin,
          deliveryRate: today.deliveryRate,
          cancellationRate: today.cancellationRate,
          slaComplianceDelta: (today.slaCompliancePct != null && prevSla != null)
            ? +(today.slaCompliancePct - prevSla).toFixed(1) : null,
          avgDeliveryDelta: (today.avgDeliveryMin != null && prevMin != null)
            ? +(today.avgDeliveryMin - prevMin).toFixed(1) : null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const sla = data?.slaCompliancePct;
  const slaColor = sla == null ? 'bg-muted/40' : sla >= 90 ? 'bg-matcha-50 border-matcha-200' : sla >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className={cn('flex items-center gap-1 rounded-xl border px-1 py-0.5 transition-colors', slaColor)}>
      <div className="flex items-center gap-1.5 px-2">
        <BarChart2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Analytics Heute
        </span>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-1 px-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Lade…</span>
        </div>
      )}

      {data && (
        <>
          <div className="h-7 w-px bg-border shrink-0" />
          <Kpi
            label="SLA"
            value={data.slaCompliancePct != null ? data.slaCompliancePct.toFixed(1) : null}
            suffix="%"
            delta={data.slaComplianceDelta}
          />
          <div className="h-7 w-px bg-border shrink-0" />
          <Kpi
            label="Ø Lieferzeit"
            value={data.avgDeliveryMin != null ? data.avgDeliveryMin.toFixed(0) : null}
            suffix=" Min"
            delta={data.avgDeliveryDelta != null ? -data.avgDeliveryDelta : null}
          />
          <div className="h-7 w-px bg-border shrink-0" />
          <Kpi label="Lieferrate" value={data.deliveryRate != null ? data.deliveryRate.toFixed(1) : null} suffix="%" />
          {data.cancellationRate != null && (
            <>
              <div className="h-7 w-px bg-border shrink-0" />
              <Kpi label="Storno" value={data.cancellationRate.toFixed(1)} suffix="%" invertColors />
            </>
          )}
        </>
      )}
    </div>
  );
}
