'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { AmendmentDashboard, DailyAmendmentRow } from '@/lib/delivery/order-amendments';

// ── Typen ────────────────────────────────────────────────────────────────────

type TabKey = 'uebersicht' | 'in_flight' | 'trend' | 'typen';

const TYPE_LABELS: Record<string, string> = {
  item_added: 'Artikel hinzugefügt',
  item_removed: 'Artikel entfernt',
  item_changed: 'Artikel geändert',
  address_changed: 'Adresse geändert',
  phone_changed: 'Telefon geändert',
  notes_changed: 'Notiz geändert',
  amount_adjusted: 'Betrag angepasst',
  tip_changed: 'Trinkgeld geändert',
  priority_changed: 'Priorität geändert',
  other: 'Sonstiges',
};

const TYPE_COLORS: Record<string, string> = {
  item_added: 'bg-green-100 text-green-800',
  item_removed: 'bg-red-100 text-red-800',
  item_changed: 'bg-amber-100 text-amber-800',
  address_changed: 'bg-blue-100 text-blue-800',
  phone_changed: 'bg-purple-100 text-purple-800',
  notes_changed: 'bg-slate-100 text-slate-700',
  amount_adjusted: 'bg-orange-100 text-orange-800',
  tip_changed: 'bg-rose-100 text-rose-800',
  priority_changed: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-700',
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  const color = TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function fmtEur(n: number) {
  if (n === 0) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)} €`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

// ── Trend-Chart (SVG) ─────────────────────────────────────────────────────────

function TrendChart({ rows }: { rows: DailyAmendmentRow[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400 py-4">Keine Daten</p>;

  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const maxVal = Math.max(...sorted.map((r) => r.totalAmendments), 1);
  const W = 600;
  const H = 120;
  const padL = 32;
  const padR = 12;
  const padT = 8;
  const padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xStep = chartW / Math.max(sorted.length - 1, 1);

  function xOf(i: number) {
    return padL + i * xStep;
  }
  function yOf(v: number) {
    return padT + chartH - (v / maxVal) * chartH;
  }

  const line = sorted
    .map((r, i) => `${xOf(i)},${yOf(r.totalAmendments)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
      {/* Y-Gridlines */}
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={padL}
          y1={padT + chartH * (1 - f)}
          x2={W - padR}
          y2={padT + chartH * (1 - f)}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}
      {/* Area fill */}
      <polygon
        points={`${padL},${padT + chartH} ${line} ${xOf(sorted.length - 1)},${padT + chartH}`}
        fill="rgba(99,102,241,0.08)"
      />
      {/* Line */}
      <polyline
        points={line}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* X labels (every 7th) */}
      {sorted.map(
        (r, i) =>
          i % 7 === 0 && (
            <text
              key={i}
              x={xOf(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
            >
              {fmtDate(r.day)}
            </text>
          ),
      )}
      {/* Y label */}
      <text x={padL - 4} y={padT + 6} textAnchor="end" fontSize="9" fill="#94a3b8">
        {maxVal}
      </text>
      <text x={padL - 4} y={padT + chartH} textAnchor="end" fontSize="9" fill="#94a3b8">
        0
      </text>
    </svg>
  );
}

// ── AmendmentsClient ──────────────────────────────────────────────────────────

