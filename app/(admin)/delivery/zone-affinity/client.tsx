'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MapPin, RefreshCw, Award, Target, TrendingUp,
  ChevronDown, ChevronUp, Info, Users, Clock,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

type ZoneName = 'A' | 'B' | 'C' | 'D';

interface ZoneAffinityRow {
  driverId: string;
  driverName: string;
  locationId: string;
  zoneAScore: number | null;
  zoneBScore: number | null;
  zoneCScore: number | null;
  zoneDScore: number | null;
  zoneADeliveries: number;
  zoneBDeliveries: number;
  zoneCDeliveries: number;
  zoneDDeliveries: number;
  totalZoneDeliveries: number;
  lastZoneDeliveryAt: string | null;
}

interface ZoneCoverageStats {
  zone: ZoneName;
  driversActive: number;
  totalDeliveries: number;
  avgAffinityScore: number | null;
  onTimePct: number | null;
  avgDeliveryMin: number | null;
}

interface TopDriverEntry {
  driverId: string;
  driverName: string;
  score: number;
}

interface Dashboard {
  matrix: ZoneAffinityRow[];
  coverage: ZoneCoverageStats[];
  topDriverPerZone: Record<ZoneName, TopDriverEntry | null>;
  lastUpdated: string | null;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const ZONE_LABELS: Record<ZoneName, string> = {
  A: 'Zone A (Express <3 km)',
  B: 'Zone B (Standard 3–6 km)',
  C: 'Zone C (Weit 6–10 km)',
  D: 'Zone D (Außerhalb >10 km)',
};

const ZONE_COLORS: Record<ZoneName, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-zinc-100 text-zinc-400';
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 50) return 'bg-blue-100 text-blue-800';
  if (score >= 25) return 'bg-amber-100 text-amber-800';
  if (score > 0) return 'bg-orange-100 text-orange-700';
  return 'bg-zinc-100 text-zinc-400';
}

function scoreLabel(score: number | null): string {
  if (score == null) return '–';
  if (score >= 80) return `${score} ★`;
  if (score >= 50) return `${score}`;
  if (score > 0)   return `${score}`;
  return '0';
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'noch nie';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 7)  return `vor ${d} Tagen`;
  return `vor ${Math.floor(d / 7)} Wochen`;
}

function getZoneScore(row: ZoneAffinityRow, zone: ZoneName): number | null {
  switch (zone) {
    case 'A': return row.zoneAScore;
    case 'B': return row.zoneBScore;
    case 'C': return row.zoneCScore;
    case 'D': return row.zoneDScore;
  }
}

