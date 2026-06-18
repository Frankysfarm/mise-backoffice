'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, MapPin, Users, Layers, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const LeafletGeoHeatmap = dynamic(
  () => import('./leaflet-map').then(m => m.LeafletGeoHeatmap),
  { ssr: false, loading: () => <div className="h-96 rounded-xl bg-muted/30 animate-pulse" /> }
);

// ── Typen ──────────────────────────────────────────────────────────────────────

interface HeatmapPoint { lat: number; lng: number; weight: number; zone: string | null }
interface LiveDriverPoint { driverId: string; driverName: string; lat: number; lng: number; status: string; zone: string | null }
interface LiveHeatmap { orderPoints: HeatmapPoint[]; driverPoints: LiveDriverPoint[]; totalActiveOrders: number; totalOnlineDrivers: number; snappedAt: string }
interface HistoricalCell { lat: number; lng: number; zone: string | null; totalOrders: number; activeDays: number; avgPerSnap: number; peakCount: number }
interface ZoneHourCell { zone: string; hourOfDay: number; dayOfWeek: number; snapCount: number; totalOrders: number; avgPerSnap: number; peakOrders: number }
interface Dashboard {
  totalSnaps: number;
  totalCells: number;
  newestBucket: string | null;
  topZone: string | null;
  topCells: HistoricalCell[];
  liveHeatmap: LiveHeatmap;
  zoneUtilization: ZoneHourCell[];
}

// ── Konstanten ─────────────────────────────────────────────────────────────────

const TABS = ['Live', 'Historisch', 'Zonen-Analyse'] as const;
type Tab = typeof TABS[number];

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-matcha-600 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-rose-500 text-white',
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function zoneColor(zone: string | null): string {
  return ZONE_COLORS[zone ?? ''] ?? 'bg-muted text-muted-foreground';
}

function weightColor(weight: number, max: number): string {
  const ratio = max > 0 ? weight / max : 0;
  if (ratio >= 0.8) return 'bg-rose-500';
  if (ratio >= 0.6) return 'bg-orange-400';
  if (ratio >= 0.4) return 'bg-amber-300';
  if (ratio >= 0.2) return 'bg-matcha-400';
  return 'bg-matcha-200';
}

// ── SVG-Karte ──────────────────────────────────────────────────────────────────

interface SvgMapProps {
  points: HeatmapPoint[];
  drivers?: LiveDriverPoint[];
  maxWeight: number;
}

