'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Leaf, TreePine, Car, TrendingDown, Bike, RefreshCw, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Co2Summary {
  daysWithData: number;
  totalTours30d: number;
  ecoTours30d: number;
  totalKm30d: number;
  totalCo2Kg30d: number;
  co2SavedKg30d: number;
  ecoRatePct: number;
  treesEquivalent30d: number;
  avgCo2PerTour: number;
}

interface Co2TrendDay {
  snapshotDate: string;
  totalCo2Kg: number;
  co2SavedKg: number;
  ecoRatePct: number;
  totalTours: number;
  ecoTours: number;
  totalDistanceKm: number;
}

interface DriverCo2Row {
  driverId: string;
  driverName: string;
  vehicleType: string;
  tours30d: number;
  distanceKm30d: number;
  co2Kg30d: number;
  co2SavedKg30d: number;
  avgCo2PerTour: number;
  treesEquivalent: number;
}

interface Dashboard {
  summary: Co2Summary | null;
  trend: Co2TrendDay[];
  leaderboard: DriverCo2Row[];
}

// ─── Vehicle icon helper ──────────────────────────────────────────────────────

const VEHICLE_LABELS: Record<string, string> = {
  fahrrad:   '🚲 Fahrrad',
  lastenrad: '📦 Lastenrad',
  ebike:     '⚡ E-Bike',
  moped:     '🛵 Moped',
  motorrad:  '🏍️ Motorrad',
  auto:      '🚗 Auto',
  car:       '🚗 Auto',
};

