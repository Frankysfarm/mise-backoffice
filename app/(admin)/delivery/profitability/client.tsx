'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Euro, Package, BarChart2,
  Users, Lightbulb, RefreshCw, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface ProfitSnapshot {
  snapshotDate: string;
  totalOrders: number;
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
}

interface ZoneProfit {
  zone: string;
  orderCount: number;
  revenueEur: number;
  avgFeeEur: number;
  costEur: number;
  avgCostEur: number;
  profitEur: number;
  marginPct: number | null;
}

interface DriverProfit {
  driverId: string;
  driverName: string | null;
  deliveryCount: number;
  revenueEur: number;
  costEur: number;
  profitContributionEur: number;
  avgCostPerDelivery: number;
  avgDistanceKm: number;
}

interface HourlyProfit {
  hourOfDay: number;
  orderCount: number;
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
}

interface FeeRec {
  zone: string;
  currentAvgFeeEur: number;
  avgCostEur: number;
  marginPct: number | null;
  recommendedFeeEur: number;
  reasoning: string;
}

interface Dashboard {
  summary: {
    revenueEur: number;
    costEur: number;
    profitEur: number;
    marginPct: number | null;
    totalOrders: number;
    revenueYesterdayEur: number;
    profitYesterdayEur: number;
    revenueTrendPct: number | null;
    profitTrendPct: number | null;
  };
  trend: ProfitSnapshot[];
  zones: ZoneProfit[];
  drivers: DriverProfit[];
  hourly: HourlyProfit[];
  feeRecommendations: FeeRec[];
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function eur(val: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

function pct(val: number | null, fallback = '—') {
  return val !== null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : fallback;
}

function TrendIcon({ val }: { val: number | null }) {
  if (val === null) return <Minus className="w-4 h-4 text-gray-400" />;
  if (val > 0)  return <TrendingUp  className="w-4 h-4 text-green-500" />;
  if (val < 0)  return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function marginColor(m: number | null): string {
  if (m === null) return 'text-gray-400';
  if (m >= 35)   return 'text-green-600';
  if (m >= 15)   return 'text-amber-600';
  return 'text-red-600';
}

function zoneColor(zone: string): string {
  const map: Record<string, string> = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-amber-100 text-amber-800',
    D: 'bg-red-100 text-red-800',
    home: 'bg-purple-100 text-purple-800',
  };
  return map[zone] ?? 'bg-gray-100 text-gray-700';
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// ── Komponenten ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) {
  const trendColor = trend === null || trend === undefined
    ? 'text-gray-400'
    : trend > 0
      ? positive !== false ? 'text-green-600' : 'text-red-600'
      : trend < 0
        ? positive !== false ? 'text-red-600' : 'text-green-600'
        : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-1 mt-1">
          {trend !== undefined && <TrendIcon val={trend ?? null} />}
          {sub && <span className={cn('text-xs', trendColor)}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// Einfaches Tages-Verlaufs-Diagramm (SVG-Spark)
function TrendSparkline({ data }: { data: ProfitSnapshot[] }) {
  if (data.length < 2) return null;

  const W = 560; const H = 80;
  const maxP = Math.max(...data.map((d) => d.profitEur));
  const minP = Math.min(...data.map((d) => d.profitEur));
  const range = maxP - minP || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.profitEur - minP) / range) * (H - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  // Zero-line
  const zeroY = H - ((0 - minP) / range) * (H - 10) - 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      {minP < 0 && (
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" opacity={0.4} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Stundenkarte — Balkendiagramm
function HourlyChart({ data }: { data: HourlyProfit[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-6">Keine Stunden-Daten</p>;

  const maxProfit = Math.max(...data.map((d) => Math.abs(d.profitEur)), 1);

  return (
    <div className="flex items-end gap-0.5 h-24 w-full">
      {Array.from({ length: 24 }, (_, h) => {
        const slot = data.find((d) => d.hourOfDay === h);
        const profit = slot?.profitEur ?? 0;
        const heightPct = Math.abs(profit) / maxProfit * 100;
        const isPos = profit >= 0;
        return (
          <div key={h} className="flex-1 flex flex-col items-center justify-end gap-0 group relative">
            <div
              className={cn('w-full rounded-t-sm transition-all', isPos ? 'bg-green-400' : 'bg-red-400')}
              style={{ height: `${Math.max(heightPct, 2)}%` }}
            />
            {/* Tooltip */}
            {slot && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap pointer-events-none">
                {HOUR_LABELS[h]}: {eur(profit)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────

export function ProfitabilityClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [tab, setTab]         = useState<'zones' | 'drivers' | 'fees'>('zones');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/profitability');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as Dashboard;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerSnapshot = async () => {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/profitability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Lade Profitabilitäts-Daten…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const { summary, trend, zones, drivers, hourly, feeRecommendations } = data;

  const unrecommendedZones = feeRecommendations.filter(
    (r) => r.marginPct !== null && r.marginPct < 35,
  );

  return (
    <div className="space-y-6 pb-10">

      {/* Aktions-Leiste */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Zeitraum: letzte 30 Tage</p>
        <div className="flex gap-2">
          <button
            onClick={triggerSnapshot}
            disabled={snapping}
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', snapping && 'animate-spin')} />
            Snapshot jetzt
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            <RefreshCw className="w-3 h-3" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Umsatz (30 Tage)"
          value={eur(summary.revenueEur)}
          sub={summary.revenueTrendPct !== null ? `${pct(summary.revenueTrendPct)} gg. Vortag` : undefined}
          trend={summary.revenueTrendPct}
          icon={Euro}
        />
        <KpiCard
          label="Kosten (30 Tage)"
          value={eur(summary.costEur)}
          icon={Users}
          positive={false}
        />
        <KpiCard
          label="Gewinn (30 Tage)"
          value={eur(summary.profitEur)}
          sub={summary.profitTrendPct !== null ? `${pct(summary.profitTrendPct)} gg. Vortag` : undefined}
          trend={summary.profitTrendPct}
          icon={TrendingUp}
        />
        <KpiCard
          label="Marge"
          value={summary.marginPct !== null ? `${summary.marginPct.toFixed(1)}%` : '—'}
          sub={`${summary.totalOrders} Lieferungen`}
          icon={BarChart2}
        />
      </div>

      {/* Gewinn-Sparkline */}
      {trend.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Gewinn-Verlauf (30 Tage)</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Gewinn</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-t-2 border-dashed border-red-400 inline-block" /> Nulllinie</span>
            </div>
          </div>
          <TrendSparkline data={trend} />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{trend[0]?.snapshotDate?.slice(5)}</span>
            <span>{trend[trend.length - 1]?.snapshotDate?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Tab-Bereich */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['zones', 'drivers', 'fees'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t === 'zones'   && 'Zonen-P&L'}
              {t === 'drivers' && 'Fahrer-Kosten'}
              {t === 'fees'    && `Gebühren-Empfehlungen${unrecommendedZones.length > 0 ? ` (${unrecommendedZones.length})` : ''}`}
            </button>
          ))}
        </div>

        <div className="p-4">

          {/* Zonen-Tabelle */}
          {tab === 'zones' && (
            zones.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Keine Zonen-Daten für die letzten 30 Tage.</p>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Zone</th>
                      <th className="text-right pb-2 font-medium">Bestellungen</th>
                      <th className="text-right pb-2 font-medium">Umsatz</th>
                      <th className="text-right pb-2 font-medium">Ø Gebühr</th>
                      <th className="text-right pb-2 font-medium">Kosten</th>
                      <th className="text-right pb-2 font-medium">Gewinn</th>
                      <th className="text-right pb-2 font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {zones.map((z) => (
                      <tr key={z.zone} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5">
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', zoneColor(z.zone))}>
                            Zone {z.zone}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-gray-700">{z.orderCount}</td>
                        <td className="py-2.5 text-right text-gray-700">{eur(z.revenueEur)}</td>
                        <td className="py-2.5 text-right text-gray-500">{eur(z.avgFeeEur)}</td>
                        <td className="py-2.5 text-right text-gray-700">{eur(z.costEur)}</td>
                        <td className={cn('py-2.5 text-right font-medium', z.profitEur >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {eur(z.profitEur)}
                        </td>
                        <td className={cn('py-2.5 text-right font-semibold', marginColor(z.marginPct))}>
                          {z.marginPct !== null ? `${z.marginPct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {/* Fahrer-Tabelle */}
          {tab === 'drivers' && (
            drivers.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Keine Fahrer-Daten für die letzten 30 Tage.</p>
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Fahrer</th>
                      <th className="text-right pb-2 font-medium">Lieferungen</th>
                      <th className="text-right pb-2 font-medium">Gebühren</th>
                      <th className="text-right pb-2 font-medium">Kosten</th>
                      <th className="text-right pb-2 font-medium">Ø Kosten/Lief.</th>
                      <th className="text-right pb-2 font-medium">Ø km</th>
                      <th className="text-right pb-2 font-medium">Beitrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {drivers.map((d) => (
                      <tr key={d.driverId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 font-medium text-gray-800">
                          {d.driverName ?? <span className="text-gray-400 text-xs">Unbekannt</span>}
                        </td>
                        <td className="py-2.5 text-right text-gray-700">{d.deliveryCount}</td>
                        <td className="py-2.5 text-right text-gray-700">{eur(d.revenueEur)}</td>
                        <td className="py-2.5 text-right text-gray-700">{eur(d.costEur)}</td>
                        <td className="py-2.5 text-right text-gray-500">{eur(d.avgCostPerDelivery)}</td>
                        <td className="py-2.5 text-right text-gray-500">{d.avgDistanceKm.toFixed(1)} km</td>
                        <td className={cn('py-2.5 text-right font-medium', d.profitContributionEur >= 0 ? 'text-green-600' : 'text-red-600')}>
                          {eur(d.profitContributionEur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {/* Gebühren-Empfehlungen */}
          {tab === 'fees' && (
            feeRecommendations.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Keine Zonen-Daten für Empfehlungen.</p>
              : (
                <div className="space-y-3">
                  {feeRecommendations.map((r) => {
                    const isHealthy = r.marginPct !== null && r.marginPct >= 35;
                    return (
                      <div
                        key={r.zone}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border',
                          isHealthy ? 'border-green-100 bg-green-50/50' : 'border-amber-100 bg-amber-50/50',
                        )}
                      >
                        {isHealthy
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          : <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', zoneColor(r.zone))}>
                              Zone {r.zone}
                            </span>
                            <span className="text-xs text-gray-500">
                              Aktuelle Gebühr: <strong>{eur(r.currentAvgFeeEur)}</strong>
                              {' · '}Ø Kosten: <strong>{eur(r.avgCostEur)}</strong>
                              {r.marginPct !== null && (
                                <> · Marge: <strong className={marginColor(r.marginPct)}>{r.marginPct.toFixed(1)}%</strong></>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{r.reasoning}</p>
                          {!isHealthy && (
                            <p className="text-xs text-amber-700 mt-1 font-medium">
                              → Empfohlene Mindestgebühr: {eur(r.recommendedFeeEur)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          )}
        </div>
      </div>

      {/* Stundenprofil */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Tagesstunden-Profil (Gewinn nach Uhrzeit)</h3>
        </div>
        <HourlyChart data={hourly} />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
        {hourly.length > 0 && (() => {
          const best = [...hourly].sort((a, b) => b.profitEur - a.profitEur)[0];
          const worst = [...hourly].sort((a, b) => a.profitEur - b.profitEur)[0];
          return (
            <div className="flex gap-4 mt-3">
              <div className="text-xs text-gray-500">
                <span className="text-green-600 font-semibold">Beste Stunde:</span>{' '}
                {HOUR_LABELS[best.hourOfDay]} · {eur(best.profitEur)} ({best.orderCount} Best.)
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-red-600 font-semibold">Schwächste:</span>{' '}
                {HOUR_LABELS[worst.hourOfDay]} · {eur(worst.profitEur)} ({worst.orderCount} Best.)
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tages-Tabelle */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tages-Verlauf</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Datum</th>
                  <th className="text-right pb-2 font-medium">Bestellungen</th>
                  <th className="text-right pb-2 font-medium">Umsatz</th>
                  <th className="text-right pb-2 font-medium">Kosten</th>
                  <th className="text-right pb-2 font-medium">Gewinn</th>
                  <th className="text-right pb-2 font-medium">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...trend].reverse().slice(0, 14).map((t) => (
                  <tr key={t.snapshotDate} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 text-gray-700">{t.snapshotDate}</td>
                    <td className="py-2 text-right text-gray-600">{t.totalOrders}</td>
                    <td className="py-2 text-right text-gray-700">{eur(t.revenueEur)}</td>
                    <td className="py-2 text-right text-gray-500">{eur(t.costEur)}</td>
                    <td className={cn('py-2 text-right font-medium', t.profitEur >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {eur(t.profitEur)}
                    </td>
                    <td className={cn('py-2 text-right font-semibold', marginColor(t.marginPct))}>
                      {t.marginPct !== null ? `${t.marginPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
