'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, Bike, Clock, Star, TrendingUp, Package } from 'lucide-react';

/**
 * Phase 1006 — Statistiken Komplett-Dashboard (Lieferdienst)
 *
 * Übersicht aller wichtigen Tages-KPIs in einem kompakten Dashboard:
 * Bestellungen, Umsatz, Ø Lieferzeit, Kundenbewertung, aktive Fahrer, Stornoquote.
 * 5-Min-Polling.
 * GET /api/delivery/admin/overview
 */

interface OverviewData {
  bestellungen_heute: number;
  umsatz_heute_eur: number;
  avg_liefer_zeit_min: number | null;
  avg_bewertung: number | null;
  aktive_fahrer: number;
  storno_quote_pct: number | null;
}

const MOCK: OverviewData = {
  bestellungen_heute: 143,
  umsatz_heute_eur: 2847.50,
  avg_liefer_zeit_min: 28,
  avg_bewertung: 4.6,
  aktive_fahrer: 7,
  storno_quote_pct: 3.1,
};

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function KpiTile({ icon, label, value, sub, accent }: KpiTileProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className={cn('text-xl font-black leading-none', accent ?? 'text-foreground')}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase1006StatistikenKomplettDashboard({ className }: { className?: string }) {
  const [data, setData] = useState<OverviewData>(MOCK);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch('/api/delivery/admin/overview');
        if (r.ok && !cancelled) {
          const j = await r.json();
          if (j.bestellungen_heute != null || j.umsatz_heute_eur != null) {
            setData({ ...MOCK, ...j });
          }
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const bewertungsColor = data.avg_bewertung != null
    ? data.avg_bewertung >= 4.5
      ? 'text-green-600 dark:text-green-400'
      : data.avg_bewertung >= 4.0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'
    : undefined;

  const stornoColor = data.storno_quote_pct != null
    ? data.storno_quote_pct <= 3
      ? 'text-green-600 dark:text-green-400'
      : data.storno_quote_pct <= 7
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'
    : undefined;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-saffron" />
        <span className="text-sm font-bold">Statistiken — Heute</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <KpiTile
          icon={<Package className="h-3 w-3" />}
          label="Bestellungen"
          value={data.bestellungen_heute.toLocaleString('de-DE')}
          sub="heute gesamt"
          accent="text-foreground"
        />
        <KpiTile
          icon={<TrendingUp className="h-3 w-3" />}
          label="Umsatz"
          value={euro(data.umsatz_heute_eur)}
          sub="heute netto"
          accent="text-saffron"
        />
        <KpiTile
          icon={<Clock className="h-3 w-3" />}
          label="Ø Lieferzeit"
          value={data.avg_liefer_zeit_min != null ? `${data.avg_liefer_zeit_min} Min` : '–'}
          sub="Tages-Durchschnitt"
          accent={
            data.avg_liefer_zeit_min != null
              ? data.avg_liefer_zeit_min <= 30
                ? 'text-green-600 dark:text-green-400'
                : data.avg_liefer_zeit_min <= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'
              : undefined
          }
        />
        <KpiTile
          icon={<Star className="h-3 w-3" />}
          label="Kundenbewertung"
          value={data.avg_bewertung != null ? `${data.avg_bewertung.toFixed(1)} ★` : '–'}
          sub="Ø letzte 30 Tage"
          accent={bewertungsColor}
        />
        <KpiTile
          icon={<Bike className="h-3 w-3" />}
          label="Aktive Fahrer"
          value={String(data.aktive_fahrer)}
          sub="gerade im Einsatz"
          accent="text-blue-600 dark:text-blue-400"
        />
        <KpiTile
          icon={<BarChart3 className="h-3 w-3" />}
          label="Stornoquote"
          value={data.storno_quote_pct != null ? `${data.storno_quote_pct.toFixed(1)}%` : '–'}
          sub="heute"
          accent={stornoColor}
        />
      </div>
    </div>
  );
}
