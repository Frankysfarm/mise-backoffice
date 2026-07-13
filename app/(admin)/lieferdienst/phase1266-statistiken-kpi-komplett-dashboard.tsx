'use client';

// Phase 1266 — Statistiken KPI Komplett-Dashboard (Lieferdienst)
// Echtzeit-Kennzahlen: Umsatz, Bestellungen, Lieferzeit, Pünktlichkeit, Stornoquote + Trend vs. gestern
// GET /api/delivery/analytics/shift-stats?location_id=... (Fallback: Schätzwerte)

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Package, Clock, Euro, Target, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

type Trend = 'up' | 'down' | 'flat';

interface KpiData {
  umsatzHeute: number;
  umsatzGestern: number;
  bestellungenHeute: number;
  bestellungenGestern: number;
  avgLieferzeitMin: number;
  avgLieferzeitGesternMin: number;
  puenktlichkeitPct: number;
  puenktlichkeitGesternPct: number;
  stornoquotePct: number;
  stornoquoteGesternPct: number;
  bewertungAvg: number | null;
  aktiveFahrer: number;
}

// Fallback-Schätzwerte wenn keine API verfügbar
const MOCK: KpiData = {
  umsatzHeute: 0, umsatzGestern: 0,
  bestellungenHeute: 0, bestellungenGestern: 0,
  avgLieferzeitMin: 0, avgLieferzeitGesternMin: 0,
  puenktlichkeitPct: 0, puenktlichkeitGesternPct: 0,
  stornoquotePct: 0, stornoquoteGesternPct: 0,
  bewertungAvg: null, aktiveFahrer: 0,
};

