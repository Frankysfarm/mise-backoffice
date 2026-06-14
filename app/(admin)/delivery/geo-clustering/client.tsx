'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Crosshair, RefreshCw, Settings, BarChart3, MapPin, Clock, TrendingUp, Loader2,
} from 'lucide-react';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface GeoCluster {
  id: string;
  cluster_idx: number;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  order_count: number;
  peak_hour: number | null;
  avg_hour: number | null;
  label: string | null;
  demand_score: number;
  updated_at: string;
}

interface ClusterConfig {
  k_clusters: number;
  lookback_days: number;
  min_orders: number;
  enabled: boolean;
  last_computed: string | null;
}

interface ClusterStats {
  total_clusters: number;
  total_orders_analyzed: number;
  avg_demand_score: number;
  top_cluster_orders: number;
  last_computed: string | null;
}

interface Dashboard {
  config: ClusterConfig;
  clusters: GeoCluster[];
  stats: ClusterStats;
}

// ─── Farb-Schema nach Demand-Score ───────────────────────────────────────────

function demandColor(score: number): string {
  if (score >= 80) return '#ef4444'; // rot: sehr hohe Nachfrage
  if (score >= 60) return '#f97316'; // orange
  if (score >= 40) return '#f59e0b'; // amber
  if (score >= 20) return '#22c55e'; // grün
  return '#6b7280';                  // grau: niedrig
}

function demandLabel(score: number): string {
  if (score >= 80) return 'Sehr hoch';
  if (score >= 60) return 'Hoch';
  if (score >= 40) return 'Mittel';
  if (score >= 20) return 'Niedrig';
  return 'Sehr niedrig';
}

