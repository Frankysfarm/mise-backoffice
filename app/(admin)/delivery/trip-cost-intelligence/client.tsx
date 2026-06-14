'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Truck, RefreshCw,
  AlertTriangle, Settings, BarChart2, ChevronDown, ChevronUp,
  Calculator, Package, ShieldCheck, Fuel,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CostConfig {
  costDriverHourlyEur: number;
  costPerKmBicycleEur: number;
  costPerKmEbikeEur: number;
  costPerKmScooterEur: number;
  costPerKmMopedEur: number;
  costPerKmCarEur: number;
  costPackagingEur: number;
  costInsurancePerDel: number;
  platformFeePct: number;
}

interface DailySummary {
  snapshotDate: string;
  tripsCount: number;
  totalCostEur: number;
  totalMarginEur: number;
  marginPct: number | null;
  lossTrips: number;
  deliveriesCount: number;
}

interface DriverProfile {
  driverId: string;
  driverName: string | null;
  tripsCount: number;
  deliveriesCount: number;
  totalCostEur: number;
  totalRevenueEur: number;
  totalMarginEur: number;
  avgMarginPerTripEur: number | null;
  lossTrips: number;
  marginPct: number | null;
  vehicleType: string | null;
}

interface TripCost {
  id: string;
  batchId: string;
  startedAt: string | null;
  completedAt: string | null;
  stopsCount: number;
  totalDistanceKm: number;
  totalCostEur: number;
  netRevenueEur: number;
  grossMarginEur: number;
  marginPct: number | null;
  vehicleType: string | null;
}

interface CostBreakdown {
  driverTimePct: number;
  fuelKmPct: number;
  packagingPct: number;
  insurancePct: number;
  totalCostEur: number;
}

