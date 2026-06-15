'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart2,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  RefreshCw,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DemandForecastDashboard } from '@/lib/delivery/demand-forecast';

// ── helpers ───────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function accuracyColor(pct: number | null): string {
  if (pct === null) return 'bg-zinc-100 text-zinc-400';
  if (pct >= 85) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 70) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function heatColor(orders: number, maxOrders: number): string {
  if (maxOrders === 0 || orders === 0) return 'bg-zinc-50 text-zinc-300';
  const pct = orders / maxOrders;
  if (pct >= 0.8) return 'bg-orange-500 text-white';
  if (pct >= 0.6) return 'bg-orange-300 text-orange-900';
  if (pct >= 0.4) return 'bg-amber-200 text-amber-900';
  if (pct >= 0.2) return 'bg-blue-100 text-blue-700';
  return 'bg-blue-50 text-blue-400';
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color = 'text-zinc-700',
  bg = 'bg-zinc-50',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-100 ${bg} p-4`}>
      <div className="mb-2 flex items-center gap-2 text-zinc-400">{icon}</div>
      <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-zinc-500">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-400">{sub}</div>}
    </div>
  );
}

// ── WeeklyHeatmap ─────────────────────────────────────────────────────────────

function WeeklyHeatmap({
  grid,
}: {
  grid: DemandForecastDashboard['weeklyGrid'];
}) {
  const maxOrders = Math.max(...grid.map((c) => c.expectedOrders), 1);
  const businessHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-100 bg-white">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="flex border-b border-zinc-100">
          <div className="w-10 shrink-0" />
          {businessHours.map((h) => (
            <div
              key={h}
              className="flex-1 py-2 text-center text-[10px] font-bold text-zinc-400"
            >
              {fmtHour(h)}
            </div>
          ))}
        </div>
        {/* Weekday rows */}
        {WEEKDAY_LABELS.map((label, wd) => (
          <div key={wd} className="flex border-b border-zinc-50 last:border-0">
            <div className="flex w-10 shrink-0 items-center justify-center text-[10px] font-bold text-zinc-400">
              {label}
            </div>
            {businessHours.map((h) => {
              const cell = grid.find((c) => c.weekday === wd && c.hourOfDay === h);
              const orders = cell?.expectedOrders ?? 0;
              const drivers = cell?.recommendedDrivers ?? 0;
              return (
                <div
                  key={h}
                  title={`${label} ${fmtHour(h)}:00 — ${orders} Bestellungen, ${drivers} Fahrer`}
                  className={cn(
                    'flex-1 flex items-center justify-center py-2 text-[10px] font-bold cursor-default transition-opacity hover:opacity-80',
                    heatColor(orders, maxOrders),
                  )}
                >
                  {orders > 0 ? orders : '·'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-zinc-400 border-t border-zinc-50">
        <span className="font-semibold">Bestellungen/Stunde:</span>
        {[
          { label: '0', cls: 'bg-blue-50' },
          { label: 'wenig', cls: 'bg-blue-100' },
          { label: 'mittel', cls: 'bg-amber-200' },
          { label: 'viel', cls: 'bg-orange-300' },
          { label: 'peak', cls: 'bg-orange-500' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Next24hBar ────────────────────────────────────────────────────────────────

function Next24hBar({ slots }: { slots: DemandForecastDashboard['next24hForecast'] }) {
  const maxOrders = Math.max(...slots.map((s) => s.confidenceOrders), 1);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold text-zinc-700">Prognose — nächste 24 Stunden</h3>
      <div className="flex items-end gap-1 h-28">
        {slots.map((slot) => {
          const pctExp = Math.round((slot.expectedOrders / maxOrders) * 100);
          const pctConf = Math.round((slot.confidenceOrders / maxOrders) * 100);
          const isPeak = slot.expectedOrders >= maxOrders * 0.7;
          return (
            <div
              key={slot.hourLocal}
              className="group relative flex flex-1 flex-col-reverse items-center"
              title={`${slot.hourLocal} — ${slot.expectedOrders} erwartet, ${slot.recommendedTargetDrivers} Fahrer`}
            >
              <div className="relative w-full flex flex-col-reverse overflow-hidden rounded-t bg-zinc-100 h-20">
                <div
                  className={cn(
                    'w-full transition-all duration-500',
                    isPeak ? 'bg-orange-400' : 'bg-blue-400',
                  )}
                  style={{ height: `${pctExp}%` }}
                />
                {pctConf > pctExp && (
                  <div
                    className="absolute w-full border-t border-dashed border-zinc-400/60"
                    style={{ bottom: `${pctConf}%` }}
                  />
                )}
              </div>
              <div className="mt-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-zinc-500">
                <Users size={8} />
                {slot.recommendedTargetDrivers}
              </div>
              <span className="text-[8px] text-zinc-400">{slot.hourLocal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RecentSnapshotsTable ──────────────────────────────────────────────────────

function RecentSnapshotsTable({
  snapshots,
}: {
  snapshots: DemandForecastDashboard['recentSnapshots'];
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? snapshots : snapshots.slice(0, 10);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <span className="text-sm font-bold text-zinc-700">Letzte Snapshots (Forecast vs. Ist)</span>
        <span className="text-[11px] text-zinc-400">{snapshots.length} Einträge</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-50 bg-zinc-50">
            <th className="px-4 py-2 text-left text-[10px] font-semibold text-zinc-400">Stunde</th>
            <th className="px-4 py-2 text-right text-[10px] font-semibold text-zinc-400">Prognose</th>
            <th className="px-4 py-2 text-right text-[10px] font-semibold text-zinc-400">Ist</th>
            <th className="px-4 py-2 text-right text-[10px] font-semibold text-zinc-400">Genauigkeit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((snap, i) => {
            const dt = new Date(snap.forecastForHour);
            const label = `${WEEKDAY_LABELS[dt.getDay()]} ${dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${String(dt.getUTCHours()).padStart(2, '0')}:00`;
            return (
              <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-4 py-2 text-zinc-600 font-mono">{label}</td>
                <td className="px-4 py-2 text-right font-bold text-zinc-700">{snap.expectedOrders}</td>
                <td className="px-4 py-2 text-right font-bold text-zinc-700">
                  {snap.actualOrders !== null ? snap.actualOrders : <span className="text-zinc-300">—</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {snap.accuracyPct !== null ? (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', accuracyColor(snap.accuracyPct))}>
                      {Math.round(snap.accuracyPct)}%
                    </span>
                  ) : (
                    <span className="text-zinc-300 text-[10px]">ausstehend</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {snapshots.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-zinc-400 hover:text-zinc-600 border-t border-zinc-50"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Weniger anzeigen' : `${snapshots.length - 10} weitere`}
        </button>
      )}
    </div>
  );
}

// ── KundenFeedbackUebersicht ──────────────────────────────────────────────────

interface FeedbackEntry {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  source: 'post_delivery' | 'rating_link';
}

function KundenFeedbackUebersicht({ locationId }: { locationId: string }) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all');

  useEffect(() => {
    fetch(`/api/delivery/admin/feedback-sentiment?action=feed&location_id=${locationId}&limit=50`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setEntries(d);
        else if (Array.isArray(d?.feed)) setEntries(d.feed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const filtered = entries.filter((e) => {
    if (filter === 'positive') return e.stars >= 4;
    if (filter === 'negative') return e.stars <= 2;
    return true;
  });

  const avgStars =
    entries.length > 0
      ? entries.reduce((s, e) => s + e.stars, 0) / entries.length
      : null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-amber-500" />
          <span className="text-sm font-bold text-zinc-700">Kunden-Feedback Übersicht</span>
          {avgStars !== null && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              {avgStars.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['all', 'positive', 'negative'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold transition',
                filter === f
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
              )}
            >
              {f === 'all' ? 'Alle' : f === 'positive' ? '≥4 ★' : '≤2 ★'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-zinc-400">Kein Feedback vorhanden</div>
      ) : (
        <div className="divide-y divide-zinc-50 max-h-96 overflow-y-auto">
          {filtered.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className="flex shrink-0 gap-0.5 pt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={10}
                    className={
                      s <= entry.stars
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-zinc-200 text-zinc-200'
                    }
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                {entry.comment ? (
                  <p className="text-[11px] text-zinc-600 line-clamp-2">{entry.comment}</p>
                ) : (
                  <p className="text-[11px] text-zinc-300 italic">Kein Kommentar</p>
                )}
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  {new Date(entry.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

type Tab = 'forecast' | 'accuracy' | 'feedback';

export default function DemandForecastClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DemandForecastDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('forecast');
  const [computing, setComputing] = useState(false);
  const [computeMsg, setComputeMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/demand-forecast?action=dashboard&location_id=${locationId}`,
      );
      const json = await res.json() as DemandForecastDashboard;
      setData(json);
    } catch {
      // keep old data
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function handleCompute() {
    setComputing(true);
    setComputeMsg(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/delivery/admin/demand-forecast', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'record_snapshot', location_id: locationId }),
        }).then((r) => r.json()),
        fetch('/api/delivery/admin/demand-forecast', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'fill_actuals', location_id: locationId }),
        }).then((r) => r.json()),
      ]);
      setComputeMsg(`Snapshot: ${r1.saved ?? 0} gespeichert · Ist-Werte: ${r2.filled ?? 0} befüllt`);
      await load();
    } catch {
      setComputeMsg('Fehler bei Neuberechnung');
    } finally {
      setComputing(false);
    }
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={<Target size={16} />}
          label="Ø Prognose-Genauigkeit"
          value={
            summary?.avgAccuracyPct != null
              ? `${Math.round(summary.avgAccuracyPct)}%`
              : '—'
          }
          sub={summary?.evaluatedSnapshots ? `${summary.evaluatedSnapshots} Stunden ausgewertet` : 'Noch keine Daten'}
          color={
            summary?.avgAccuracyPct != null
              ? summary.avgAccuracyPct >= 85
                ? 'text-emerald-700'
                : summary.avgAccuracyPct >= 70
                  ? 'text-amber-700'
                  : 'text-red-700'
              : 'text-zinc-400'
          }
          bg={
            summary?.avgAccuracyPct != null && summary.avgAccuracyPct >= 85
              ? 'bg-emerald-50'
              : summary?.avgAccuracyPct != null && summary.avgAccuracyPct >= 70
                ? 'bg-amber-50'
                : 'bg-zinc-50'
          }
        />
        <KpiCard
          icon={<BarChart2 size={16} />}
          label="Forecast-Snapshots"
          value={summary?.totalSnapshots?.toString() ?? '0'}
          sub={`davon ${summary?.evaluatedSnapshots ?? 0} mit Ist-Daten`}
        />
        <KpiCard
          icon={<TrendingDown size={16} />}
          label="Ø Abs. Fehler"
          value={summary?.avgAbsError != null ? `${summary.avgAbsError} Bestellungen` : '—'}
          sub={summary?.avgMape != null ? `MAPE: ${summary.avgMape}%` : undefined}
        />
        <KpiCard
          icon={<Brain size={16} />}
          label="Erfasste Bestellungen"
          value={summary?.totalActualOrders?.toLocaleString('de-DE') ?? '0'}
          sub="Gesamte Ist-Bestellungen in Snapshots"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleCompute}
          disabled={computing}
          className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-50 transition"
        >
          {computing ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Brain size={14} />
          )}
          {computing ? 'Berechne…' : 'Snapshot + Ist-Werte aktualisieren'}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
        {computeMsg && (
          <span className="flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 size={14} />
            {computeMsg}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
        {([
          { id: 'forecast', label: 'Prognose', icon: <TrendingUp size={12} /> },
          { id: 'accuracy', label: 'Genauigkeit', icon: <Target size={12} /> },
          { id: 'feedback', label: 'Kunden-Feedback', icon: <MessageSquare size={12} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
              tab === id ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'forecast' && data && (
            <div className="space-y-6">
              <Next24hBar slots={data.next24hForecast} />
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <Calendar size={14} />
                  7-Tage Wochenraster (erwartete Bestellungen/Stunde)
                </h3>
                <WeeklyHeatmap grid={data.weeklyGrid} />
              </div>
            </div>
          )}

          {tab === 'accuracy' && data && (
            <div className="space-y-6">
              <RecentSnapshotsTable snapshots={data.recentSnapshots} />

              {data.accuracyBySlot.length > 0 && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                  <h3 className="mb-4 text-sm font-bold text-zinc-700">
                    Genauigkeit nach Wochentag & Stunde
                  </h3>
                  <div className="space-y-1">
                    {data.accuracyBySlot
                      .sort((a, b) => a.avgAccuracyPct - b.avgAccuracyPct)
                      .slice(0, 20)
                      .map((slot, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-[11px] text-zinc-500">
                            {WEEKDAY_LABELS[slot.weekday]} {fmtHour(slot.hourOfDay)}:00
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                slot.avgAccuracyPct >= 85
                                  ? 'bg-emerald-400'
                                  : slot.avgAccuracyPct >= 70
                                    ? 'bg-amber-400'
                                    : 'bg-red-400',
                              )}
                              style={{ width: `${Math.max(2, slot.avgAccuracyPct)}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'w-14 shrink-0 text-right text-[11px] font-bold',
                              accuracyColor(slot.avgAccuracyPct).replace('bg-', 'text-').replace('-100', '-600').replace('-50', '-400'),
                            )}
                          >
                            {Math.round(slot.avgAccuracyPct)}%
                          </span>
                          <span className="w-10 shrink-0 text-right text-[10px] text-zinc-400">
                            n={slot.dataPoints}
                          </span>
                        </div>
                      ))}
                  </div>
                  {data.accuracyBySlot.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-4">
                      Noch keine ausgewerteten Slots — Daten werden stündlich aufgebaut.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'feedback' && (
            <KundenFeedbackUebersicht locationId={locationId} />
          )}
        </>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[11px] text-blue-700">
        <strong>So funktioniert es:</strong> Alle 30 Min speichert der Cron-Job eine Prognose für die
        nächsten 6 Stunden. Sobald eine Stunde vergangen ist, werden die echten Bestellungen
        ausgezählt und die Genauigkeit berechnet. Das Wochenraster baut sich über die Zeit automatisch
        auf und wird genauer.
      </div>
    </div>
  );
}
