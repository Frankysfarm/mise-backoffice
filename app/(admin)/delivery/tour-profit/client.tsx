'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Euro, Truck, RefreshCw,
  ChevronDown, ChevronUp, BarChart3, Users, Zap, Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface TourProfitItem {
  batchId: string;
  driverName: string | null;
  vehicle: string | null;
  zone: string | null;
  state: string;
  stopsTotal: number;
  stopsCompleted: number;
  startedAt: string | null;
  totalDistanceKm: number;
  totalEtaMin: number | null;
  revenueEur: number;
  costDriverTimeEur: number;
  costKmEur: number;
  costStopEur: number;
  costTotalEur: number;
  profitEur: number;
  marginPct: number;
}

interface SessionTotals {
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number;
  completedTours: number;
  activeTours: number;
}

interface LiveDashboard {
  activeTours: TourProfitItem[];
  sessionTotals: SessionTotals;
  generatedAt: string;
}

interface HistoryRow {
  id: string;
  snapshotDate: string;
  toursCompleted: number;
  deliveriesCount: number;
  totalRevenueEur: number;
  totalCostEur: number;
  totalProfitEur: number;
  marginPct: number | null;
  avgProfitPerTourEur: number | null;
  topDriverName: string | null;
  topDriverProfitEur: number | null;
}

