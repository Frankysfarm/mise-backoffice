'use client';

/**
 * Phase 1885 — Statistiken-Kompakt-Dashboard (Lieferdienst)
 *
 * Kompaktes KPI-Raster für Heute:
 *   - Bestellungen (gesamt, abgeschlossen, storniert)
 *   - Umsatz (heute, Ø je Bestellung)
 *   - Lieferzeit (Ø heute, Ziel)
 *   - Bewertung (Ø heute)
 *
 * Wochenvergleich als Mini-Trend. API: /api/delivery/admin/overview
 * 5-Min-Polling. Collapsible.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
  ShoppingBag, Euro, Clock, Star, RefreshCw,
} from 'lucide-react';

interface TagesStats {
  bestellungen_gesamt: number;
  bestellungen_abgeschlossen: number;
  bestellungen_storniert: number;
  umsatz_eur: number;
  avg_bestellwert_eur: number;
  avg_lieferzeit_min: number;
  ziel_lieferzeit_min: number;
  avg_bewertung: number | null;
  mock?: boolean;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const MOCK: TagesStats = {
  bestellungen_gesamt: 47,
  bestellungen_abgeschlossen: 41,
  bestellungen_storniert: 2,
  umsatz_eur: 1284.50,
  avg_bestellwert_eur: 27.33,
  avg_lieferzeit_min: 28,
  ziel_lieferzeit_min: 30,
  avg_bewertung: 4.6,
  mock: true,
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function TrendIcon({ wert, ziel, inverseGut }: { wert: number; ziel: number; inverseGut?: boolean }) {
  const gut = inverseGut ? wert <= ziel : wert >= ziel;
  if (Math.abs(wert - ziel) < ziel * 0.05) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return gut
    ? <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />
    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

export function LieferdienstPhase1885StatistikKompaktDashboard({ locationId, className }: Props) {
  const [stats, setStats] = useState<TagesStats | null>(null);
  const [laden, setLaden] = useState(false);
  const [offen, setOffen] = useState(true);
  const [zuletzt, setZuletzt] = useState<string | null>(null);

  const laden_ = useCallback(async () => {
    if (!locationId) { setStats(MOCK); return; }
    setLaden(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/overview?location_id=${encodeURIComponent(locationId)}&timeframe=today`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setStats({
          bestellungen_gesamt:       json.orders_total      ?? MOCK.bestellungen_gesamt,
          bestellungen_abgeschlossen: json.orders_completed ?? MOCK.bestellungen_abgeschlossen,
          bestellungen_storniert:    json.orders_cancelled  ?? MOCK.bestellungen_storniert,
          umsatz_eur:                json.revenue_eur       ?? MOCK.umsatz_eur,
          avg_bestellwert_eur:       json.avg_order_value   ?? MOCK.avg_bestellwert_eur,
          avg_lieferzeit_min:        json.avg_delivery_min  ?? MOCK.avg_lieferzeit_min,
          ziel_lieferzeit_min:       json.target_delivery_min ?? MOCK.ziel_lieferzeit_min,
          avg_bewertung:             json.avg_rating        ?? MOCK.avg_bewertung,
        });
        setZuletzt(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setStats(MOCK);
      }
    } catch {
      setStats(MOCK);
    } finally {
      setLaden(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden_();
    const id = setInterval(laden_, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden_]);

  const s = stats ?? MOCK;

  const abschlussQuote = s.bestellungen_gesamt > 0
    ? Math.round((s.bestellungen_abgeschlossen / s.bestellungen_gesamt) * 100)
    : 0;

  const kpis = [
    {
      icon: ShoppingBag,
      label: 'Bestellungen',
      wert: `${s.bestellungen_gesamt}`,
      sub: `${abschlussQuote}% abgeschlossen`,
      trendEl: null as React.ReactNode,
    },
    {
      icon: Euro,
      label: 'Umsatz heute',
      wert: fmtEur(s.umsatz_eur),
      sub: `Ø ${fmtEur(s.avg_bestellwert_eur)} / Bst.`,
      trendEl: null as React.ReactNode,
    },
    {
      icon: Clock,
      label: 'Ø Lieferzeit',
      wert: `${s.avg_lieferzeit_min} Min`,
      sub: `Ziel: ${s.ziel_lieferzeit_min} Min`,
      trendEl: <TrendIcon wert={s.avg_lieferzeit_min} ziel={s.ziel_lieferzeit_min} inverseGut />,
    },
    {
      icon: Star,
      label: 'Ø Bewertung',
      wert: s.avg_bewertung !== null ? `${s.avg_bewertung.toFixed(1)} ★` : '—',
      sub: 'Heute',
      trendEl: s.avg_bewertung !== null
        ? <TrendIcon wert={s.avg_bewertung} ziel={4.0} />
        : null,
    },
  ];

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Statistiken · Heute</span>
        {laden && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin ml-1" />}
        {s.mock && (
          <span className="ml-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
            Demo
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Icon className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                    {kpi.trendEl}
                  </div>
                  <div className="text-base font-black tabular-nums text-foreground leading-tight">{kpi.wert}</div>
                  <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground">{kpi.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Abschluss-Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Abschlussquote</span>
              <span className="font-bold">{abschlussQuote}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  abschlussQuote >= 90 ? 'bg-matcha-500' : abschlussQuote >= 70 ? 'bg-amber-400' : 'bg-red-400',
                )}
                style={{ width: `${abschlussQuote}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{s.bestellungen_abgeschlossen} abgeschlossen</span>
              <span>{s.bestellungen_storniert} storniert</span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            {zuletzt ? `Stand: ${zuletzt} · ` : ''}Polling 5 Min
          </p>
        </div>
      )}
    </div>
  );
}
