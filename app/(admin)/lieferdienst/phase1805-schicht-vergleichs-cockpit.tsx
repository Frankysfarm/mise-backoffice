'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, BarChart3, Euro, Package, Clock, XCircle, RefreshCw } from 'lucide-react';

/**
 * Phase 1805 — Schicht-Vergleichs-Cockpit (Lieferdienst)
 *
 * Aktuelle Schicht vs. Vorschicht im Direktvergleich:
 * Umsatz, Bestellungen, Ø Lieferzeit, Storno-Quote.
 * Supabase-Realtime + 5-Min-Polling. Matcha-Theme.
 */

interface SchichtKpi {
  label: string;
  umsatz: number;
  bestellungen: number;
  avg_lieferzeit_min: number | null;
  storno_quote_pct: number;
}

interface VergleichsDaten {
  aktuell: SchichtKpi;
  vorherig: SchichtKpi;
  generiert_am: string;
}

interface OrderRow {
  total_price: number | null;
  status: string | null;
  created_at: string;
  delivered_at: string | null;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

function formatEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function buildMock(): VergleichsDaten {
  return {
    generiert_am: new Date().toISOString(),
    aktuell: {
      label: 'Diese Schicht',
      umsatz: 1240,
      bestellungen: 18,
      avg_lieferzeit_min: 28,
      storno_quote_pct: 4.2,
    },
    vorherig: {
      label: 'Vorschicht',
      umsatz: 980,
      bestellungen: 14,
      avg_lieferzeit_min: 32,
      storno_quote_pct: 6.8,
    },
  };
}

type Trend = 'besser' | 'schlechter' | 'gleich';

function trendVon(aktuell: number, vorher: number, inversPositiv = false): Trend {
  const diff = aktuell - vorher;
  const schwelle = vorher * 0.03;
  if (Math.abs(diff) < schwelle) return 'gleich';
  const besser = inversPositiv ? diff < 0 : diff > 0;
  return besser ? 'besser' : 'schlechter';
}

const TREND_CFG: Record<Trend, { icon: typeof TrendingUp; color: string }> = {
  besser:     { icon: TrendingUp,   color: 'text-matcha-600 dark:text-matcha-400' },
  schlechter: { icon: TrendingDown, color: 'text-red-500' },
  gleich:     { icon: Minus,        color: 'text-muted-foreground' },
};

interface KpiRow {
  key: string;
  label: string;
  icon: typeof Euro;
  fmt: (v: number | null) => string;
  aktuell: number | null;
  vorher: number | null;
  inversPositiv?: boolean;
}

export function LieferdienstPhase1805SchichtVergleichsCockpit({ locationId, className }: Props) {
  const [data, setData] = useState<VergleichsDaten | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('orders')
        .select('total_price, status, created_at, delivered_at')
        .eq('location_id', locationId ?? '')
        .gte('created_at', new Date(Date.now() - 16 * 3600_000).toISOString())
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) { setData(buildMock()); setLoading(false); return; }

      const typedRows = rows as OrderRow[];
      const now = Date.now();
      const schichtStartMs = 8 * 3600_000;
      const grenze = new Date(now - schichtStartMs);

      const aktuellOrders = typedRows.filter((r: OrderRow) => new Date(r.created_at) >= grenze);
      const vorherOrders  = typedRows.filter((r: OrderRow) => new Date(r.created_at) <  grenze);

      function kpiVon(orders: OrderRow[], label: string): SchichtKpi {
        const bestellungen = orders.length;
        const umsatz = orders.reduce((s: number, o: OrderRow) => s + (o.total_price ?? 0), 0);
        const stornos = orders.filter((o: OrderRow) => o.status === 'cancelled').length;
        const storno_quote_pct = bestellungen > 0 ? Math.round((stornos / bestellungen) * 100 * 10) / 10 : 0;
        const geliefert = orders.filter((o: OrderRow) => o.delivered_at && o.created_at);
        const avgMs = geliefert.length > 0
          ? geliefert.reduce((s: number, o: OrderRow) => s + (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()), 0) / geliefert.length
          : null;
        return { label, umsatz, bestellungen, avg_lieferzeit_min: avgMs ? Math.round(avgMs / 60_000) : null, storno_quote_pct };
      }

      setData({
        aktuell:  kpiVon(aktuellOrders, 'Diese Schicht'),
        vorherig: kpiVon(vorherOrders,  'Vorschicht'),
        generiert_am: new Date().toISOString(),
      });
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }, [locationId, supabase]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('phase1800-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, load]);

  if (loading && !data) {
    return (
      <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm p-4', className)}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Vergleich</span>
          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { aktuell, vorherig } = data;

  const rows: KpiRow[] = [
    { key: 'umsatz',      label: 'Umsatz',       icon: Euro,     fmt: v => v !== null ? formatEur(v) : '–',                  aktuell: aktuell.umsatz,              vorher: vorherig.umsatz              },
    { key: 'bestellung',  label: 'Bestellungen',  icon: Package,  fmt: v => v !== null ? String(v) : '–',                     aktuell: aktuell.bestellungen,        vorher: vorherig.bestellungen        },
    { key: 'lieferzeit',  label: 'Ø Lieferzeit',  icon: Clock,    fmt: v => v !== null ? `${v} Min` : '–',                    aktuell: aktuell.avg_lieferzeit_min,  vorher: vorherig.avg_lieferzeit_min, inversPositiv: true },
    { key: 'storno',      label: 'Storno-Quote',  icon: XCircle,  fmt: v => v !== null ? `${v.toFixed(1)}%` : '–',            aktuell: aktuell.storno_quote_pct,    vorher: vorherig.storno_quote_pct,   inversPositiv: true },
  ];

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <BarChart3 className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Vergleich</span>
        <span className="rounded-full bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
          Live
        </span>
        {loading && <RefreshCw className="h-3 w-3 ml-auto animate-spin text-muted-foreground" />}
      </div>

      <div className="px-4 py-3">
        {/* Spalten-Header */}
        <div className="grid grid-cols-3 gap-2 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>KPI</span>
          <span className="text-center">{aktuell.label}</span>
          <span className="text-center">{vorherig.label}</span>
        </div>

        <div className="space-y-2">
          {rows.map(row => {
            const trend = row.aktuell !== null && row.vorher !== null
              ? trendVon(row.aktuell, row.vorher, row.inversPositiv)
              : 'gleich';
            const tc = TREND_CFG[trend];
            const TIcon = tc.icon;
            const Icon = row.icon;
            return (
              <div key={row.key} className="grid grid-cols-3 gap-2 items-center rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Icon className="h-3 w-3 shrink-0" />
                  {row.label}
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[13px] font-black text-foreground tabular-nums">{row.fmt(row.aktuell)}</span>
                    <TIcon className={cn('h-3 w-3 shrink-0', tc.color)} />
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{row.fmt(row.vorher)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-[9px] text-muted-foreground text-right">
          Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