function SvgMap({ points, drivers = [], maxWeight }: SvgMapProps) {
  if (!points.length && !drivers.length) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-muted/30 text-muted-foreground text-sm">
        Keine Koordinaten verfügbar
      </div>
    );
  }

  const allLats = [...points.map(p => p.lat), ...drivers.map(d => d.lat)];
  const allLngs = [...points.map(p => p.lng), ...drivers.map(d => d.lng)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const latRange = maxLat - minLat || 0.1;
  const lngRange = maxLng - minLng || 0.1;

  const W = 600, H = 400;
  const PAD = 20;

  const toX = (lng: number) => PAD + ((lng - minLng) / lngRange) * (W - 2 * PAD);
  const toY = (lat: number) => H - PAD - ((lat - minLat) / latRange) * (H - 2 * PAD);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-xl border bg-slate-950"
      style={{ maxHeight: 320 }}
    >
      {points.map((p, i) => {
        const ratio = maxWeight > 0 ? p.weight / maxWeight : 0;
        const r = 4 + ratio * 12;
        const opacity = 0.3 + ratio * 0.6;
        const fill = ratio >= 0.8 ? '#ef4444' : ratio >= 0.5 ? '#f97316' : ratio >= 0.3 ? '#eab308' : '#4ade80';
        return (
          <circle
            key={i}
            cx={toX(p.lng)}
            cy={toY(p.lat)}
            r={r}
            fill={fill}
            opacity={opacity}
          />
        );
      })}
      {drivers.map((d, i) => (
        <g key={i} transform={`translate(${toX(d.lng)},${toY(d.lat)})`}>
          <circle r={6} fill="#6366f1" stroke="white" strokeWidth={1.5} />
          <text y={-10} textAnchor="middle" fontSize={9} fill="white" className="font-mono">
            {d.driverName.slice(0, 8)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Zonen-Stunden-Matrix ───────────────────────────────────────────────────────

function ZoneHourMatrix({ data }: { data: ZoneHourCell[] }) {
  const zones = [...new Set(data.map(d => d.zone))].sort();
  const [selectedZone, setSelectedZone] = useState(zones[0] ?? 'A');
  const [selectedDow, setSelectedDow] = useState<number | null>(null);

  const filtered = data.filter(
    d => d.zone === selectedZone && (selectedDow === null || d.dayOfWeek === selectedDow),
  );

  const hourMap = new Map<number, number>();
  for (const cell of filtered) {
    hourMap.set(cell.hourOfDay, (hourMap.get(cell.hourOfDay) ?? 0) + cell.avgPerSnap);
  }

  const maxVal = Math.max(...Array.from(hourMap.values()), 0.01);

  if (!data.length) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Noch keine Snapshot-Daten. Cron läuft alle 30 Min.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Zone + Wochentag Filter */}
      <div className="flex flex-wrap gap-2">
        {zones.map(z => (
          <button
            key={z}
            onClick={() => setSelectedZone(z)}
            className={cn('px-3 py-1 rounded-lg text-xs font-bold border transition',
              selectedZone === z ? zoneColor(z) : 'border-border text-muted-foreground hover:bg-muted')}
          >
            Zone {z}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">Filter Wochentag:</span>
        <button
          onClick={() => setSelectedDow(null)}
          className={cn('px-2 py-1 rounded text-xs font-bold border',
            selectedDow === null ? 'bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted')}
        >
          Alle
        </button>
        {DOW_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelectedDow(i)}
            className={cn('px-2 py-1 rounded text-xs font-bold border',
              selectedDow === i ? 'bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 24h Balkendiagramm */}
      <div className="flex items-end gap-1 h-32">
        {HOUR_LABELS.map((label, hour) => {
          const val = hourMap.get(hour) ?? 0;
          const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const color =
            h >= 80 ? 'bg-rose-500' : h >= 60 ? 'bg-orange-400' : h >= 40 ? 'bg-amber-300' : h >= 20 ? 'bg-matcha-500' : 'bg-matcha-200';
          return (
            <div key={hour} className="flex flex-col items-center gap-0.5 flex-1 min-w-0" title={`${label}: Ø ${val.toFixed(1)}`}>
              <div
                className={cn('w-full rounded-t transition-all', color)}
                style={{ height: `${h}%` }}
              />
              {hour % 4 === 0 && (
                <span className="text-[8px] text-muted-foreground">{String(hour).padStart(2, '0')}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Ø Bestellungen/Snapshot · Zone {selectedZone} · {selectedDow !== null ? DOW_LABELS[selectedDow] : 'alle Wochentage'} · 30-Tage-Basis
      </p>
    </div>
  );
}

// ── Historische Heatmap-Tabelle ────────────────────────────────────────────────

function HistoricalTable({ cells }: { cells: HistoricalCell[] }) {
  const maxOrders = Math.max(...cells.map(c => c.totalOrders), 1);
  if (!cells.length) return (
    <div className="text-center py-12 text-sm text-muted-foreground">Noch keine historischen Daten.</div>
  );
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-bold text-[11px] uppercase tracking-wide">Koordinaten</th>
            <th className="px-3 py-2 text-left font-bold text-[11px] uppercase tracking-wide">Zone</th>
            <th className="px-3 py-2 text-right font-bold text-[11px] uppercase tracking-wide">Gesamt</th>
            <th className="px-3 py-2 text-right font-bold text-[11px] uppercase tracking-wide">Ø/Snap</th>
            <th className="px-3 py-2 text-right font-bold text-[11px] uppercase tracking-wide">Peak</th>
            <th className="px-3 py-2 text-left font-bold text-[11px] uppercase tracking-wide">Dichte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cells.slice(0, 100).map((c, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {c.lat.toFixed(3)}, {c.lng.toFixed(3)}
              </td>
              <td className="px-3 py-2">
                {c.zone && (
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', zoneColor(c.zone))}>
                    {c.zone}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-bold">{c.totalOrders}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{c.avgPerSnap.toFixed(1)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{c.peakCount}</td>
              <td className="px-3 py-2 w-24">
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded transition-all', weightColor(c.totalOrders, maxOrders))}
                    style={{ width: `${(c.totalOrders / maxOrders) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Haupt-Client ───────────────────────────────────────────────────────────────

export function GeoHeatmapClient({ locationId }: { locationId: string }) {
  const [tab, setTab] = useState<Tab>('Live');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/geo-heatmap?action=dashboard&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDashboard(d as Dashboard); })
      .catch(() => {})
      .finally(() => { setLoading(false); setLastRefresh(new Date()); });
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  // Auto-Refresh Live-Tab alle 30s
  useEffect(() => {
    if (tab !== 'Live') return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [tab, load]);

  const downloadGeoJSON = async (includeDrivers = false) => {
    setDownloading(true);
    try {
      const resp = await fetch(
        `/api/delivery/admin/geo-heatmap?action=geojson&location_id=${locationId}&days=30&include_drivers=${includeDrivers ? '1' : '0'}`,
      );
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap-${new Date().toISOString().slice(0, 10)}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const live = dashboard?.liveHeatmap;
  const topCells = dashboard?.topCells ?? [];
  const maxWeight = live ? Math.max(...live.orderPoints.map(p => p.weight), 1) : 1;

  return (
    <div className="space-y-6">
      {/* KPI-Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Layers className="h-4 w-4" />}
          label="Snapshots Total"
          value={dashboard ? String(dashboard.totalSnaps) : '…'}
        />
        <KpiCard
          icon={<MapPin className="h-4 w-4" />}
          label="Gitterzellen (30T)"
          value={dashboard ? String(dashboard.totalCells) : '…'}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Live Bestellungen"
          value={live ? String(live.totalActiveOrders) : '…'}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Online Fahrer"
          value={live ? String(live.totalOnlineDrivers) : '…'}
        />
      </div>

      {/* Tab-Header */}
      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition',
              tab === t ? 'bg-matcha-700 text-white' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {dashboard?.topZone && (
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded', zoneColor(dashboard.topZone))}>
              Top-Zone {dashboard.topZone}
            </span>
          )}
          <button
            onClick={() => downloadGeoJSON(false)}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            GeoJSON
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg border hover:bg-muted transition disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tab-Inhalt */}
      {tab === 'Live' && (
        <div className="space-y-4">
          <div className="text-[11px] text-muted-foreground">
            Letzte Aktualisierung: {lastRefresh.toLocaleTimeString('de-DE')} · Auto-Refresh alle 30s
          </div>
          <LeafletGeoHeatmap
            points={live?.orderPoints ?? []}
            drivers={live?.driverPoints ?? []}
            maxWeight={maxWeight}
            height={380}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['A', 'B', 'C', 'D'].map(zone => {
              const count = live?.orderPoints.filter(p => p.zone === zone).reduce((s, p) => s + p.weight, 0) ?? 0;
              return (
                <div key={zone} className="rounded-xl border p-3 flex items-center gap-2">
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0', zoneColor(zone))}>
                    {zone}
                  </span>
                  <div>
                    <div className="text-xs text-muted-foreground">Zone {zone}</div>
                    <div className="font-bold">{count} aktiv</div>
                  </div>
                </div>
              );
            })}
          </div>
          {live && live.driverPoints.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-2">Online-Fahrer ({live.driverPoints.length})</h3>
              <div className="flex flex-wrap gap-2">
                {live.driverPoints.map(d => (
                  <span
                    key={d.driverId}
                    className="text-xs px-2 py-1 rounded-full border bg-indigo-50 text-indigo-700 font-medium"
                  >
                    {d.driverName} · {d.lat.toFixed(3)}, {d.lng.toFixed(3)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Historisch' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Top 100 Gitterzellen der letzten 30 Tage nach Bestellvolumen
            </p>
            <button
              onClick={() => downloadGeoJSON(false)}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-muted transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Als GeoJSON laden
            </button>
          </div>
          <LeafletGeoHeatmap
            points={topCells.map(c => ({ lat: c.lat, lng: c.lng, weight: c.totalOrders, zone: c.zone }))}
            maxWeight={Math.max(...topCells.map(c => c.totalOrders), 1)}
            height={320}
          />
          <HistoricalTable cells={topCells} />
        </div>
      )}

      {tab === 'Zonen-Analyse' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Durchschnittliche Bestelldichte je Zone und Stunde (letzte 30 Tage)
          </p>
          <ZoneHourMatrix data={dashboard?.zoneUtilization ?? []} />
        </div>
      )}
    </div>
  );
}

// ── KPI-Karte ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
