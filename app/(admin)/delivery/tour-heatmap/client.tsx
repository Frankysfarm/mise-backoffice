'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Map as MapIcon, RefreshCw, AlertTriangle, CheckCircle,
  BarChart3, Settings, Layers, Clock, TrendingDown,
} from 'lucide-react';

interface HeatmapTile {
  gridLat: number;
  gridLng: number;
  dateBucket: string;
  tourCount: number;
  stopCount: number;
  avgDeliveryMin: number | null;
  lateStops: number;
  zoneLabel: string | null;
  lateRate: number | null;
}

interface UnderservedZone {
  id: string;
  gridLat: number;
  gridLng: number;
  zoneLabel: string | null;
  avgDeliveryMin: number | null;
  stopCount: number;
  lateRate: number | null;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
}

interface HeatmapSummary {
  tilesTotal: number;
  stopsCovered: number;
  underservedCount: number;
  underservedHigh: number;
  avgDeliveryMin: number | null;
  lateRateOverall: number | null;
  lastComputed: string | null;
}

interface ZoneStat {
  zone: string;
  stopCount: number;
  avgDeliveryMin: number | null;
  lateRate: number | null;
}

interface HeatmapConfig {
  lookbackDays: number;
  lateThresholdMin: number;
  underservedMinStops: number;
  underservedLateRatePct: number;
  enabled: boolean;
}

interface Dashboard {
  summary: HeatmapSummary;
  tiles: HeatmapTile[];
  underservedZones: UnderservedZone[];
  tilesByZone: ZoneStat[];
  config: HeatmapConfig;
}

const SEV_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low:    'bg-yellow-100 text-yellow-800',
};