export function AmendmentsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<AmendmentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('uebersicht');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/admin/amendments?action=dashboard&location_id=${locationId}`);
      const json = await r.json() as { ok: boolean; data: AmendmentDashboard };
      if (json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* KPI Band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Änderungen heute"
          value={loading ? '…' : (summary?.todayCount ?? 0)}
          sub={`${summary?.todayUniqueOrders ?? 0} Bestellungen betroffen`}
          color="text-indigo-600"
        />
        <KpiCard
          label="Diese Woche"
          value={loading ? '…' : (summary?.weekCount ?? 0)}
          sub={`${summary?.dispatchImpactedAll ?? 0} Dispatch-Eingriffe gesamt`}
        />
        <KpiCard
          label="Δ Umsatz heute"
          value={loading ? '…' : fmtEur(summary?.deltaEurToday ?? 0)}
          sub={`Woche: ${fmtEur(summary?.deltaEurWeek ?? 0)}`}
          color={(summary?.deltaEurToday ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard
          label="Upsells / Rabatte"
          value={loading ? '…' : `${summary?.upsellsToday ?? 0} / ${summary?.discountsToday ?? 0}`}
          sub="Artikel+ / Preis− heute"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: 'uebersicht', label: 'Übersicht' },
            { key: 'in_flight', label: `In-Flight${data?.inFlightAmendments.length ? ` (${data.inFlightAmendments.length})` : ''}` },
            { key: 'trend', label: '30-Tage-Trend' },
            { key: 'typen', label: 'Nach Typ' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => { setLoading(true); void load(); }}
          className="ml-auto px-3 py-2 text-slate-400 hover:text-slate-600"
          title="Aktualisieren"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Übersicht Tab */}
      {tab === 'uebersicht' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Letzte Änderungen</h3>
          {!data?.recentAmendments.length && (
            <p className="text-sm text-slate-400 py-4">Noch keine Änderungen erfasst.</p>
          )}
          <div className="space-y-2">
            {data?.recentAmendments.map((a) => (
              <Card
                key={a.id}
                className="p-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <div className="flex items-center gap-3">
                  <TypeBadge type={a.amendmentType} />
                  <span className="text-sm text-slate-700 font-mono flex-1">
                    {a.orderId.slice(0, 8)}…
                  </span>
                  {a.deltaEur !== 0 && (
                    <span className={`text-xs font-semibold ${a.deltaEur > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtEur(a.deltaEur)}
                    </span>
                  )}
                  {a.affectedDispatch && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Dispatch betroffen" />
                  )}
                  <span className="text-xs text-slate-400">{fmtTime(a.createdAt)}</span>
                </div>
                {expanded === a.id && (
                  <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>
                      <span className="font-medium text-slate-600">Feld:</span> {a.fieldName ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">ETA neu:</span>{' '}
                      {a.etaRecalculated ? 'Ja' : 'Nein'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Vorher:</span> {fmt(a.oldValue)}
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Nachher:</span> {fmt(a.newValue)}
                    </div>
                    {a.reason && (
                      <div className="col-span-2">
                        <span className="font-medium text-slate-600">Grund:</span> {a.reason}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* In-Flight Tab */}
      {tab === 'in_flight' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Bestellungen die geändert wurden, während sie sich noch in Zustellung befinden.
          </p>
          {!data?.inFlightAmendments.length && (
            <p className="text-sm text-slate-400 py-4">Keine aktiven In-Flight-Änderungen.</p>
          )}
          {data?.inFlightAmendments.map((a) => (
            <Card key={a.latestAmendmentId} className={`p-3 ${a.affectedDispatch ? 'border-amber-200 bg-amber-50' : ''}`}>
              <div className="flex items-center gap-3">
                {a.affectedDispatch && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{a.bestellnummer}</p>
                  <p className="text-xs text-slate-500">
                    {a.kundeName ?? 'Unbekannt'} · Status: {a.status}
                  </p>
                </div>
                <TypeBadge type={a.latestType} />
                {a.latestDeltaEur !== 0 && (
                  <span className={`text-xs font-semibold ${a.latestDeltaEur > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmtEur(a.latestDeltaEur)}
                  </span>
                )}
                <span className="text-xs text-slate-400">{fmtTime(a.amendedAt)}</span>
              </div>
              {a.reason && (
                <p className="text-xs text-slate-400 mt-1 pl-7">Grund: {a.reason}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Trend Tab */}
      {tab === 'trend' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Änderungen pro Tag (30 Tage)</h3>
          <Card className="p-4">
            <TrendChart rows={data?.dailyTrend ?? []} />
          </Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-4">Tag</th>
                  <th className="py-1 pr-4 text-right">Gesamt</th>
                  <th className="py-1 pr-4 text-right">Bestellungen</th>
                  <th className="py-1 pr-4 text-right">Dispatch</th>
                  <th className="py-1 pr-4 text-right">Δ EUR</th>
                  <th className="py-1 pr-4 text-right">↑ Upsell</th>
                  <th className="py-1 text-right">↓ Rabatt</th>
                </tr>
              </thead>
              <tbody>
                {(data?.dailyTrend ?? []).slice(0, 14).map((r) => (
                  <tr key={r.day} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1 pr-4 font-mono">{fmtDate(r.day)}</td>
                    <td className="py-1 pr-4 text-right font-semibold">{r.totalAmendments}</td>
                    <td className="py-1 pr-4 text-right">{r.uniqueOrders}</td>
                    <td className="py-1 pr-4 text-right">
                      {r.dispatchImpacted > 0 ? (
                        <span className="text-amber-600">{r.dispatchImpacted}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className={`py-1 pr-4 text-right font-semibold ${r.deltaEurTotal > 0 ? 'text-green-600' : r.deltaEurTotal < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {r.deltaEurTotal !== 0 ? fmtEur(r.deltaEurTotal) : '—'}
                    </td>
                    <td className="py-1 pr-4 text-right text-green-600">{r.upsellAmendments || '—'}</td>
                    <td className="py-1 text-right text-red-600">{r.discountAmendments || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Typen Tab */}
      {tab === 'typen' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Aufschlüsselung nach Änderungstyp</h3>
          {!data?.typeBreakdown.length && (
            <p className="text-sm text-slate-400 py-4">Keine Daten verfügbar.</p>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4">Typ</th>
                  <th className="py-2 pr-4 text-right">Heute</th>
                  <th className="py-2 pr-4 text-right">Diese Woche</th>
                  <th className="py-2 pr-4 text-right">Dispatch-Impact</th>
                  <th className="py-2 text-right">Ø Δ EUR</th>
                </tr>
              </thead>
              <tbody>
                {data?.typeBreakdown.map((r) => (
                  <tr key={r.amendmentType} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <TypeBadge type={r.amendmentType} />
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">{r.todayCount}</td>
                    <td className="py-2 pr-4 text-right">{r.weekCount}</td>
                    <td className="py-2 pr-4 text-right">
                      {r.dispatchImpacted > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {r.dispatchImpacted}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {r.avgDeltaEur !== 0 ? (
                        <span className={r.avgDeltaEur > 0 ? 'text-green-600' : 'text-red-600'}>
                          {r.avgDeltaEur > 0 ? (
                            <TrendingUp className="inline h-3 w-3 mr-0.5" />
                          ) : (
                            <TrendingDown className="inline h-3 w-3 mr-0.5" />
                          )}
                          {fmtEur(r.avgDeltaEur)}
                        </span>
                      ) : (
                        <span className="text-slate-300"><Minus className="inline h-3 w-3" /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <strong>Hinweis:</strong> Änderungen werden von Mitarbeitern oder automatisch via API erfasst.
            &ldquo;Dispatch-Impact&rdquo; bedeutet, dass die Änderung eine Neubewertung der aktiven Tour erforderte.
          </div>
        </div>
      )}
    </div>
  );
}