interface DriverEntry {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  toursCount: number;
  deliveriesCount: number;
  totalDistanceKm: number;
  totalRevenueEur: number;
  totalCostEur: number;
  totalProfitEur: number;
  avgMarginPct: number | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${v.toFixed(2)}`;
}

function pct(v: number | null) {
  return v != null ? `${v.toFixed(1)}%` : '—';
}

function marginColor(m: number | null) {
  if (m == null) return 'text-stone-400';
  if (m >= 25) return 'text-emerald-600';
  if (m >= 10) return 'text-amber-600';
  return 'text-red-600';
}

function marginBadge(m: number | null) {
  if (m == null) return 'bg-stone-100 text-stone-500';
  if (m >= 25) return 'bg-emerald-100 text-emerald-700';
  if (m >= 10) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function vehicleLabel(v: string | null) {
  const MAP: Record<string, string> = {
    bike: '🚲', car: '🚗', ebike: '⚡', scooter: '🛵', moped: '🛵',
  };
  return (v && MAP[v]) ? `${MAP[v]} ${v}` : v ?? '—';
}

function zoneColor(z: string | null) {
  const MAP: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700',
    B: 'bg-blue-100 text-blue-700',
    C: 'bg-amber-100 text-amber-700',
    D: 'bg-red-100 text-red-700',
  };
  return z ? (MAP[z] ?? 'bg-stone-100 text-stone-600') : 'bg-stone-100 text-stone-400';
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

type Tab = 'live' | 'verlauf' | 'fahrer';

export function TourProfitClient() {
  const [tab, setTab] = useState<Tab>('live');
  const [live, setLive] = useState<LiveDashboard | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [drivers, setDrivers] = useState<DriverEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTour, setExpandedTour] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/tour-profit?action=live', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as LiveDashboard & { ok: boolean };
        setLive(data);
        setLastRefresh(new Date().toLocaleTimeString('de-DE'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-profit?action=history&days=${days}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; history: HistoryRow[] };
        setHistory(data.history ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-profit?action=drivers&days=${days}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; drivers: DriverEntry[] };
        setDrivers(data.drivers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (tab === 'live') {
      loadLive();
      const t = setInterval(loadLive, 60_000);
      return () => clearInterval(t);
    }
    if (tab === 'verlauf') loadHistory();
    if (tab === 'fahrer') loadDrivers();
  }, [tab, loadLive, loadHistory, loadDrivers]);

  const refresh = () => {
    if (tab === 'live') loadLive();
    else if (tab === 'verlauf') loadHistory();
    else loadDrivers();
  };

  const totals = live?.sessionTotals;

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Route className="h-5 w-5 text-emerald-600" />
            Tour-Gewinn-Analyse
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Deckungsbeitrag je Tour — Live & historisch
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {lastRefresh ?? 'Aktualisieren'}
        </button>
      </div>

      {/* KPI-Karten (immer sichtbar, aus Live-Daten) */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Schicht-Umsatz" value={euro(totals.revenueEur)} sub="heute" color="blue" icon={<Euro className="h-4 w-4" />} />
          <KpiCard label="Kosten" value={euro(totals.costEur)} sub="heute" color="red" icon={<TrendingDown className="h-4 w-4" />} />
          <KpiCard
            label="Nettogewinn"
            value={euro(totals.profitEur)}
            sub="heute"
            color={totals.profitEur >= 0 ? 'green' : 'red'}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            label="Marge"
            value={pct(totals.marginPct)}
            sub={`${totals.completedTours} Touren abgeschlossen`}
            color={totals.marginPct >= 25 ? 'green' : totals.marginPct >= 10 ? 'amber' : 'red'}
            icon={<BarChart3 className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 w-fit">
        {(['live', 'verlauf', 'fahrer'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition',
              tab === t ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
            )}
          >
            {t === 'live' ? '⚡ Live-Touren' : t === 'verlauf' ? '📈 Verlauf' : '👤 Fahrer'}
          </button>
        ))}
      </div>

      {/* ── Tab: Live ── */}
      {tab === 'live' && (
        <div className="space-y-3">
          {!live && loading && <LoadingCard />}
          {live && live.activeTours.length === 0 && (
            <EmptyCard text="Keine aktiven Touren gerade" />
          )}
          {live?.activeTours.map((tour) => (
            <TourCard
              key={tour.batchId}
              tour={tour}
              expanded={expandedTour === tour.batchId}
              onToggle={() => setExpandedTour(expandedTour === tour.batchId ? null : tour.batchId)}
            />
          ))}
        </div>
      )}

      {/* ── Tab: Verlauf ── */}
      {tab === 'verlauf' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">Zeitraum:</span>
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium transition',
                  days === d ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50',
                )}
              >
                {d}T
              </button>
            ))}
          </div>

          {!history && loading && <LoadingCard />}
          {history && history.length === 0 && (
            <EmptyCard text="Noch keine Snapshot-Daten. Starte Cron oder klicke Aktualisieren." />
          )}

          {history && history.length > 0 && (
            <>
              {/* Mini-Bar-Chart: Tagesprofit */}
              <div className="bg-white border border-stone-200 rounded-xl p-4">
                <p className="text-sm font-medium text-stone-700 mb-3">Tagesgewinn (€)</p>
                <ProfitBarChart data={[...history].reverse()} />
              </div>

              {/* Tabelle */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="text-left px-4 py-2 text-stone-500 font-medium">Datum</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium">Touren</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium">Umsatz</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium">Kosten</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium">Gewinn</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium">Marge</th>
                      <th className="text-right px-4 py-2 text-stone-500 font-medium hidden md:table-cell">Ø/Tour</th>
                      <th className="text-left px-4 py-2 text-stone-500 font-medium hidden lg:table-cell">Top-Fahrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                        <td className="px-4 py-2.5 font-mono text-stone-700">{formatDate(row.snapshotDate)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{row.toursCompleted}</td>
                        <td className="px-4 py-2.5 text-right text-stone-700">{euro(row.totalRevenueEur)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-500">{euro(row.totalCostEur)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold', marginColor(row.marginPct))}>
                          {euro(row.totalProfitEur)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium', marginBadge(row.marginPct))}>
                            {pct(row.marginPct)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-500 hidden md:table-cell">
                          {row.avgProfitPerTourEur != null ? euro(row.avgProfitPerTourEur) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 hidden lg:table-cell">
                          {row.topDriverName ?? '—'}
                          {row.topDriverProfitEur != null && (
                            <span className="ml-1 text-stone-400">({euro(row.topDriverProfitEur)})</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Fahrer ── */}
      {tab === 'fahrer' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">Zeitraum:</span>
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium transition',
                  days === d ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50',
                )}
              >
                {d}T
              </button>
            ))}
          </div>

          {!drivers && loading && <LoadingCard />}
          {drivers && drivers.length === 0 && <EmptyCard text="Keine Fahrerdaten für diesen Zeitraum." />}

          {drivers && drivers.length > 0 && (
            <div className="space-y-2">
              {drivers.map((driver, idx) => (
                <DriverCard key={driver.driverId} driver={driver} rank={idx + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Unter-Komponenten ─────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'green' | 'red' | 'blue' | 'amber';
  icon: React.ReactNode;
}) {
  const colorMap = {
    green: 'bg-emerald-50 text-emerald-600',
    red:   'bg-red-50 text-red-600',
    blue:  'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-2">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colorMap[color])}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div>
        <div className="text-sm font-medium text-stone-700">{label}</div>
        <div className="text-xs text-stone-400">{sub}</div>
      </div>
    </div>
  );
}

function TourCard({ tour, expanded, onToggle }: { tour: TourProfitItem; expanded: boolean; onToggle: () => void }) {
  const profitColor = tour.profitEur >= 0 ? 'text-emerald-600' : 'text-red-600';
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition"
      >
        <Truck className="h-4 w-4 text-stone-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-stone-900 text-sm">{tour.driverName ?? 'Unbekannt'}</span>
            <span className="text-xs text-stone-400">{vehicleLabel(tour.vehicle)}</span>
            {tour.zone && (
              <span className={cn('inline-block px-1.5 py-0.5 rounded text-xs font-bold', zoneColor(tour.zone))}>
                Zone {tour.zone}
              </span>
            )}
            <span className="text-xs text-stone-400">{tour.stopsCompleted}/{tour.stopsTotal} Stopps</span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {tour.totalDistanceKm.toFixed(1)} km · {tour.totalEtaMin ? `${Math.round(tour.totalEtaMin)} Min ETA` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('font-bold text-sm', profitColor)}>{euro(tour.profitEur)}</div>
          <div className={cn('text-xs', marginColor(tour.marginPct))}>{pct(tour.marginPct)} Marge</div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 bg-stone-50 text-sm">
          <div>
            <div className="text-xs text-stone-400">Umsatz</div>
            <div className="font-semibold text-stone-900">{euro(tour.revenueEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Fahrzeit-Kosten</div>
            <div className="font-semibold text-stone-700">{euro(tour.costDriverTimeEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">km-Kosten</div>
            <div className="font-semibold text-stone-700">{euro(tour.costKmEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Stopp-Pauschalen</div>
            <div className="font-semibold text-stone-700">{euro(tour.costStopEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Gesamtkosten</div>
            <div className="font-semibold text-red-600">{euro(tour.costTotalEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Nettogewinn</div>
            <div className={cn('font-bold', profitColor)}>{euro(tour.profitEur)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Marge</div>
            <div className={cn('font-bold', marginColor(tour.marginPct))}>{pct(tour.marginPct)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400">Status</div>
            <div className="font-medium text-stone-700 capitalize">{tour.state.replace(/_/g, ' ')}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverCard({ driver, rank }: { driver: DriverEntry; rank: number }) {
  const rankBg =
    rank === 1 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
    rank === 2 ? 'bg-stone-100 text-stone-600 border-stone-300' :
    rank === 3 ? 'bg-orange-100 text-orange-700 border-orange-300' :
                  'bg-stone-50 text-stone-500 border-stone-200';

  return (
    <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={cn('w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold shrink-0', rankBg)}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-stone-900 text-sm">{driver.driverName ?? 'Unbekannt'}</span>
          <span className="text-xs text-stone-400">{vehicleLabel(driver.vehicle)}</span>
        </div>
        <div className="text-xs text-stone-400">
          {driver.toursCount} Touren · {driver.deliveriesCount} Lieferungen · {driver.totalDistanceKm.toFixed(0)} km
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('font-bold text-sm', marginColor(driver.avgMarginPct))}>
          {euro(driver.totalProfitEur)}
        </div>
        <div className={cn('text-xs', marginColor(driver.avgMarginPct))}>
          Ø {pct(driver.avgMarginPct)} Marge
        </div>
      </div>
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-xs text-stone-500">Umsatz</div>
        <div className="text-sm font-medium text-stone-700">{euro(driver.totalRevenueEur)}</div>
      </div>
    </div>
  );
}

function ProfitBarChart({ data }: { data: HistoryRow[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.totalProfitEur)), 1);
  return (
    <div className="flex items-end gap-1 h-24 w-full overflow-x-auto">
      {data.map((d) => {
        const h = Math.max(2, (Math.abs(d.totalProfitEur) / max) * 96);
        const isNeg = d.totalProfitEur < 0;
        return (
          <div key={d.id} className="flex flex-col items-center gap-0.5 min-w-[28px]" title={`${formatDate(d.snapshotDate)}: ${euro(d.totalProfitEur)}`}>
            <div
              className={cn('rounded-t w-6 transition-all', isNeg ? 'bg-red-400' : 'bg-emerald-500')}
              style={{ height: `${h}px` }}
            />
            <span className="text-[9px] text-stone-400">{formatDate(d.snapshotDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-400 animate-pulse">
      Lade Daten…
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-400">
      {text}
    </div>
  );
}