const SEV_LABELS: Record<string, string> = {
  high: 'Kritisch',
  medium: 'Mittel',
  low: 'Gering',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)} Min.`;
  if (h < 24) return `${h} Std.`;
  return `${Math.floor(h / 24)} Tage`;
}

export function TourHeatmapClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<'underserved' | 'tiles' | 'zones' | 'config'>('underserved');
  const [computing, setComputing] = useState(false);
  const [configPatch, setConfigPatch] = useState<Partial<HeatmapConfig>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/delivery/admin/tour-heatmap?action=dashboard');
    if (res.ok) setDashboard(await res.json() as Dashboard);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function compute() {
    setComputing(true);
    await fetch('/api/delivery/admin/tour-heatmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compute' }),
    });
    await load();
    setComputing(false);
  }

  async function saveConfig() {
    setSavingConfig(true);
    await fetch('/api/delivery/admin/tour-heatmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_config', ...configPatch }),
    });
    await load();
    setSavingConfig(false);
    setConfigPatch({});
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const { summary, tiles, underservedZones, tilesByZone, config } = dashboard;

  // Aggregiere Kacheln nach Zelle (letzte 7 Tage vs. gesamt)
  const cellMap = new Map<string, { stops: number; lateStops: number; avgMins: number[]; zone: string | null; lat: number; lng: number }>();
  for (const t of tiles) {
    const key = `${t.gridLat}|${t.gridLng}`;
    let acc = cellMap.get(key);
    if (!acc) { acc = { stops: 0, lateStops: 0, avgMins: [], zone: null, lat: t.gridLat, lng: t.gridLng }; cellMap.set(key, acc); }
    acc.stops += t.stopCount;
    acc.lateStops += t.lateStops;
    if (t.avgDeliveryMin != null) acc.avgMins.push(t.avgDeliveryMin);
    if (t.zoneLabel) acc.zone = t.zoneLabel;
  }
  const topCells = Array.from(cellMap.values())
    .sort((a, b) => b.stops - a.stops)
    .slice(0, 20);

  const effColors = (lateRate: number | null) => {
    if (lateRate == null) return 'bg-slate-100 text-slate-600';
    if (lateRate >= 60) return 'bg-red-100 text-red-700';
    if (lateRate >= 30) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <MapIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Tour Heatmap Engine</h1>
            <p className="text-sm text-muted-foreground">
              Lieferzone-Analyse aus historischen Touren · Unterversorgungs-Erkennung
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.lastComputed && (
            <span className="text-xs text-muted-foreground">
              Letzte Berechnung: {timeAgo(summary.lastComputed)}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" /> Aktualisieren
          </Button>
          <Button size="sm" onClick={compute} disabled={computing}>
            {computing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Layers className="h-3 w-3 mr-1" />}
            {computing ? 'Berechne…' : 'Neu berechnen'}
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-muted-foreground">Kacheln gesamt</span>
          </div>
          <div className="text-2xl font-bold">{summary.tilesTotal.toLocaleString('de-DE')}</div>
          <div className="text-xs text-muted-foreground">{summary.stopsCovered.toLocaleString('de-DE')} Stops abgedeckt</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Unterversorgt</span>
          </div>
          <div className="text-2xl font-bold">{summary.underservedCount}</div>
          <div className="text-xs text-muted-foreground">
            {summary.underservedHigh > 0
              ? <span className="text-red-600 font-medium">{summary.underservedHigh} kritisch</span>
              : 'Keine kritischen Zonen'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Ø Lieferzeit</span>
          </div>
          <div className="text-2xl font-bold">
            {summary.avgDeliveryMin != null ? `${summary.avgDeliveryMin} Min.` : '–'}
          </div>
          <div className="text-xs text-muted-foreground">alle Kacheln</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Verspätungs-Rate</span>
          </div>
          <div className="text-2xl font-bold">
            {summary.lateRateOverall != null ? `${summary.lateRateOverall}%` : '–'}
          </div>
          <div className="text-xs text-muted-foreground">Stops {'>'} {config.lateThresholdMin} Min.</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['underserved', 'tiles', 'zones', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'underserved' && `Unterversorgte Zonen${summary.underservedHigh > 0 ? ` (${summary.underservedHigh})` : ''}`}
            {t === 'tiles' && 'Top Kacheln'}
            {t === 'zones' && 'Zonen-Statistik'}
            {t === 'config' && 'Konfiguration'}
          </button>
        ))}
      </div>

      {/* Tab: Unterversorgte Zonen */}
      {tab === 'underserved' && (
        <div className="space-y-3">
          {underservedZones.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-medium">Keine unterversorgten Zonen erkannt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Alle Lieferkacheln liegen unter der Verspätungs-Schwelle.
              </p>
            </Card>
          ) : (
            underservedZones.map((zone) => (
              <Card key={zone.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg ${zone.severity === 'high' ? 'bg-red-100' : zone.severity === 'medium' ? 'bg-amber-100' : 'bg-yellow-100'}`}>
                      <AlertTriangle className={`h-4 w-4 ${zone.severity === 'high' ? 'text-red-600' : zone.severity === 'medium' ? 'text-amber-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          Gitter {zone.gridLat.toFixed(3)}° N, {zone.gridLng.toFixed(3)}° E
                        </span>
                        <Badge className={SEV_COLORS[zone.severity]}>{SEV_LABELS[zone.severity]}</Badge>
                        {zone.zoneLabel && (
                          <Badge variant="outline">Zone {zone.zoneLabel}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>{zone.stopCount} Stops</span>
                        {zone.lateRate != null && (
                          <span className="text-amber-600 font-medium">{zone.lateRate}% verspätet</span>
                        )}
                        {zone.avgDeliveryMin != null && (
                          <span>Ø {zone.avgDeliveryMin} Min.</span>
                        )}
                        <span>Erkannt: {timeAgo(zone.detectedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/@${zone.gridLat},${zone.gridLng},14z`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap ml-4"
                  >
                    Maps →
                  </a>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab: Top Kacheln */}
      {tab === 'tiles' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Top-20 Kacheln nach Liefervolumen (letzte 30 Tage)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">Koordinaten</th>
                  <th className="text-left py-2 pr-4">Zone</th>
                  <th className="text-right py-2 pr-4">Stops</th>
                  <th className="text-right py-2 pr-4">Touren</th>
                  <th className="text-right py-2 pr-4">Ø Min.</th>
                  <th className="text-right py-2">Verspätet</th>
                </tr>
              </thead>
              <tbody>
                {topCells.map((cell) => {
                  const avgMin = cell.avgMins.length > 0
                    ? Math.round(cell.avgMins.reduce((s, v) => s + v, 0) / cell.avgMins.length)
                    : null;
                  const lateRate = cell.stops > 0 ? Math.round((cell.lateStops / cell.stops) * 100) : null;
                  return (
                    <tr key={`${cell.lat}|${cell.lng}`} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {cell.lat.toFixed(3)}°N, {cell.lng.toFixed(3)}°E
                      </td>
                      <td className="py-2 pr-4">
                        {cell.zone ? <Badge variant="outline" className="text-xs">Zone {cell.zone}</Badge> : '–'}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium">{cell.stops}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{cell.stops}</td>
                      <td className="py-2 pr-4 text-right">{avgMin != null ? `${avgMin}` : '–'}</td>
                      <td className="py-2 text-right">
                        {lateRate != null ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${effColors(lateRate)}`}>
                            {lateRate}%
                          </span>
                        ) : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Zonen-Statistik */}
      {tab === 'zones' && (
        <div className="space-y-2">
          {tilesByZone.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Zonen-Daten vorhanden.</p>
          ) : (
            tilesByZone.map((z) => {
              const lateBar = z.lateRate ?? 0;
              return (
                <Card key={z.zone} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium">{z.zone === 'Unbekannt' ? 'Unbekannte Zone' : `Zone ${z.zone}`}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{z.stopCount.toLocaleString('de-DE')} Stops</span>
                      {z.avgDeliveryMin != null && <span>Ø {z.avgDeliveryMin} Min.</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${lateBar >= 50 ? 'bg-red-400' : lateBar >= 25 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(lateBar, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium min-w-[60px] text-right">
                      {z.lateRate != null ? `${z.lateRate}% spät` : '–'}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Konfiguration */}
      {tab === 'config' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Heatmap-Konfiguration</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-sm font-medium">Analyse-Zeitraum (Tage)</label>
              <input
                type="number"
                min={7} max={90}
                defaultValue={config.lookbackDays}
                onChange={(e) => setConfigPatch((p) => ({ ...p, lookbackDays: parseInt(e.target.value) || 30 }))}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground mt-1">Tage zurück für Kachel-Aggregation</p>
            </div>
            <div>
              <label className="text-sm font-medium">Verspätungs-Schwelle (Min.)</label>
              <input
                type="number"
                min={20} max={120}
                defaultValue={config.lateThresholdMin}
                onChange={(e) => setConfigPatch((p) => ({ ...p, lateThresholdMin: parseInt(e.target.value) || 45 }))}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground mt-1">Ab wann gilt ein Stop als &quot;verspätet&quot;</p>
            </div>
            <div>
              <label className="text-sm font-medium">Min. Stops für Unterversorgungs-Erkennung</label>
              <input
                type="number"
                min={1} max={20}
                defaultValue={config.underservedMinStops}
                onChange={(e) => setConfigPatch((p) => ({ ...p, underservedMinStops: parseInt(e.target.value) || 3 }))}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground mt-1">Mindeststops damit eine Kachel analysiert wird</p>
            </div>
            <div>
              <label className="text-sm font-medium">Unterversorgungs-Verspätungsrate (%)</label>
              <input
                type="number"
                min={20} max={90}
                defaultValue={config.underservedLateRatePct}
                onChange={(e) => setConfigPatch((p) => ({ ...p, underservedLateRatePct: parseFloat(e.target.value) || 40 }))}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground mt-1">Rate ab der eine Zone als &quot;unterversorgt&quot; gilt</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={config.enabled}
                onChange={(e) => setConfigPatch((p) => ({ ...p, enabled: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Heatmap-Engine aktiviert</span>
            </label>
          </div>
          <Button
            onClick={saveConfig}
            disabled={savingConfig || Object.keys(configPatch).length === 0}
            size="sm"
          >
            {savingConfig ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
            Konfiguration speichern
          </Button>
        </Card>
      )}
    </div>
  );
}