function calcTrend(current: number, previous: number, lowerIsBetter = false): { trend: Trend; deltaPct: number } {
  if (previous === 0) return { trend: 'flat', deltaPct: 0 };
  const delta = ((current - previous) / previous) * 100;
  const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
  const trend: Trend = Math.abs(delta) < 2 ? 'flat' : isPositive ? 'up' : 'down';
  return { trend, deltaPct: Math.abs(delta) };
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

function TrendLabel({ trend, deltaPct }: { trend: Trend; deltaPct: number }) {
  const color = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400';
  const sign = trend === 'up' ? '+' : trend === 'down' ? '-' : '';
  return (
    <span className={cn('text-[9px] font-bold', color)}>
      {sign}{deltaPct.toFixed(1)}% vs. gestern
    </span>
  );
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function LieferdienstPhase1266StatistikKpiKomplettDashboard({ locationId }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);

    // Versuche mehrere mögliche API-Endpunkte
    const endpoints = [
      `/api/delivery/analytics/shift-stats?location_id=${locationId}`,
      `/api/lieferdienst/kpi?location_id=${locationId}`,
      `/api/delivery/eta/live?location_id=${locationId}`,
    ];

    Promise.allSettled(endpoints.map(url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)))
      .then(results => {
        const firstValid = results.find(r => r.status === 'fulfilled' && r.value != null);
        if (firstValid?.status === 'fulfilled' && firstValid.value) {
          const d = firstValid.value;
          setData({
            umsatzHeute: d.umsatz_heute ?? d.revenue_today ?? d.umsatz ?? 0,
            umsatzGestern: d.umsatz_gestern ?? d.revenue_yesterday ?? 0,
            bestellungenHeute: d.bestellungen_heute ?? d.orders_today ?? d.orders ?? 0,
            bestellungenGestern: d.bestellungen_gestern ?? d.orders_yesterday ?? 0,
            avgLieferzeitMin: d.avg_lieferzeit_min ?? d.avg_delivery_min ?? 0,
            avgLieferzeitGesternMin: d.avg_lieferzeit_gestern_min ?? 0,
            puenktlichkeitPct: d.puenktlichkeit_pct ?? d.on_time_pct ?? 0,
            puenktlichkeitGesternPct: d.puenktlichkeit_gestern_pct ?? 0,
            stornoquotePct: d.storno_quote_pct ?? d.cancel_rate_pct ?? 0,
            stornoquoteGesternPct: d.storno_quote_gestern_pct ?? 0,
            bewertungAvg: d.bewertung_avg ?? d.rating_avg ?? null,
            aktiveFahrer: d.aktive_fahrer ?? d.active_drivers ?? 0,
          });
        } else {
          setData(MOCK);
        }
      })
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    const iv = setInterval(() => {
      fetch(`/api/lieferdienst/data`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          setData(prev => {
            if (!prev) return prev;
            const orders = Array.isArray(d.orders) ? d.orders : [];
            const completed = orders.filter((o: any) =>
              ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status)
            );
            const cancelled = orders.filter((o: any) => o.status === 'storniert');
            const total = orders.length;
            const revenue = completed.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
            const drivers = Array.isArray(d.drivers) ? d.drivers : [];
            return {
              ...prev,
              umsatzHeute: revenue || prev.umsatzHeute,
              bestellungenHeute: completed.length || prev.bestellungenHeute,
              stornoquotePct: total > 0 ? (cancelled.length / total) * 100 : prev.stornoquotePct,
              aktiveFahrer: drivers.filter((dr: any) => dr.ist_online || dr.status === 'online').length || prev.aktiveFahrer,
            };
          });
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const d = data;

  const kpis = d ? [
    {
      icon: <Euro className="h-4 w-4" />,
      label: 'Umsatz heute',
      value: fmtEur(d.umsatzHeute),
      ...calcTrend(d.umsatzHeute, d.umsatzGestern),
      color: 'bg-matcha-50 border-matcha-200',
      iconColor: 'text-matcha-600 bg-matcha-100',
    },
    {
      icon: <Package className="h-4 w-4" />,
      label: 'Bestellungen',
      value: d.bestellungenHeute.toString(),
      ...calcTrend(d.bestellungenHeute, d.bestellungenGestern),
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600 bg-blue-100',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Ø Lieferzeit',
      value: d.avgLieferzeitMin > 0 ? `${Math.round(d.avgLieferzeitMin)} Min` : '—',
      ...calcTrend(d.avgLieferzeitMin, d.avgLieferzeitGesternMin, true),
      color: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600 bg-amber-100',
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: 'Pünktlichkeit',
      value: d.puenktlichkeitPct > 0 ? `${Math.round(d.puenktlichkeitPct)}%` : '—',
      ...calcTrend(d.puenktlichkeitPct, d.puenktlichkeitGesternPct),
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600 bg-purple-100',
    },
    {
      icon: <TrendingDown className="h-4 w-4" />,
      label: 'Stornoquote',
      value: d.stornoquotePct > 0 ? `${d.stornoquotePct.toFixed(1)}%` : '—',
      ...calcTrend(d.stornoquotePct, d.stornoquoteGesternPct, true),
      color: 'bg-red-50 border-red-200',
      iconColor: 'text-red-600 bg-red-100',
    },
    {
      icon: <Star className="h-4 w-4" />,
      label: 'Bewertung',
      value: d.bewertungAvg != null ? `${d.bewertungAvg.toFixed(1)} ★` : '—',
      trend: 'flat' as Trend,
      deltaPct: 0,
      color: 'bg-saffron-light/30 border-amber-200',
      iconColor: 'text-amber-600 bg-amber-100',
    },
  ] : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-matcha-100">
            <TrendingUp className="h-4 w-4 text-matcha-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-char">Statistiken — KPI Komplett-Dashboard</div>
            <div className="text-[10px] text-stone-400">Live-Kennzahlen mit Vortags-Vergleich</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 p-5">
          {loading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-100" />
              ))}
            </div>
          )}

          {!loading && kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {kpis.map(kpi => (
                <div key={kpi.label} className={cn('rounded-xl border p-3', kpi.color)}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', kpi.iconColor)}>
                      {kpi.icon}
                    </div>
                    <span className="text-[10px] font-semibold text-stone-500">{kpi.label}</span>
                  </div>
                  <div className="text-xl font-black text-char tabular-nums leading-none mb-1">
                    {kpi.value}
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={kpi.trend} />
                    <TrendLabel trend={kpi.trend} deltaPct={kpi.deltaPct} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active drivers + note */}
          {d && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
                <span className="text-sm font-semibold text-char">
                  {d.aktiveFahrer > 0 ? `${d.aktiveFahrer} Fahrer online` : 'Keine Fahrer online'}
                </span>
              </div>
              <span className="text-[10px] text-stone-400">Live · 30s Refresh</span>
            </div>
          )}

          {!loading && !d && (
            <div className="py-6 text-center text-sm text-stone-400">
              Keine Daten verfügbar — bitte Filiale auswählen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
