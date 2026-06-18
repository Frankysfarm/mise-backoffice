'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, Loader2, TrendingUp, Euro, UserCheck, BarChart3 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CohortRow {
  cohortMonth:     string;
  cohortSize:      number;
  retentionM0:     number | null;
  retentionM1:     number | null;
  retentionM3:     number | null;
  retentionM6:     number | null;
  totalRevenueEur: number;
  ltvEur:          number | null;
  monthsTracked:   number;
}

interface CohortMatrixCell {
  monthsSinceCohort: number;
  activeCustomers:   number;
  retentionRate:     number | null;
  revenueEur:        number;
}

interface CohortMatrix {
  cohortMonth: string;
  cohortSize:  number;
  cells:       CohortMatrixCell[];
}

interface CohortDashboard {
  totalCohorts:           number;
  avgRetentionM1:         number | null;
  avgRetentionM3:         number | null;
  avgLtvEur:              number | null;
  newCustomersThisMonth:  number;
  bestCohort:             CohortRow | null;
  cohortSummaries:        CohortRow[];
  retentionMatrix:        CohortMatrix[];
  computedAt:             string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 1): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Retention rate → heat colour
function retentionColor(rate: number | null): string {
  if (rate === null) return 'bg-gray-100 text-gray-400';
  if (rate >= 40) return 'bg-emerald-500 text-white';
  if (rate >= 25) return 'bg-green-400 text-white';
  if (rate >= 15) return 'bg-lime-400 text-white';
  if (rate >= 8)  return 'bg-amber-400 text-white';
  if (rate >= 3)  return 'bg-orange-400 text-white';
  return 'bg-red-400 text-white';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Retention Heatmap ─────────────────────────────────────────────────────────

function RetentionHeatmap({ matrix }: { matrix: CohortMatrix[] }) {
  if (!matrix.length) return (
    <div className="text-sm text-gray-400 py-6 text-center">Keine Kohorten-Daten verfügbar</div>
  );

  const maxOffset = Math.max(...matrix.flatMap((c) => c.cells.map((ce) => ce.monthsSinceCohort)));
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr>
            <th className="text-left p-2 text-gray-500 font-medium whitespace-nowrap pr-4">Kohorte</th>
            <th className="text-center p-2 text-gray-500 font-medium whitespace-nowrap">Größe</th>
            {offsets.map((o) => (
              <th key={o} className="text-center p-1 text-gray-400 font-medium min-w-[52px]">
                M+{o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((cohort) => {
            const cellMap = new Map<number, CohortMatrixCell>();
            for (const cell of cohort.cells) cellMap.set(cell.monthsSinceCohort, cell);
            return (
              <tr key={cohort.cohortMonth} className="border-t border-gray-100">
                <td className="p-2 text-gray-700 font-medium whitespace-nowrap pr-4">
                  {fmtMonth(cohort.cohortMonth)}
                </td>
                <td className="text-center p-2 text-gray-600 font-semibold">
                  {cohort.cohortSize}
                </td>
                {offsets.map((o) => {
                  const cell = cellMap.get(o);
                  const rate = cell?.retentionRate ?? null;
                  return (
                    <td key={o} className="p-0.5">
                      <div
                        className={`rounded text-center py-1.5 px-1 ${retentionColor(rate)}`}
                        title={cell ? `${cell.activeCustomers} aktiv · ${fmtEur(cell.revenueEur)}` : 'Keine Daten'}
                      >
                        {rate !== null ? `${fmt(rate, 0)}%` : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>Farbe:</span>
        {[
          { color: 'bg-emerald-500', label: '≥40%' },
          { color: 'bg-green-400',   label: '≥25%' },
          { color: 'bg-lime-400',    label: '≥15%' },
          { color: 'bg-amber-400',   label: '≥8%'  },
          { color: 'bg-orange-400',  label: '≥3%'  },
          { color: 'bg-red-400',     label: '<3%'  },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Cohort Summary Table ──────────────────────────────────────────────────────

function CohortTable({ summaries }: { summaries: CohortRow[] }) {
  if (!summaries.length) return (
    <div className="text-sm text-gray-400 py-6 text-center">Noch keine Kohortenübersichten berechnet</div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-xs">
            <th className="text-left py-2 px-3 font-medium">Kohorte</th>
            <th className="text-right py-2 px-3 font-medium">Kunden</th>
            <th className="text-right py-2 px-3 font-medium">M+1</th>
            <th className="text-right py-2 px-3 font-medium">M+3</th>
            <th className="text-right py-2 px-3 font-medium">M+6</th>
            <th className="text-right py-2 px-3 font-medium">Ges. Umsatz</th>
            <th className="text-right py-2 px-3 font-medium">LTV (Ø)</th>
            <th className="text-center py-2 px-3 font-medium">Monate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {summaries.map((row) => (
            <tr key={row.cohortMonth} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-semibold text-gray-800">
                {fmtMonth(row.cohortMonth)}
              </td>
              <td className="py-2 px-3 text-right text-gray-700">{row.cohortSize}</td>
              <td className="py-2 px-3 text-right">
                {row.retentionM1 !== null
                  ? <span className={`font-medium ${row.retentionM1 >= 20 ? 'text-emerald-600' : row.retentionM1 >= 10 ? 'text-amber-600' : 'text-red-500'}`}>{fmt(row.retentionM1, 1)}%</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-2 px-3 text-right">
                {row.retentionM3 !== null
                  ? <span className={`font-medium ${row.retentionM3 >= 15 ? 'text-emerald-600' : row.retentionM3 >= 5 ? 'text-amber-600' : 'text-red-500'}`}>{fmt(row.retentionM3, 1)}%</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-2 px-3 text-right">
                {row.retentionM6 !== null
                  ? <span className={`font-medium ${row.retentionM6 >= 10 ? 'text-emerald-600' : row.retentionM6 >= 3 ? 'text-amber-600' : 'text-red-500'}`}>{fmt(row.retentionM6, 1)}%</span>
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-2 px-3 text-right text-gray-700">{fmtEur(row.totalRevenueEur)}</td>
              <td className="py-2 px-3 text-right font-semibold text-gray-800">
                {row.ltvEur !== null ? fmtEur(row.ltvEur) : '—'}
              </td>
              <td className="py-2 px-3 text-center text-gray-500">{row.monthsTracked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function CustomerCohortsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<CohortDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'table'>('heatmap');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/customer-cohorts?action=dashboard&location_id=${locationId}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as CohortDashboard);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await fetch('/api/delivery/admin/customer-cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild', location_id: locationId }),
      });
      await load();
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Kohorten werden geladen…</span>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
  );

  const d = data!;

  const TABS: { key: 'heatmap' | 'table'; label: string }[] = [
    { key: 'heatmap', label: 'Retention-Heatmap' },
    { key: 'table',   label: 'Kohortenübersicht' },
  ];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <BarChart3 className="w-4 h-4" />
          <span>{d.totalCohorts} Kohorten · {d.cohortSummaries.reduce((s, c) => s + c.cohortSize, 0)} Kunden analysiert</span>
        </div>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50"
        >
          {rebuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Neu berechnen
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Aktive Kohorten"
          value={String(d.totalCohorts)}
          sub="letzte 12 Monate"
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          icon={UserCheck}
          label="Ø Retention M+1"
          value={d.avgRetentionM1 !== null ? `${fmt(d.avgRetentionM1, 1)}%` : '—'}
          sub="kehren nach 1 Monat zurück"
          color="bg-emerald-100 text-emerald-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ø Retention M+3"
          value={d.avgRetentionM3 !== null ? `${fmt(d.avgRetentionM3, 1)}%` : '—'}
          sub="aktiv nach 3 Monaten"
          color="bg-purple-100 text-purple-600"
        />
        <KpiCard
          icon={Euro}
          label="Ø LTV pro Kohorte"
          value={d.avgLtvEur !== null ? fmtEur(d.avgLtvEur) : '—'}
          sub="kumulierter Kunden-LTV"
          color="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Best cohort highlight */}
      {d.bestCohort && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Beste Kohorte: {fmtMonth(d.bestCohort.cohortMonth)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm mt-2">
            <div>
              <div className="text-xs text-gray-500">Kohortengröße</div>
              <div className="font-bold text-gray-800">{d.bestCohort.cohortSize} Kunden</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">LTV (Ø)</div>
              <div className="font-bold text-emerald-700">{d.bestCohort.ltvEur !== null ? fmtEur(d.bestCohort.ltvEur) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Retention M+1</div>
              <div className="font-bold text-gray-800">{d.bestCohort.retentionM1 !== null ? `${fmt(d.bestCohort.retentionM1, 1)}%` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Gesamt-Umsatz</div>
              <div className="font-bold text-gray-800">{fmtEur(d.bestCohort.totalRevenueEur)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'heatmap' && (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                Zeigt für jede Akquisitions-Kohorte (Zeile), wie viele Kunden in späteren Monaten (Spalte M+N) noch aktiv waren.
                Tiefere Grüntöne = höhere Retention.
              </p>
              <RetentionHeatmap matrix={d.retentionMatrix} />
            </div>
          )}

          {activeTab === 'table' && (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                Übersicht aller Kohorten mit Retention-Raten an M+1 / M+3 / M+6 und kumuliertem Lifetime-Value.
              </p>
              <CohortTable summaries={d.cohortSummaries} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center">
        Berechnet: {new Date(d.computedAt).toLocaleString('de-DE')} · 5-Min-Auto-Refresh
      </div>
    </div>
  );
}
