'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X, Printer, TrendingUp, Clock, Bike, Package, Star,
  CheckCircle2, AlertTriangle, BarChart3, Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Stats = {
  orders: { total: number; delivered: number; held: number; zone_breakdown: Record<string, number> };
  tours: { total: number; bundled_count: number; avg_distance_km: number | null; avg_eta_min: number | null };
  scoring: { avg_score: number | null; total_decisions: number };
  period?: { from: string; to: string };
  _fallback?: boolean;
};

type Satisfaction = {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  _fallback?: boolean;
} | null;

type LiveDriver = {
  id: string;
  name: string;
  state: string;
  active: boolean;
  total_deliveries: number;
} | null;

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
      <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-1">{label}</div>
      <div className={cn('text-2xl font-black tabular-nums leading-none', color ?? 'text-stone-800')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-stone-400 mt-1">{sub}</div>}
    </div>
  );
}

export function TagesabschlussModal({
  locationId,
  onClose,
}: {
  locationId: string | null;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction>(null);
  const [driverCount, setDriverCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const from = todayStart.toISOString();
    const to = now.toISOString();

    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/stats?location_id=${locationId}&from=${from}&to=${to}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`/api/delivery/admin/satisfaction?location_id=${locationId}&days=1`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`/api/delivery/admin/drivers?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([statsData, satisfactionData, driverData]) => {
      if (cancelled) return;
      if (statsData && !statsData._fallback) setStats(statsData);
      if (satisfactionData && !satisfactionData._fallback) setSatisfaction(satisfactionData);
      if (Array.isArray(driverData?.drivers)) setDriverCount(driverData.drivers.filter((d: { active?: boolean }) => d.active !== false).length);
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  function handlePrint() {
    window.print();
  }

  const deliveryRate = stats
    ? stats.orders.total > 0
      ? Math.round((stats.orders.delivered / stats.orders.total) * 100)
      : null
    : null;

  const topZone = stats
    ? Object.entries(stats.orders.zone_breakdown).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 print:hidden">
          <div>
            <h2 className="font-black text-lg text-stone-800">Tagesabschluss</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-stone-100 border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200 transition"
            >
              <Printer size={13} />
              Drucken
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center bg-stone-100 hover:bg-stone-200 transition"
              aria-label="Schließen"
            >
              <X size={15} className="text-stone-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={printRef} className="p-5 space-y-5">
          {/* Print header */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-black text-stone-800">Schichtbericht</h1>
            <p className="text-sm text-stone-500">
              {now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}{todayStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} –{' '}
              {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </p>
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-stone-400 text-sm">
              Daten werden geladen…
            </div>
          ) : (
            <>
              {/* KPI Grid */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2.5">
                  Bestellungen heute
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <KpiCard
                    label="Gesamt"
                    value={String(stats?.orders.total ?? 0)}
                    sub="eingegangen"
                    color="text-stone-800"
                  />
                  <KpiCard
                    label="Geliefert"
                    value={String(stats?.orders.delivered ?? 0)}
                    sub={deliveryRate !== null ? `${deliveryRate}% Quote` : undefined}
                    color={
                      deliveryRate === null ? 'text-stone-800'
                      : deliveryRate >= 90 ? 'text-emerald-700'
                      : deliveryRate >= 75 ? 'text-amber-700'
                      : 'text-red-700'
                    }
                  />
                  <KpiCard
                    label="Touren"
                    value={String(stats?.tours.total ?? 0)}
                    sub={stats?.tours.bundled_count ? `${stats.tours.bundled_count} gebündelt` : undefined}
                    color="text-blue-700"
                  />
                  <KpiCard
                    label="Ø ETA"
                    value={stats?.tours.avg_eta_min != null ? `${Math.round(stats.tours.avg_eta_min)} Min` : '—'}
                    sub="Lieferzeit"
                    color={
                      stats?.tours.avg_eta_min == null ? 'text-stone-400'
                      : stats.tours.avg_eta_min <= 30 ? 'text-emerald-700'
                      : stats.tours.avg_eta_min <= 45 ? 'text-amber-700'
                      : 'text-red-700'
                    }
                  />
                </div>
              </div>

              {/* Scoring + Satisfaction */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2.5">
                  Qualität
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <KpiCard
                    label="Ø Dispatch Score"
                    value={stats?.scoring.avg_score != null ? String(Math.round(stats.scoring.avg_score)) : '—'}
                    sub={stats?.scoring.total_decisions ? `${stats.scoring.total_decisions} Entscheid.` : undefined}
                    color={
                      stats?.scoring.avg_score == null ? 'text-stone-400'
                      : stats.scoring.avg_score >= 80 ? 'text-emerald-700'
                      : stats.scoring.avg_score >= 60 ? 'text-amber-700'
                      : 'text-red-700'
                    }
                  />
                  <KpiCard
                    label="Kundenbew."
                    value={satisfaction?.avgRating != null ? satisfaction.avgRating.toFixed(1) : '—'}
                    sub={satisfaction?.totalRatings ? `${satisfaction.totalRatings} Ratings` : 'Keine'}
                    color={
                      satisfaction?.avgRating == null ? 'text-stone-400'
                      : satisfaction.avgRating >= 4.5 ? 'text-emerald-700'
                      : satisfaction.avgRating >= 3.5 ? 'text-amber-700'
                      : 'text-red-700'
                    }
                  />
                  <KpiCard
                    label="Fahrer"
                    value={String(driverCount ?? '—')}
                    sub="aktiv heute"
                    color="text-blue-700"
                  />
                </div>
              </div>

              {/* Zone Breakdown */}
              {stats?.orders.zone_breakdown && Object.keys(stats.orders.zone_breakdown).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2.5">
                    Bestellungen nach Zone
                  </h3>
                  <div className="rounded-xl border border-stone-200 overflow-hidden">
                    {Object.entries(stats.orders.zone_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([zone, count], i) => {
                        const total = stats.orders.total || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div
                            key={zone}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5',
                              i > 0 && 'border-t border-stone-100',
                            )}
                          >
                            <span className="text-xs font-bold text-stone-700 w-16 shrink-0">Zone {zone}</span>
                            <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-black tabular-nums text-stone-600 w-16 text-right shrink-0">
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Summary line */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800">
                  <span className="font-bold">Schicht abgeschlossen.</span>{' '}
                  {stats?.orders.total ?? 0} Bestellungen verarbeitet
                  {stats?.orders.delivered != null && stats.orders.total > 0 && (
                    <>, {Math.round((stats.orders.delivered / stats.orders.total) * 100)}% erfolgreich geliefert</>
                  )}
                  {stats?.tours.avg_eta_min != null && (
                    <>, Ø {Math.round(stats.tours.avg_eta_min)} Min Lieferzeit</>
                  )}.
                </div>
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-stone-400 text-center">
                Erstellt am {now.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} Uhr
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