function getZoneDeliveries(row: ZoneAffinityRow, zone: ZoneName): number {
  switch (zone) {
    case 'A': return row.zoneADeliveries;
    case 'B': return row.zoneBDeliveries;
    case 'C': return row.zoneCDeliveries;
    case 'D': return row.zoneDDeliveries;
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className={`text-2xl font-black ${color ?? 'text-zinc-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

// ─── Coverage Zone Card ───────────────────────────────────────────────────────

function CoverageCard({ stats, top }: { stats: ZoneCoverageStats; top: TopDriverEntry | null }) {
  const color = ZONE_COLORS[stats.zone];
  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: color }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-black"
          style={{ backgroundColor: color }}>{stats.zone}</span>
        <span className="text-sm font-bold text-zinc-800">{ZONE_LABELS[stats.zone]}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <div className="text-zinc-500">Fahrer aktiv</div>
          <div className="font-bold text-zinc-900">{stats.driversActive}</div>
        </div>
        <div>
          <div className="text-zinc-500">Lieferungen</div>
          <div className="font-bold text-zinc-900">{stats.totalDeliveries}</div>
        </div>
        <div>
          <div className="text-zinc-500">Ø Affinität</div>
          <div className="font-bold" style={{ color }}>
            {stats.avgAffinityScore != null ? `${stats.avgAffinityScore}` : '–'}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Pünktlichkeit</div>
          <div className={`font-bold ${stats.onTimePct != null && stats.onTimePct >= 80 ? 'text-green-700' : 'text-amber-700'}`}>
            {stats.onTimePct != null ? `${stats.onTimePct}%` : '–'}
          </div>
        </div>
      </div>
      {top && (
        <div className="rounded-xl bg-zinc-50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">Top-Fahrer</div>
          <div className="flex items-center gap-1.5">
            <Award className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-bold text-zinc-800">{top.driverName}</span>
            <span className="ml-auto text-xs font-black text-green-700">{top.score}</span>
          </div>
        </div>
      )}
      {!top && (
        <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-400 text-center">
          Noch keine Daten
        </div>
      )}
    </div>
  );
}

// ─── Matrix Row ───────────────────────────────────────────────────────────────

function MatrixRow({ row, expanded, onToggle }: {
  row: ZoneAffinityRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
  const dominantZone = zones.reduce<ZoneName | null>((best, z) => {
    const score = getZoneScore(row, z);
    if (score == null) return best;
    if (!best || score > (getZoneScore(row, best) ?? 0)) return z;
    return best;
  }, null);

  return (
    <>
      <tr
        className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition"
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-700">
              {row.driverName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">{row.driverName}</div>
              <div className="text-[11px] text-zinc-400">{timeAgo(row.lastZoneDeliveryAt)}</div>
            </div>
          </div>
        </td>
        {zones.map((z) => {
          const score = getZoneScore(row, z);
          const deliveries = getZoneDeliveries(row, z);
          return (
            <td key={z} className="py-3 px-3 text-center">
              <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold min-w-[2.5rem] ${scoreColor(score)}`}>
                {scoreLabel(score)}
              </span>
              {deliveries > 0 && (
                <div className="text-[10px] text-zinc-400 mt-0.5">{deliveries}×</div>
              )}
            </td>
          );
        })}
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {dominantZone && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: ZONE_COLORS[dominantZone] }}>
                {dominantZone}
              </span>
            )}
            <span className="text-xs text-zinc-500">{row.totalZoneDeliveries} total</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-zinc-50 border-b border-zinc-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-4 gap-3">
              {zones.map((z) => {
                const score = getZoneScore(row, z);
                const deliveries = getZoneDeliveries(row, z);
                const familiarity = Math.min(60, deliveries * 3);
                const performance = score != null ? score - familiarity : 0;
                return (
                  <div key={z} className="rounded-xl border bg-white p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                        style={{ backgroundColor: ZONE_COLORS[z] }}>{z}</span>
                      <span className="text-xs font-semibold text-zinc-600">{ZONE_LABELS[z].split(' ')[0]}</span>
                    </div>
                    {score != null && score > 0 ? (
                      <>
                        <div className="text-lg font-black mb-2" style={{ color: ZONE_COLORS[z] }}>{score}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">Routine</span>
                            <span className="font-semibold">{familiarity}/60</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-200">
                            <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(familiarity / 60) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">Pünktlichkeit</span>
                            <span className="font-semibold">{Math.max(0, Math.round(performance))}/40</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-200">
                            <div className="h-1.5 rounded-full bg-green-400" style={{ width: `${(Math.max(0, performance) / 40) * 100}%` }} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-zinc-400 mt-1">Keine Daten</div>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function ZoneAffinityClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/zone-affinity?location_id=${locationId}`);
      const data = await res.json() as Dashboard & { ok: boolean };
      if (data.ok) setDashboard(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetch('/api/delivery/admin/zone-affinity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' }),
    });
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-zinc-500 text-sm">Lade Zonen-Affinität …</div>
    );
  }

  const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
  const totalDrivers = dashboard?.matrix.length ?? 0;
  const coveredZones = zones.filter((z) =>
    (dashboard?.coverage.find((c) => c.zone === z)?.totalDeliveries ?? 0) > 0,
  ).length;
  const totalDeliveries = dashboard?.coverage.reduce((s, c) => s + c.totalDeliveries, 0) ?? 0;
  const avgOnTime = (() => {
    const c = (dashboard?.coverage ?? []).filter((s) => s.onTimePct != null);
    if (c.length === 0) return null;
    return Math.round(c.reduce((s, r) => s + (r.onTimePct ?? 0), 0) / c.length);
  })();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header-Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {dashboard?.lastUpdated
            ? `Letzte Aktivität: ${timeAgo(dashboard.lastUpdated)}`
            : 'Noch keine Daten'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
          >
            <Info className="h-3.5 w-3.5" />
            Info
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Aktualisieren …' : 'Neu berechnen'}
          </button>
        </div>
      </div>

      {/* Info Box */}
      {showInfo && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 space-y-2">
          <div className="font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Wie funktioniert die Zonen-Affinität?
          </div>
          <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
            <li><strong>Affinität 0–100</strong>: Kombiniert aus Routine (60%) und Pünktlichkeit (40%).</li>
            <li><strong>Routine</strong>: Wächst mit jeder Lieferung in einer Zone (volles Gewicht bei 20+ Lieferungen).</li>
            <li><strong>Pünktlichkeit</strong>: Anteil der Lieferungen innerhalb des ETA-Fensters.</li>
            <li><strong>Dispatch-Einfluss</strong>: Score fließt in Faktor F5 (Zonenpassung) beim Smart-Dispatch ein.</li>
            <li>Daten werden automatisch nach jeder Lieferung aktualisiert.</li>
          </ul>
        </div>
      )}

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Aktive Fahrer"
          value={String(totalDrivers)}
          sub="mit Zone-Daten"
          color="text-zinc-900"
        />
        <KpiCard
          label="Zonen abgedeckt"
          value={`${coveredZones}/4`}
          sub="Zonen mit Lieferungen"
          color={coveredZones === 4 ? 'text-green-700' : coveredZones >= 2 ? 'text-amber-700' : 'text-red-700'}
        />
        <KpiCard
          label="Zone-Lieferungen"
          value={String(totalDeliveries)}
          sub="gesamt historisch"
          color="text-blue-700"
        />
        <KpiCard
          label="Ø Pünktlichkeit"
          value={avgOnTime != null ? `${avgOnTime}%` : '–'}
          sub="aller Zonen"
          color={avgOnTime == null ? 'text-zinc-400' : avgOnTime >= 80 ? 'text-green-700' : 'text-amber-700'}
        />
      </div>

      {/* Zonen-Coverage-Karten */}
      <div>
        <h2 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-zinc-500" />
          Zonen-Übersicht
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {zones.map((z) => {
            const stats = dashboard?.coverage.find((c) => c.zone === z) ?? {
              zone: z, driversActive: 0, totalDeliveries: 0,
              avgAffinityScore: null, onTimePct: null, avgDeliveryMin: null,
            };
            const top = dashboard?.topDriverPerZone[z] ?? null;
            return <CoverageCard key={z} stats={stats} top={top} />;
          })}
        </div>
      </div>

      {/* Affinitäts-Matrix */}
      <div>
        <h2 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          Fahrer × Zonen Matrix
          <span className="ml-auto text-[11px] font-normal text-zinc-400">Klicken für Details</span>
        </h2>
        {(dashboard?.matrix.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <div className="font-semibold">Noch keine Zonen-Daten</div>
            <div className="mt-1 text-xs">Zonen-Affinität wird nach der ersten Lieferung automatisch erfasst.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="py-3 px-4 text-left text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    Fahrer
                  </th>
                  {zones.map((z) => (
                    <th key={z} className="py-3 px-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ color: ZONE_COLORS[z] }}>
                      Zone {z}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    Stärke
                  </th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.matrix ?? []).map((row) => (
                  <MatrixRow
                    key={row.driverId}
                    row={row}
                    expanded={expandedRow === row.driverId}
                    onToggle={() => setExpandedRow(expandedRow === row.driverId ? null : row.driverId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score-Legende */}
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
        <div className="text-xs font-bold text-zinc-600 mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Score-Legende
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-green-100 text-green-800 font-semibold">80–100 ★ Experte</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold">50–79 Vertraut</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-amber-100 text-amber-800 font-semibold">25–49 Bekannt</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-orange-100 text-orange-700 font-semibold">1–24 Neu</span>
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 bg-zinc-100 text-zinc-400 font-semibold">– Keine Daten</span>
          <span className="ml-auto flex items-center gap-1 text-zinc-400">
            <Clock className="h-3 w-3" />
            Aktualisiert alle 2 Min
          </span>
        </div>
      </div>
    </div>
  );
}