interface Dashboard {
  config: CostConfig;
  summary30d: {
    tripsCount: number;
    deliveriesCount: number;
    totalCostEur: number;
    totalRevenueEur: number;
    totalMarginEur: number;
    overallMarginPct: number | null;
    lossTrips: number;
    lossTriPct: number | null;
    avgMarginPerTripEur: number | null;
    totalDistanceKm: number;
  };
  dailyTrend14d: DailySummary[];
  costBreakdown: CostBreakdown;
  drivers: DriverProfile[];
  lossMaking: TripCost[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

const pct = (v: number | null) => (v != null ? `${v.toFixed(1)} %` : '—');

const vehicleLabel = (vt: string | null) => {
  const m: Record<string, string> = {
    bicycle: 'Fahrrad', ebike: 'E-Bike', scooter: 'Scooter',
    moped: 'Moped', car: 'Auto',
  };
  return vt ? (m[vt] ?? vt) : '—';
};

const marginColor = (pct: number | null) => {
  if (pct == null) return 'text-gray-400';
  if (pct >= 40) return 'text-emerald-600';
  if (pct >= 20) return 'text-amber-600';
  if (pct >= 0)  return 'text-orange-600';
  return 'text-red-600';
};

function KpiCard({ label, value, sub, icon, warn }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; warn?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border p-4', warn ? 'border-red-200 bg-red-50' : 'bg-card border-border')}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        <span className={warn ? 'text-red-500' : 'text-matcha-700'}>{icon}</span>
        {label}
      </div>
      <div className={cn('font-display text-2xl font-bold', warn ? 'text-red-600' : '')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TripCostIntelligenceClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'overview' | 'loss' | 'drivers' | 'config'>('overview');
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [cfg, setCfg] = useState<CostConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/trip-cost-intelligence?action=dashboard');
      if (res.ok) {
        const json = await res.json() as Dashboard;
        setData(json);
        setCfg(json.config);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/trip-cost-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', hours: 48 }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/trip-cost-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_config', ...cfg }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Lade Kostenanalyse…</div>;
  if (!data) return <div className="p-8 text-red-500">Fehler beim Laden.</div>;

  const { summary30d: s, dailyTrend14d, costBreakdown, drivers, lossMaking } = data;

  // Chart scaling for trend
  const maxMargin = Math.max(1, ...dailyTrend14d.map((d) => Math.abs(d.totalMarginEur)));
  const maxCost = Math.max(1, ...dailyTrend14d.map((d) => d.totalCostEur));

  const TABS = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'loss', label: `Verlustfahrten (${s.lossTrips})` },
    { id: 'drivers', label: `Fahrer (${drivers.length})` },
    { id: 'config', label: 'Konfiguration' },
  ] as const;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Trip-Kosten-Analyse</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Echtzeit-Ökonomie jeder Liefertour · Kosten vs. Liefergebühr · Marge pro Fahrer
          </p>
        </div>
        <button
          onClick={handleCompute}
          disabled={computing}
          className="flex items-center gap-2 rounded-lg bg-matcha-700 text-white px-4 py-2 text-sm font-medium hover:bg-matcha-800 disabled:opacity-60"
        >
          <RefreshCw size={14} className={computing ? 'animate-spin' : ''} />
          {computing ? 'Berechne…' : 'Neu berechnen (48h)'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Touren (30 Tage)"
          value={s.tripsCount.toString()}
          sub={`${s.deliveriesCount} Lieferungen`}
          icon={<Truck size={12} />}
        />
        <KpiCard
          label="Gesamtkosten"
          value={euro(s.totalCostEur)}
          sub={`Ø ${euro(s.totalCostEur / Math.max(1, s.tripsCount))} / Tour`}
          icon={<Calculator size={12} />}
        />
        <KpiCard
          label="Gesamt-Marge"
          value={euro(s.totalMarginEur)}
          sub={pct(s.overallMarginPct)}
          icon={s.totalMarginEur >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          warn={s.totalMarginEur < 0}
        />
        <KpiCard
          label="Ø Marge / Tour"
          value={s.avgMarginPerTripEur != null ? euro(s.avgMarginPerTripEur) : '—'}
          sub={`${s.totalDistanceKm.toFixed(0)} km gesamt`}
          icon={<DollarSign size={12} />}
          warn={(s.avgMarginPerTripEur ?? 0) < 0}
        />
        <KpiCard
          label="Verlustfahrten"
          value={`${s.lossTrips}`}
          sub={pct(s.lossTriPct) + ' der Touren'}
          icon={<AlertTriangle size={12} />}
          warn={s.lossTrips > 0}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t.id
                ? 'border-matcha-700 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Übersicht ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* 14-day margin trend */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-matcha-700" /> 14-Tage Margen-Trend
            </h3>
            {dailyTrend14d.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Daten — starte eine Berechnung.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {dailyTrend14d.map((d) => {
                  const isLoss = d.totalMarginEur < 0;
                  const h = Math.round((Math.abs(d.totalMarginEur) / maxMargin) * 100);
                  return (
                    <div key={d.snapshotDate} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                        {d.snapshotDate.slice(5)}: {euro(d.totalMarginEur)}
                      </div>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={cn('w-full rounded-t transition-all', isLoss ? 'bg-red-400' : 'bg-emerald-500')}
                          style={{ height: `${Math.max(4, h)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{d.snapshotDate.slice(8)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Gewinn</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Verlust</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-display text-base font-bold mb-4 flex items-center gap-2">
              <Calculator size={16} className="text-matcha-700" /> Kostenstruktur (30 Tage)
            </h3>
            {costBreakdown.totalCostEur === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Kostendaten verfügbar.</p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Fahrerlohn (Zeit)', pct: costBreakdown.driverTimePct, icon: <Truck size={14} />, color: 'bg-blue-500' },
                  { label: 'Kraftstoff / Verschleiß', pct: costBreakdown.fuelKmPct, icon: <Fuel size={14} />, color: 'bg-amber-500' },
                  { label: 'Verpackung', pct: costBreakdown.packagingPct, icon: <Package size={14} />, color: 'bg-purple-500' },
                  { label: 'Versicherung', pct: costBreakdown.insurancePct, icon: <ShieldCheck size={14} />, color: 'bg-gray-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-muted-foreground">{item.icon}</span>
                    <span className="text-sm w-40 shrink-0">{item.label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', item.color)}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-14 text-right">{item.pct.toFixed(1)} %</span>
                  </div>
                ))}
                <div className="pt-2 border-t text-sm font-bold flex justify-between">
                  <span>Gesamtkosten (30 Tage)</span>
                  <span>{euro(costBreakdown.totalCostEur)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Daily table */}
          {dailyTrend14d.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Datum', 'Touren', 'Lieferungen', 'Kosten', 'Marge', 'Margin %', 'Verlust'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dailyTrend14d].reverse().map((d) => (
                    <tr key={d.snapshotDate} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs">{d.snapshotDate}</td>
                      <td className="px-3 py-2">{d.tripsCount}</td>
                      <td className="px-3 py-2">{d.deliveriesCount}</td>
                      <td className="px-3 py-2">{euro(d.totalCostEur)}</td>
                      <td className={cn('px-3 py-2 font-semibold', marginColor(d.marginPct))}>
                        {euro(d.totalMarginEur)}
                      </td>
                      <td className={cn('px-3 py-2', marginColor(d.marginPct))}>
                        {pct(d.marginPct)}
                      </td>
                      <td className="px-3 py-2">
                        {d.lossTrips > 0 ? (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{d.lossTrips}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Verlustfahrten ── */}
      {tab === 'loss' && (
        <div className="space-y-4">
          {lossMaking.length === 0 ? (
            <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-6 text-center">
              <TrendingUp size={24} className="text-emerald-600 mx-auto mb-2" />
              <p className="font-semibold text-emerald-700">Keine Verlustfahrten in den letzten 30 Tagen! 🎉</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {lossMaking.length} Touren mit negativer Marge — Kosten übersteigen die Liefergebühr.
              </p>
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Abgeschlossen', 'Stops', 'Distanz', 'Kosten', 'Einnahmen', 'Verlust', 'Fahrzeug'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lossMaking.map((trip) => (
                      <tr key={trip.id} className="border-t border-border hover:bg-red-50/30">
                        <td className="px-3 py-2 font-mono text-xs">
                          {trip.completedAt ? new Date(trip.completedAt).toLocaleString('de-DE', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          }) : '—'}
                        </td>
                        <td className="px-3 py-2">{trip.stopsCount}</td>
                        <td className="px-3 py-2">{trip.totalDistanceKm.toFixed(1)} km</td>
                        <td className="px-3 py-2 font-semibold">{euro(trip.totalCostEur)}</td>
                        <td className="px-3 py-2">{euro(trip.netRevenueEur)}</td>
                        <td className="px-3 py-2 font-bold text-red-600">{euro(trip.grossMarginEur)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{vehicleLabel(trip.vehicleType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Tipp: Erhöhe die Liefergebühr für die betreffenden Zonen oder senke die Kosten durch effizienteres Bündeln.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Fahrer ── */}
      {tab === 'drivers' && (
        <div className="space-y-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Noch keine Fahrer-Kostendaten (30 Tage).</p>
          ) : (
            drivers.map((driver) => {
              const open = expandedDriver === driver.driverId;
              return (
                <div key={driver.driverId} className="rounded-xl border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedDriver(open ? null : driver.driverId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center font-bold text-sm">
                        {(driver.driverName ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm">{driver.driverName ?? 'Unbekannt'}</div>
                        <div className="text-xs text-muted-foreground">
                          {driver.tripsCount} Touren · {vehicleLabel(driver.vehicleType)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className={cn('font-bold text-sm', marginColor(driver.marginPct))}>
                          {driver.marginPct != null ? pct(driver.marginPct) : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">Marge</div>
                      </div>
                      <div className="text-right">
                        <div className={cn('font-bold text-sm', (driver.totalMarginEur ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {euro(driver.totalMarginEur)}
                        </div>
                        <div className="text-xs text-muted-foreground">Gesamt</div>
                      </div>
                      {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-border px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20">
                      <div>
                        <div className="text-xs text-muted-foreground">Lieferungen</div>
                        <div className="font-semibold">{driver.deliveriesCount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Gesamtkosten</div>
                        <div className="font-semibold">{euro(driver.totalCostEur)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Einnahmen</div>
                        <div className="font-semibold">{euro(driver.totalRevenueEur)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Ø Marge / Tour</div>
                        <div className={cn('font-semibold', (driver.avgMarginPerTripEur ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {driver.avgMarginPerTripEur != null ? euro(driver.avgMarginPerTripEur) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Distanz gesamt</div>
                        <div className="font-semibold">{driver.totalDistanceKm.toFixed(1)} km</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Verlustfahrten</div>
                        <div className={cn('font-semibold', driver.lossTrips > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {driver.lossTrips}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Konfiguration ── */}
      {tab === 'config' && cfg && (
        <div className="space-y-6 max-w-lg">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Settings size={16} className="text-matcha-700" /> Kostenkonfiguration
            </h3>
            <p className="text-xs text-muted-foreground">
              Diese Werte fließen in die automatische Kostenberechnung ein.
              Die Konfiguration gilt für alle Touren ab sofort.
            </p>

            {/* Driver hourly */}
            <ConfigField
              label="Fahrer-Stundenlohn (€)"
              value={cfg.costDriverHourlyEur}
              onChange={(v) => setCfg({ ...cfg, costDriverHourlyEur: v })}
              step={0.5}
            />

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Kosten pro km (nach Fahrzeugtyp)</p>
              <div className="space-y-2">
                <ConfigField label="Fahrrad (€/km)" value={cfg.costPerKmBicycleEur} onChange={(v) => setCfg({ ...cfg, costPerKmBicycleEur: v })} step={0.01} />
                <ConfigField label="E-Bike (€/km)" value={cfg.costPerKmEbikeEur} onChange={(v) => setCfg({ ...cfg, costPerKmEbikeEur: v })} step={0.01} />
                <ConfigField label="Scooter (€/km)" value={cfg.costPerKmScooterEur} onChange={(v) => setCfg({ ...cfg, costPerKmScooterEur: v })} step={0.01} />
                <ConfigField label="Moped (€/km)" value={cfg.costPerKmMopedEur} onChange={(v) => setCfg({ ...cfg, costPerKmMopedEur: v })} step={0.01} />
                <ConfigField label="Auto (€/km)" value={cfg.costPerKmCarEur} onChange={(v) => setCfg({ ...cfg, costPerKmCarEur: v })} step={0.01} />
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Fixkosten pro Stopp</p>
              <ConfigField label="Verpackung (€)" value={cfg.costPackagingEur} onChange={(v) => setCfg({ ...cfg, costPackagingEur: v })} step={0.05} />
              <div className="mt-2">
                <ConfigField label="Versicherung (€)" value={cfg.costInsurancePerDel} onChange={(v) => setCfg({ ...cfg, costInsurancePerDel: v })} step={0.05} />
              </div>
            </div>

            <div className="border-t pt-3">
              <ConfigField label="Plattformgebühr (% der Liefergebühr)" value={cfg.platformFeePct} onChange={(v) => setCfg({ ...cfg, platformFeePct: v })} step={0.5} />
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full rounded-lg bg-matcha-700 text-white py-2 text-sm font-medium hover:bg-matcha-800 disabled:opacity-60"
            >
              {saving ? 'Speichern…' : 'Konfiguration speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigField({
  label, value, onChange, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm">{label}</label>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 border border-border rounded-md px-2 py-1 text-sm text-right bg-background"
      />
    </div>
  );
}