function vehicleLabel(vt: string): string {
  return VEHICLE_LABELS[vt.toLowerCase()] ?? vt;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent?: string;
}) {
  return (
    <Card className={cn('p-4 border', accent)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">
        <span>{icon}</span>{label}
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: Co2TrendDay[] }) {
  if (trend.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        Noch keine Daten — Snapshot wird täglich um 05:15 UTC generiert.
      </div>
    );
  }

  const maxSaved = Math.max(...trend.map((t) => t.co2SavedKg), 0.001);
  const maxCo2   = Math.max(...trend.map((t) => t.totalCo2Kg), 0.001);
  const maxY     = Math.max(maxSaved, maxCo2);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-emerald-500 inline-block" /> CO₂ eingespart</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-slate-300 inline-block" /> CO₂ emittiert</span>
      </div>
      <div className="flex items-end gap-0.5 h-40 overflow-x-auto pb-1">
        {trend.map((d) => {
          const savedH = maxY > 0 ? (d.co2SavedKg / maxY) * 100 : 0;
          const co2H   = maxY > 0 ? (d.totalCo2Kg / maxY)  * 100 : 0;
          const label  = d.snapshotDate.slice(5); // MM-DD
          return (
            <div key={d.snapshotDate} className="flex flex-col items-center gap-0.5 min-w-[20px] flex-1" title={
              `${d.snapshotDate}\nTouren: ${d.totalTours}\nEco: ${d.ecoTours} (${d.ecoRatePct.toFixed(0)}%)\nCO₂: ${d.totalCo2Kg.toFixed(2)} kg\nEingespart: ${d.co2SavedKg.toFixed(2)} kg`
            }>
              <div className="w-full flex flex-col justify-end" style={{ height: '128px' }}>
                <div className="w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${savedH}%` }} />
                <div className="w-full bg-slate-300 rounded-t-sm mt-0.5" style={{ height: `${co2H}%` }} />
              </div>
              <div className="text-[8px] text-muted-foreground rotate-45 origin-left mt-1">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Eco Rate Ring ────────────────────────────────────────────────────────────

function EcoRateRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const stroke = circ * (1 - pct / 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="96" height="96" className="shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={stroke}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="44" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{pct.toFixed(0)}%</text>
      <text x="48" y="58" textAnchor="middle" fontSize="8" fill="#6b7280">Eco</text>
    </svg>
  );
}

// ─── Driver Leaderboard ───────────────────────────────────────────────────────

function DriverLeaderboard({ rows }: { rows: DriverCo2Row[] }) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Noch keine Fahrer-Daten verfügbar.</div>;
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const isEco = ['fahrrad', 'lastenrad', 'ebike'].includes(r.vehicleType.toLowerCase());
        return (
          <div key={r.driverId} className={cn(
            'flex items-center gap-3 p-3 rounded-xl border',
            i === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-card',
          )}>
            <div className="text-lg w-6 text-center">{medals[i] ?? `#${i + 1}`}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{r.driverName}</div>
              <div className="text-xs text-muted-foreground">{vehicleLabel(r.vehicleType)}</div>
            </div>
            <div className="text-right space-y-0.5">
              <div className={cn('text-sm font-bold', isEco ? 'text-emerald-600' : 'text-slate-600')}>
                {r.co2SavedKg30d.toFixed(2)} kg eingespart
              </div>
              <div className="text-xs text-muted-foreground">
                {r.co2Kg30d.toFixed(2)} kg · {r.tours30d} Touren · {r.distanceKm30d.toFixed(0)} km
              </div>
            </div>
            {isEco && <Leaf className="h-4 w-4 text-emerald-500 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Vehicle Rate Info ────────────────────────────────────────────────────────

function VehicleRateTable() {
  const rates = [
    { label: '🚲 Fahrrad', rate: 0.0,   eco: true },
    { label: '📦 Lastenrad', rate: 0.005, eco: true },
    { label: '⚡ E-Bike',   rate: 0.012, eco: true },
    { label: '🛵 Moped',    rate: 0.065, eco: false },
    { label: '🏍️ Motorrad', rate: 0.103, eco: false },
    { label: '🚗 Auto',     rate: 0.168, eco: false },
  ];
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">CO₂-Raten je Fahrzeugtyp</div>
      <div className="space-y-1.5">
        {rates.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="w-24">{r.label}</span>
            <div className="flex-1 bg-slate-200 rounded-full h-1.5">
              <div
                className={cn('h-1.5 rounded-full', r.eco ? 'bg-emerald-500' : 'bg-slate-500')}
                style={{ width: `${(r.rate / 0.168) * 100}%` }}
              />
            </div>
            <span className={cn('text-xs font-mono w-20 text-right', r.eco ? 'text-emerald-600' : 'text-slate-600')}>
              {r.rate === 0 ? '0.000' : r.rate.toFixed(3)} kg/km
            </span>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mt-3">
        Baseline: Auto (0.168 kg/km) · Baum-Äquivalent: 21.77 kg CO₂/Jahr
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Übersicht', 'Trend', 'Fahrer-Ranking', 'Info'] as const;
type Tab = typeof TABS[number];

// ─── Main Client ──────────────────────────────────────────────────────────────

export function CarbonFootprintClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [tab, setTab] = useState<Tab>('Übersicht');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/carbon-footprint?location_id=${locationId}`);
      const json = await res.json() as { ok: boolean; dashboard?: Dashboard };
      if (json.ok && json.dashboard) setDashboard(json.dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 5 min
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const triggerSnapshot = async () => {
    setSnapping(true);
    try {
      await fetch(`/api/delivery/admin/carbon-footprint?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  const s = dashboard?.summary;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Aktualisieren
        </Button>
        <Button variant="outline" size="sm" onClick={() => void triggerSnapshot()} disabled={snapping}>
          <Play className="h-4 w-4 mr-1" /> Snapshot jetzt
        </Button>
      </div>

      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="CO₂ eingespart (30d)"
          value={s ? `${s.co2SavedKg30d.toFixed(1)} kg` : '—'}
          sub={s ? `≈ ${s.treesEquivalent30d.toFixed(1)} Bäume/Jahr` : undefined}
          icon={<Leaf className="h-3.5 w-3.5 text-emerald-600" />}
          accent="border-emerald-200 bg-emerald-50/50"
        />
        <KpiCard
          label="Eco-Tour-Rate"
          value={s ? `${s.ecoRatePct.toFixed(0)}%` : '—'}
          sub={s ? `${s.ecoTours30d} von ${s.totalTours30d} Touren` : undefined}
          icon={<Bike className="h-3.5 w-3.5 text-emerald-600" />}
        />
        <KpiCard
          label="CO₂ emittiert (30d)"
          value={s ? `${s.totalCo2Kg30d.toFixed(1)} kg` : '—'}
          sub={s ? `Ø ${s.avgCo2PerTour.toFixed(3)} kg/Tour` : undefined}
          icon={<Car className="h-3.5 w-3.5 text-slate-500" />}
        />
        <KpiCard
          label="Gesamtdistanz (30d)"
          value={s ? `${s.totalKm30d.toFixed(0)} km` : '—'}
          sub={s ? `${s.daysWithData} Tage mit Daten` : undefined}
          icon={<TrendingDown className="h-3.5 w-3.5 text-blue-500" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              tab === t ? 'border-matcha-600 text-matcha-700' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {tab === 'Übersicht' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="text-sm font-bold mb-4">Eco-Tour-Rate (30 Tage)</div>
            <div className="flex items-center gap-6">
              <EcoRateRing pct={s?.ecoRatePct ?? 0} />
              <div className="space-y-2 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Eco-Touren</span>
                  <span className="font-semibold text-emerald-600">{s?.ecoTours30d ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gesamt-Touren</span>
                  <span className="font-semibold">{s?.totalTours30d ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bäume/Jahr Äqui.</span>
                  <span className="font-semibold text-green-600">🌳 {s?.treesEquivalent30d.toFixed(1) ?? '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Eingespart</span>
                  <span className="font-semibold text-emerald-600">{s?.co2SavedKg30d.toFixed(1) ?? '0'} kg CO₂</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold mb-4">Top Eco-Fahrer</div>
            {dashboard?.leaderboard?.slice(0, 3).map((r, i) => (
              <div key={r.driverId} className="flex items-center gap-2 py-2 border-b last:border-0">
                <span className="text-base">{['🥇','🥈','🥉'][i]}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.driverName}</div>
                  <div className="text-xs text-muted-foreground">{vehicleLabel(r.vehicleType)}</div>
                </div>
                <div className="text-sm font-bold text-emerald-600">{r.co2SavedKg30d.toFixed(2)} kg</div>
              </div>
            ))}
            {!dashboard?.leaderboard?.length && (
              <div className="text-sm text-muted-foreground py-4 text-center">Keine Daten</div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Trend */}
      {tab === 'Trend' && (
        <Card className="p-5">
          <div className="text-sm font-bold mb-4">CO₂-Trend letzte 30 Tage</div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Laden…</div>
          ) : (
            <TrendChart trend={dashboard?.trend ?? []} />
          )}
          {dashboard?.trend && dashboard.trend.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1.5">Datum</th>
                    <th className="text-right py-1.5">Touren</th>
                    <th className="text-right py-1.5">Eco</th>
                    <th className="text-right py-1.5">Distanz km</th>
                    <th className="text-right py-1.5">CO₂ kg</th>
                    <th className="text-right py-1.5 text-emerald-600">Eingespart kg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dashboard.trend].reverse().slice(0, 14).map((d) => (
                    <tr key={d.snapshotDate} className="border-b hover:bg-slate-50">
                      <td className="py-1.5">{d.snapshotDate}</td>
                      <td className="text-right">{d.totalTours}</td>
                      <td className="text-right text-emerald-600">{d.ecoTours}</td>
                      <td className="text-right">{d.totalDistanceKm.toFixed(1)}</td>
                      <td className="text-right">{d.totalCo2Kg.toFixed(3)}</td>
                      <td className="text-right font-semibold text-emerald-600">{d.co2SavedKg.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Fahrer-Ranking */}
      {tab === 'Fahrer-Ranking' && (
        <Card className="p-5">
          <div className="text-sm font-bold mb-1 flex items-center gap-2">
            <TreePine className="h-4 w-4 text-emerald-600" /> Eco-Champions (30 Tage)
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Sortiert nach CO₂-Einsparung gegenüber Auto-Baseline (0.168 kg/km).
          </div>
          <DriverLeaderboard rows={dashboard?.leaderboard ?? []} />
        </Card>
      )}

      {/* Tab: Info */}
      {tab === 'Info' && (
        <div className="space-y-4">
          <VehicleRateTable />
          <Card className="p-5">
            <div className="text-sm font-bold mb-2">Berechnungs-Methodik</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">CO₂-Emission</strong>: Fahrzeugtyp-Rate × gefahrene km pro Tour
                (aus tour_performance_snapshots.total_route_km).
              </p>
              <p>
                <strong className="text-foreground">CO₂-Einsparung</strong>: Auto-Baseline (0.168 kg/km) × km − tatsächliche Emission.
                Eco-Touren mit Fahrrad/Lastenrad/E-Bike sparen am meisten.
              </p>
              <p>
                <strong className="text-foreground">Baum-Äquivalent</strong>: Ein Baum absorbiert ca. 21,77 kg CO₂ pro Jahr.
                CO₂-Einsparung ÷ 21,77 = Jahres-Bäume-Äquivalent.
              </p>
              <p>
                <strong className="text-foreground">Snapshot-Rhythmus</strong>: Täglich um 05:15 UTC für den Vortag.
                Manueller Trigger über „Snapshot jetzt".
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