function hourLabel(h: number | null): string {
  if (h === null) return '—';
  const ap = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${ap}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Karte (SVG-basiertes Scatter-Plot) ──────────────────────────────────────

function ClusterMap({ clusters }: { clusters: GeoCluster[] }) {
  if (clusters.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground bg-muted/30 rounded-xl border border-border">
        Noch keine Cluster berechnet. Klicke „Cluster berechnen".
      </div>
    );
  }

  const lats = clusters.map((c) => c.center_lat);
  const lngs = clusters.map((c) => c.center_lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const pad = 0.005;
  const latRange = Math.max(maxLat - minLat, 0.01) + pad * 2;
  const lngRange = Math.max(maxLng - minLng, 0.01) + pad * 2;

  const toX = (lng: number) => ((lng - minLng + pad) / lngRange) * 100;
  const toY = (lat: number) => 100 - ((lat - minLat + pad) / latRange) * 100;

  const maxOrders = Math.max(...clusters.map((c) => c.order_count), 1);

  return (
    <div className="relative bg-slate-50 dark:bg-slate-900 rounded-xl border border-border overflow-hidden" style={{ height: 220 }}>
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* Hintergrund-Raster */}
        {[20, 40, 60, 80].map((v) => (
          <g key={v}>
            <line x1={v} y1="0" x2={v} y2="100" stroke="#e2e8f0" strokeWidth="0.3" />
            <line x1="0" y1={v} x2="100" y2={v} stroke="#e2e8f0" strokeWidth="0.3" />
          </g>
        ))}
        {/* Cluster-Kreise */}
        {clusters.map((c) => {
          const cx = toX(c.center_lng);
          const cy = toY(c.center_lat);
          const r  = 3 + (c.order_count / maxOrders) * 8;
          const color = demandColor(c.demand_score);
          return (
            <g key={c.cluster_idx}>
              <circle cx={cx} cy={cy} r={r + 2} fill={color} opacity={0.15} />
              <circle cx={cx} cy={cy} r={r}     fill={color} opacity={0.6}  />
              <circle cx={cx} cy={cy} r={1.5}   fill={color} opacity={1}    />
              <text
                x={cx}
                y={cy - r - 1.5}
                textAnchor="middle"
                fontSize="3"
                fill="#1e293b"
                fontWeight="600"
              >
                {c.label ?? `C${c.cluster_idx + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 right-2 flex gap-1.5 flex-wrap">
        {[
          { color: '#ef4444', label: 'Sehr hoch' },
          { color: '#f59e0b', label: 'Mittel' },
          { color: '#22c55e', label: 'Niedrig' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[9px] font-medium text-slate-600 bg-white/80 rounded px-1.5 py-0.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Cluster-Karte ────────────────────────────────────────────────────────────

function ClusterCard({
  cluster,
  onLabelSave,
}: {
  cluster: GeoCluster;
  onLabelSave: (idx: number, label: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [label, setLabel]       = useState(cluster.label ?? '');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onLabelSave(cluster.cluster_idx, label);
    setSaving(false);
    setEditing(false);
  };

  const color = demandColor(cluster.demand_score);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: color }}
          />
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                className="border border-input rounded px-2 py-0.5 text-sm w-32"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label eingeben…"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              />
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 px-2 text-xs">
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
              </Button>
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="font-display font-bold text-sm hover:underline"
            >
              {cluster.label ?? `Cluster ${cluster.cluster_idx + 1}`}
            </button>
          )}
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: color + '20', color }}
        >
          {demandLabel(cluster.demand_score)}
        </span>
      </div>

      {/* Score-Bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Demand-Score</span>
          <span className="font-bold text-foreground">{cluster.demand_score}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${cluster.demand_score}%`, background: color }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <BarChart3 size={10} />
          <span>Bestellungen:</span>
          <span className="font-bold text-foreground ml-auto">{cluster.order_count}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock size={10} />
          <span>Peak-Stunde:</span>
          <span className="font-bold text-foreground ml-auto">{hourLabel(cluster.peak_hour)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin size={10} />
          <span>Radius:</span>
          <span className="font-bold text-foreground ml-auto">{cluster.radius_km} km</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingUp size={10} />
          <span>Ø Stunde:</span>
          <span className="font-bold text-foreground ml-auto">
            {cluster.avg_hour !== null ? `${cluster.avg_hour}h` : '—'}
          </span>
        </div>
      </div>

      {/* Koordinaten */}
      <div className="text-[10px] text-muted-foreground font-mono">
        {cluster.center_lat.toFixed(5)}, {cluster.center_lng.toFixed(5)}
      </div>
    </div>
  );
}

// ─── Konfig-Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
}: {
  config: ClusterConfig;
  onSave: (patch: Partial<ClusterConfig>) => Promise<void>;
}) {
  const [k,       setK]       = useState(config.k_clusters);
  const [days,    setDays]    = useState(config.lookback_days);
  const [minOrd,  setMinOrd]  = useState(config.min_orders);
  const [enabled, setEnabled] = useState(config.enabled);
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ k_clusters: k, lookback_days: days, min_orders: minOrd, enabled });
    setSaving(false);
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-xl bg-card">
      <h3 className="font-display font-bold text-sm flex items-center gap-2">
        <Settings size={14} />
        Clustering-Konfiguration
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Cluster (K)</span>
          <input
            type="number" min={2} max={12} value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="w-full border border-input rounded px-3 py-1.5 text-sm"
          />
          <span className="text-[10px] text-muted-foreground">2–12 Cluster</span>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Zeitraum (Tage)</span>
          <input
            type="number" min={7} max={90} value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full border border-input rounded px-3 py-1.5 text-sm"
          />
          <span className="text-[10px] text-muted-foreground">7–90 Tage Verlauf</span>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Min. Bestellungen</span>
          <input
            type="number" min={1} max={50} value={minOrd}
            onChange={(e) => setMinOrd(Number(e.target.value))}
            className="w-full border border-input rounded px-3 py-1.5 text-sm"
          />
          <span className="text-[10px] text-muted-foreground">Mindestgröße Cluster</span>
        </label>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">Nightly Auto-Compute aktiviert (täglich 04:00 UTC)</span>
      </label>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
        Einstellungen speichern
      </Button>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function GeoClusteringClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [computing, setComputing] = useState(false);
  const [tab,       setTab]       = useState<'overview' | 'config'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/geo-clustering?location_id=${locationId}`);
      if (res.ok) setDashboard(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/geo-clustering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      await load();
    } finally {
      setComputing(false);
    }
  };

  const handleLabelSave = async (clusterIdx: number, label: string) => {
    await fetch('/api/delivery/admin/geo-clustering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_label', cluster_idx: clusterIdx, label, location_id: locationId }),
    });
    await load();
  };

  const handleConfigSave = async (patch: Partial<ClusterConfig>) => {
    await fetch('/api/delivery/admin/geo-clustering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_config', ...patch, location_id: locationId }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={20} />
        Lade Cluster-Daten…
      </div>
    );
  }

  const stats    = dashboard?.stats;
  const clusters = dashboard?.clusters ?? [];
  const config   = dashboard?.config ?? { k_clusters: 5, lookback_days: 30, min_orders: 3, enabled: true, last_computed: null };

  return (
    <div className="space-y-6">
      {/* Aktionsleiste */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Zuletzt berechnet: <span className="font-medium text-foreground">{formatDate(stats?.last_computed ?? null)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className="mr-1.5" />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={() => void handleCompute()} disabled={computing}>
            {computing
              ? <Loader2 size={14} className="animate-spin mr-1.5" />
              : <Crosshair size={14} className="mr-1.5" />}
            Cluster berechnen
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cluster"               value={stats?.total_clusters ?? 0}        icon={<Crosshair size={14} />} />
        <KpiCard label="Bestellungen analysiert" value={stats?.total_orders_analyzed ?? 0} icon={<BarChart3 size={14} />} />
        <KpiCard label="Ø Demand-Score"        value={`${stats?.avg_demand_score ?? 0}`} icon={<TrendingUp size={14} />} />
        <KpiCard label="Top-Cluster Bestellungen" value={stats?.top_cluster_orders ?? 0} icon={<MapPin size={14} />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['overview', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t
                ? 'border-matcha-600 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'overview' ? 'Cluster-Übersicht' : 'Konfiguration'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* SVG-Karte */}
          <div>
            <h2 className="font-display font-bold text-base mb-3">Cluster-Karte</h2>
            <ClusterMap clusters={clusters} />
            <p className="text-[11px] text-muted-foreground mt-2">
              Kreis-Größe = relative Bestellmenge · Farbe = Demand-Score · Klicke auf Label im Cluster-Gitter zum Umbenennen
            </p>
          </div>

          {/* Cluster-Gitter */}
          {clusters.length > 0 ? (
            <div>
              <h2 className="font-display font-bold text-base mb-3">
                Cluster-Details ({clusters.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clusters.map((c) => (
                  <ClusterCard
                    key={c.cluster_idx}
                    cluster={c}
                    onLabelSave={handleLabelSave}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
              <Crosshair size={28} className="mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Noch keine Cluster vorhanden. Klicke auf &quot;Cluster berechnen&quot; um die K-Means-Analyse zu starten.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <ConfigPanel config={config} onSave={handleConfigSave} />
      )}
    </div>
  );
}

// ─── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </Card>
  );
}
