'use client';

/**
 * Phase 554 — Schicht-Ertrag-Cockpit
 *
 * Kompaktes Rentabilitäts-Dashboard für die laufende Schicht:
 * - Umsatz, Ø pro Lieferung, Trinkgeld, Storno-Verlust
 * - Geschätzte Kosten (Fahrerstunden × Stundensatz)
 * - Hochgerechneter Nettoertrag
 * - Echtzeit-Update alle 2 Minuten
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Euro, TrendingUp, Wallet, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ShiftStats {
  revenue:       number;
  orderCount:    number;
  tipTotal:      number;
  cancelledLoss: number;
  driverHours:   number;
}

const HOURLY_COST = 12.5;

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function KpiTile({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 border border-border p-3 space-y-0.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums">{value}</span>
        {up != null && (
          up
            ? <ArrowUpRight className="h-3.5 w-3.5 text-matcha-500" />
            : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
        )}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase554SchichtErtragCockpit({ locationId }: Props) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const [ordersRes, driversRes] = await Promise.all([
          supabase
            .from('customer_orders')
            .select('id, gesamtbetrag, status, trinkgeld')
            .eq('location_id', locationId)
            .gte('bestellt_am', today.toISOString()),
          supabase
            .from('driver_status')
            .select('id, ist_online, online_seit')
            .eq('ist_online', true),
        ]);

        if (!active) return;

        const orders = (ordersRes.data ?? []) as { id: string; gesamtbetrag: number; status: string; trinkgeld: number | null }[];
        const drivers = (driversRes.data ?? []) as { id: string; ist_online: boolean; online_seit: string | null }[];

        const delivered = orders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
        const cancelled = orders.filter(o => o.status === 'storniert');

        const revenue = delivered.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
        const tipTotal = delivered.reduce((s, o) => s + (o.trinkgeld ?? 0), 0);
        const cancelledLoss = cancelled.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

        const nowMs = Date.now();
        const driverHours = drivers.reduce((s, d) => {
          if (!d.online_seit) return s + 1;
          const h = (nowMs - new Date(d.online_seit).getTime()) / 3_600_000;
          return s + Math.min(Math.max(h, 0), 12);
        }, 0);

        setStats({ revenue, orderCount: delivered.length, tipTotal, cancelledLoss, driverHours });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => { active = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const estimatedCost = stats ? stats.driverHours * HOURLY_COST : 0;
  const netProfit     = stats ? stats.revenue + stats.tipTotal - estimatedCost : 0;
  const avgPerOrder   = stats && stats.orderCount > 0 ? stats.revenue / stats.orderCount : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Schicht-Ertrag-Cockpit
          </span>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!stats ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {loading ? 'Lade Schicht-Daten…' : 'Keine Daten verfügbar.'}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiTile
              label="Umsatz"
              value={fmtEur(stats.revenue)}
              sub={`${stats.orderCount} Lieferungen`}
              up={stats.revenue > 0}
            />
            <KpiTile
              label="Ø / Lieferung"
              value={fmtEur(avgPerOrder)}
              sub="Brutto"
            />
            <KpiTile
              label="Trinkgeld"
              value={fmtEur(stats.tipTotal)}
              sub="gesamt heute"
              up={stats.tipTotal > 0}
            />
            <KpiTile
              label="Storno-Verlust"
              value={fmtEur(stats.cancelledLoss)}
              sub="entgangener Umsatz"
              up={false}
            />
          </div>

          {/* Netto-Ertrag */}
          <div className={cn(
            'rounded-xl border p-4 flex items-center gap-4',
            netProfit >= 0 ? 'bg-matcha-50 border-matcha-200' : 'bg-red-50 border-red-200',
          )}>
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-black text-2xl',
              netProfit >= 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
            )}>
              {netProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Geschätzter Netto-Ertrag (Schicht)
              </div>
              <div className={cn('text-2xl font-black tabular-nums mt-0.5', netProfit >= 0 ? 'text-matcha-700' : 'text-red-700')}>
                {fmtEur(netProfit)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Umsatz {fmtEur(stats.revenue)} + Tip {fmtEur(stats.tipTotal)} − Fahrer {fmtEur(estimatedCost)}
                {' '}({stats.driverHours.toFixed(1)}h × {fmtEur(HOURLY_COST)}/h)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
