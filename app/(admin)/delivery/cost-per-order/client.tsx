'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  AlertTriangle, Bike, Calculator, CreditCard, Euro, RefreshCw, TrendingDown, TrendingUp,
  Truck, Users, ChevronDown, ChevronUp, Package,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import type {
  CostPerOrderDashboard, DriverOrderCost, HourlyOrderCost, VehicleOrderCost,
} from '@/lib/delivery/cost-per-order';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiResponse = CostPerOrderDashboard & { ok: boolean; error?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function marginColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400';
  if (pct >= 30) return 'text-emerald-400';
  if (pct >= 10) return 'text-amber-400';
  return 'text-red-400';
}
function marginBg(pct: number | null): string {
  if (pct === null) return 'bg-gray-800/30';
  if (pct >= 30) return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 10) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}
function fmtEur(v: number | null): string {
  if (v === null) return '—';
  return `${v >= 0 ? '' : '-'}${euro(Math.abs(v))}`;
}
function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`;
}
function vehicleLabel(vt: string): string {
  const map: Record<string, string> = {
    bicycle: 'Fahrrad', ebike: 'E-Bike', scooter: 'Roller',
    moped: 'Moped', car: 'Auto', unbekannt: 'Unbekannt',
  };
  return map[vt] ?? vt;
}
function vehicleIcon(vt: string) {
  if (vt === 'car') return <Truck className="h-4 w-4" />;
  if (vt === 'bicycle' || vt === 'ebike') return <Bike className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, trend }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-gray-500">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-400 mb-1" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-400 mb-1" />}
      </div>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function DriverRow({ d, expanded, onToggle }: {
  d: DriverOrderCost; expanded: boolean; onToggle: () => void;
}) {
  const mp = d.marginPct;
  return (
    <div className={cn('rounded-xl border p-3 cursor-pointer transition-all', marginBg(mp))} onClick={onToggle}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(d.driverName ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{d.driverName ?? 'Unbekannt'}</div>
            <div className="text-xs text-gray-400">{vehicleLabel(d.vehicleType ?? 'unbekannt')} · {d.totalOrders} Bests.</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className={cn('text-sm font-bold', marginColor(mp))}>{fmtPct(mp)}</div>
            <div className="text-xs text-gray-400">Marge</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-white">{fmtEur(d.avgMarginPerOrderEur)}</div>
            <div className="text-xs text-gray-400">Ø / Bestellung</div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-sm font-medium text-white">{fmtEur(d.avgCostPerOrderEur)}</div>
            <div className="text-xs text-gray-400">Ø Kosten</div>
          </div>
          <div>
            <div className="text-sm font-medium text-white">{fmtEur(d.avgFeePerOrderEur)}</div>
            <div className="text-xs text-gray-400">Ø Gebühr</div>
          </div>
          <div>
            <div className={cn('text-sm font-medium', d.lossTrips > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {d.lossTrips} / {d.tripsCount}
            </div>
            <div className="text-xs text-gray-400">Verlust-Touren</div>
          </div>
        </div>
      )}
    </div>
  );
}

const HOUR_BAR_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
function hourColor(margin: number | null): string {
  if (margin === null) return '#6b7280';
  if (margin >= 0.5) return '#10b981';
  if (margin >= 0) return '#f59e0b';
  return '#ef4444';
}

function HourlyChart({ data }: { data: HourlyOrderCost[] }) {
  const chartData = data.map((h) => ({
    h: `${String(h.hourOfDay).padStart(2, '0')}:00`,
    cost: h.avgCostPerOrderEur,
    fee: h.avgFeePerOrderEur,
    margin: h.avgMarginPerOrderEur,
    orders: h.totalOrders,
    color: hourColor(h.avgMarginPerOrderEur),
  })).filter((d) => d.orders > 0);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Keine Daten</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <XAxis dataKey="h" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${v}€`} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          formatter={(v: number, name: string) => [
            `${v?.toFixed(2)} €`,
            name === 'cost' ? 'Kosten/Bestellung' : name === 'fee' ? 'Gebühr/Bestellung' : 'Marge/Bestellung',
          ]}
        />
        <Bar dataKey="cost" name="cost" stackId="a" fill="#6366f1" />
        <Bar dataKey="margin" name="margin" stackId="b">
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ data }: { data: { dateStr: string; avgCostPerOrderEur: number | null; avgFeePerOrderEur: number | null; avgMarginPerOrderEur: number | null }[] }) {
  const chartData = data.map((d) => ({
    date: d.dateStr.slice(5), // MM-DD
    cost: d.avgCostPerOrderEur,
    fee: d.avgFeePerOrderEur,
    margin: d.avgMarginPerOrderEur,
  }));

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Keine Daten</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${v}€`} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          formatter={(v: number, name: string) => [
            `${v?.toFixed(2)} €`,
            name === 'cost' ? 'Kosten' : name === 'fee' ? 'Gebühr' : 'Marge',
          ]}
        />
        <Legend formatter={(v) => v === 'cost' ? 'Kosten' : v === 'fee' ? 'Gebühr' : 'Marge'} />
        <Line type="monotone" dataKey="cost" stroke="#6366f1" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="fee" stroke="#14b8a6" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="margin" stroke="#10b981" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Deckungsbeitrag Calculator ───────────────────────────────────────────────

function DeckungsbeitragCalculator({ avgCost, avgFee }: { avgCost: number | null; avgFee: number | null }) {
  const [cost, setCost] = useState(avgCost?.toFixed(2) ?? '2.50');
  const [fee, setFee] = useState(avgFee?.toFixed(2) ?? '2.90');
  const [packaging, setPackaging] = useState('0.50');

  useEffect(() => {
    if (avgCost !== null) setCost(avgCost.toFixed(2));
    if (avgFee !== null) setFee(avgFee.toFixed(2));
  }, [avgCost, avgFee]);

  const costN  = parseFloat(cost)  || 0;
  const feeN   = parseFloat(fee)   || 0;
  const packN  = parseFloat(packaging) || 0;
  const totalCostN = costN + packN;
  const margin = feeN - totalCostN;
  const marginPct = feeN > 0 ? (margin / feeN) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Deckungsbeitrag-Rechner</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: 'Lieferkosten (€)', val: cost, set: setCost },
          { label: 'Liefergebühr (€)', val: fee, set: setFee },
          { label: 'Verpackung (€)', val: packaging, set: setPackaging },
        ] as const).map(({ label, val, set }) => (
          <div key={label}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input
              type="number"
              step="0.01"
              value={val}
              onChange={(e) => set(e.target.value)}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        ))}
      </div>
      <div className={cn(
        'rounded-xl p-3 flex items-center justify-between border',
        marginColor(marginPct) === 'text-emerald-400' ? 'bg-emerald-500/10 border-emerald-500/20' :
        marginColor(marginPct) === 'text-amber-400'   ? 'bg-amber-500/10 border-amber-500/20' :
        'bg-red-500/10 border-red-500/20',
      )}>
        <div>
          <div className="text-xs text-gray-400">Deckungsbeitrag / Bestellung</div>
          <div className={cn('text-xl font-bold', marginColor(marginPct))}>{fmtEur(margin)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Marge</div>
          <div className={cn('text-lg font-bold', marginColor(marginPct))}>{fmtPct(marginPct)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

const TABS = ['Überblick', 'Fahrer', 'Stunden', 'Fahrzeug', 'Rechner'] as const;
type Tab = (typeof TABS)[number];

const DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;

export function CostPerOrderClient() {
  const [data, setData] = useState<CostPerOrderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Überblick');
  const [days, setDays] = useState<number>(30);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/cost-per-order?days=${d}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as ApiResponse;
      if (!json.ok) throw new Error(json.error ?? 'Fehler');
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [load, days]);

  const k = data?.kpis;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Euro className="h-5 w-5 text-indigo-400" />
            Kosten pro Bestellung
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Deckungsbeitrag-Analyse je Lieferung nach Fahrer · Schicht · Fahrzeug</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} Tage</option>
            ))}
          </select>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="rounded-lg bg-white/5 border border-white/10 p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Analysierte Touren"
          value={loading ? '…' : String(k?.totalTrips ?? '—')}
          sub={`${k?.totalOrders ?? 0} Bestellungen gesamt`}
          icon={<Truck className="h-4 w-4" />}
        />
        <KpiCard
          label="Ø Kosten / Bestellung"
          value={loading ? '…' : fmtEur(k?.avgCostPerOrderEur ?? null)}
          sub="Fahrerlohn + Kraftstoff + Versicherung"
          icon={<CreditCard className="h-4 w-4" />}
          trend={null}
        />
        <KpiCard
          label="Ø Liefergebühr / Best."
          value={loading ? '…' : fmtEur(k?.avgFeePerOrderEur ?? null)}
          sub="Eingenommene Liefergebühr"
          icon={<Euro className="h-4 w-4" />}
        />
        <KpiCard
          label="Deckungsbeitrag"
          value={loading ? '…' : fmtPct(k?.overallMarginPct ?? null)}
          sub={`Ø ${fmtEur(k?.avgMarginPerOrderEur ?? null)} / Bestellung`}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={(k?.overallMarginPct ?? 0) >= 10 ? 'up' : 'down'}
        />
      </div>

      {/* Alert: loss orders */}
      {(k?.lossOrdersPct ?? 0) > 20 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>
            <strong>{k!.lossOrdersPct!.toFixed(1)} %</strong> der Bestellungen kommen aus Verlust-Touren.
            Liefergebühren oder Kostenstruktur prüfen.
          </span>
        </div>
      )}

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-indigo-400 shrink-0" />
          <div>
            <div className="text-xs text-gray-400">Ø Bestellungen pro Tour</div>
            <div className="text-2xl font-bold text-white">{loading ? '…' : (k?.avgOrdersPerTrip ?? '—')}</div>
            <div className="text-xs text-gray-500">je Batch-Stop-Anzahl</div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <TrendingDown className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <div className="text-xs text-gray-400">Verlust-Bestell.-Anteil</div>
            <div className={cn('text-2xl font-bold', (k?.lossOrdersPct ?? 0) > 10 ? 'text-red-400' : 'text-emerald-400')}>
              {loading ? '…' : (k?.lossOrdersPct != null ? `${k.lossOrdersPct} %` : '—')}
            </div>
            <div className="text-xs text-gray-500">aus Touren mit neg. Marge</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto pb-0 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white',
            )}
          >{t}</button>
        ))}
      </div>

      {/* Tab: Überblick */}
      {tab === 'Überblick' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">14-Tage-Trend: Kosten vs. Gebühr vs. Marge pro Bestellung</h3>
            <TrendChart data={data?.trend14d ?? []} />
          </div>
          {data && data.trend14d.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 font-medium">Datum</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Bests.</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Ø Kosten</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Ø Gebühr</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Ø Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.trend14d].reverse().map((d) => (
                    <tr key={d.dateStr} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 text-gray-300">{d.dateStr}</td>
                      <td className="py-2 text-right text-gray-300">{d.totalOrders}</td>
                      <td className="py-2 text-right text-gray-300">{fmtEur(d.avgCostPerOrderEur)}</td>
                      <td className="py-2 text-right text-gray-300">{fmtEur(d.avgFeePerOrderEur)}</td>
                      <td className={cn('py-2 text-right font-medium', marginColor(d.avgMarginPerOrderEur !== null ? (d.avgFeePerOrderEur ?? 0) > 0 ? ((d.avgMarginPerOrderEur / (d.avgFeePerOrderEur ?? 1)) * 100) : null : null))}>
                        {fmtEur(d.avgMarginPerOrderEur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && data && data.trend14d.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              Noch keine Daten — Trip-Kosten-Analyse muss zuerst konfiguriert werden.
            </div>
          )}
        </div>
      )}

      {/* Tab: Fahrer */}
      {tab === 'Fahrer' && (
        <div className="space-y-2">
          {loading && <div className="text-center text-gray-500 text-sm py-8">Lade…</div>}
          {!loading && data && data.byDriver.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">Keine Fahrer-Daten</div>
          )}
          {!loading && data && data.byDriver.map((d) => (
            <DriverRow
              key={d.driverId}
              d={d}
              expanded={expandedDriver === d.driverId}
              onToggle={() => setExpandedDriver(expandedDriver === d.driverId ? null : d.driverId)}
            />
          ))}
        </div>
      )}

      {/* Tab: Stunden */}
      {tab === 'Stunden' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">Kosten &amp; Marge nach Tagesstunde</h3>
            <p className="text-xs text-gray-400">Indigo = Kosten je Bestellung · Grün/Gelb/Rot = Marge je Bestellung</p>
            <HourlyChart data={data?.byHour ?? []} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-gray-400 font-medium">Stunde</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Touren</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Bests.</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Ø Kosten</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Ø Gebühr</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Ø Marge</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byHour ?? []).filter((h) => h.tripsCount > 0).map((h) => (
                  <tr key={h.hourOfDay} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-gray-300 font-medium">{String(h.hourOfDay).padStart(2, '0')}:00</td>
                    <td className="py-2 text-right text-gray-300">{h.tripsCount}</td>
                    <td className="py-2 text-right text-gray-300">{h.totalOrders}</td>
                    <td className="py-2 text-right text-gray-300">{fmtEur(h.avgCostPerOrderEur)}</td>
                    <td className="py-2 text-right text-gray-300">{fmtEur(h.avgFeePerOrderEur)}</td>
                    <td className={cn('py-2 text-right font-medium',
                      h.avgMarginPerOrderEur !== null
                        ? h.avgMarginPerOrderEur >= 0.5 ? 'text-emerald-400' : h.avgMarginPerOrderEur >= 0 ? 'text-amber-400' : 'text-red-400'
                        : 'text-gray-400',
                    )}>
                      {fmtEur(h.avgMarginPerOrderEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Fahrzeug */}
      {tab === 'Fahrzeug' && (
        <div className="space-y-3">
          {(data?.byVehicle ?? []).map((v) => (
            <div key={v.vehicleType} className={cn('rounded-2xl border p-4 space-y-3', marginBg(v.marginPct))}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400">{vehicleIcon(v.vehicleType)}</span>
                  <span className="text-sm font-semibold text-white">{vehicleLabel(v.vehicleType)}</span>
                  <span className="text-xs text-gray-400">· {v.tripsCount} Touren · {v.totalOrders} Bests.</span>
                </div>
                <span className={cn('text-sm font-bold', marginColor(v.marginPct))}>{fmtPct(v.marginPct)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-sm font-medium text-white">{fmtEur(v.avgCostPerOrderEur)}</div>
                  <div className="text-xs text-gray-400">Ø Kosten</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{fmtEur(v.avgFeePerOrderEur)}</div>
                  <div className="text-xs text-gray-400">Ø Gebühr</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{euro(v.totalCostEur)}</div>
                  <div className="text-xs text-gray-400">Gesamtkosten</div>
                </div>
                <div>
                  <div className={cn('text-sm font-medium', v.totalMarginEur >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmtEur(v.totalMarginEur)}
                  </div>
                  <div className="text-xs text-gray-400">Gesamtmarge</div>
                </div>
              </div>
            </div>
          ))}
          {!loading && data && data.byVehicle.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">Keine Fahrzeug-Daten</div>
          )}
        </div>
      )}

      {/* Tab: Rechner */}
      {tab === 'Rechner' && (
        <DeckungsbeitragCalculator
          avgCost={data?.kpis.avgCostPerOrderEur ?? null}
          avgFee={data?.kpis.avgFeePerOrderEur ?? null}
        />
      )}

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center">
        Daten der letzten {days} Tage · Kosten basieren auf Trip-Kosten-Analyse (Phase 183)
        {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleTimeString('de-DE')}`}
      </div>
    </div>
  );
}
