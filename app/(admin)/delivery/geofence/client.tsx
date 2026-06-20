'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Radio, Zap, RefreshCw, Save, Users, ToggleLeft, ToggleRight } from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface GeofenceConfig {
  enabled: boolean;
  ring1_m: number;
  ring2_m: number;
}

interface EventRow {
  id: string;
  order_id: string;
  bestellnummer: string | null;
  ring: 1 | 2;
  event_type: string;
  distance_m: number;
  triggered_at: string;
}

interface Stats {
  scansToday: number;
  driversToday: number;
  ring1Today: number;
  ring2Today: number;
}

interface DashboardData {
  config: GeofenceConfig;
  stats: Stats;
  recentEvents: EventRow[];
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function GeofenceClient() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // Lokale Config-Felder
  const [enabled, setEnabled] = useState(true);
  const [ring1, setRing1]     = useState(300);
  const [ring2, setRing2]     = useState(150);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/geofence');
      if (!res.ok) return;
      const json: DashboardData = await res.json();
      setData(json);
      setEnabled(json.config.enabled);
      setRing1(json.config.ring1_m);
      setRing2(json.config.ring2_m);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_config', enabled, ring1_m: ring1, ring2_m: ring2 }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleScanNow() {
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_now' }),
      });
      await loadData();
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Lade Geofence-Dashboard…
      </div>
    );
  }

  const stats = data?.stats ?? { scansToday: 0, driversToday: 0, ring1Today: 0, ring2Today: 0 };

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Geofence-Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatische Kunden-Push-Benachrichtigungen bei Fahrer-Annäherung
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren
          </Button>
          <Button size="sm" onClick={handleScanNow} disabled={scanning}>
            <Radio className="h-3.5 w-3.5 mr-1" />
            {scanning ? 'Scan läuft…' : 'Jetzt scannen'}
          </Button>
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Radio className="h-4 w-4" />}
          label="Scans heute"
          value={stats.scansToday}
          sub="Cron-Durchläufe"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Fahrer erfasst"
          value={stats.driversToday}
          sub="en_route heute"
        />
        <KpiCard
          icon={<MapPin className="h-4 w-4" />}
          label={`Ring 1 (≤${ring1}m)`}
          value={stats.ring1Today}
          sub="driver_nearby Pushes"
          color="amber"
        />
        <KpiCard
          icon={<Zap className="h-4 w-4" />}
          label={`Ring 2 (≤${ring2}m)`}
          value={stats.ring2Today}
          sub="driver_almost_there Pushes"
          color="matcha"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Konfiguration */}
        <Card className="p-5">
          <h2 className="font-semibold text-sm mb-4">Konfiguration</h2>

          {/* Aktivieren */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium">Geofence-Engine aktiv</p>
              <p className="text-xs text-muted-foreground">
                Cron scannt jede Minute alle aktiven Fahrer
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className="text-matcha-700 hover:text-matcha-900"
            >
              {enabled
                ? <ToggleRight className="h-8 w-8" />
                : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
            </button>
          </div>

          {/* Ring 1 */}
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Ring 1 — Fahrer in der Nähe (driver_nearby)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={1000}
                step={50}
                value={ring1}
                onChange={(e) => setRing1(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="w-16 text-right font-mono text-sm font-bold">{ring1} m</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Push: "Fahrer ist gleich bei dir — bitte bereit halten!"
            </p>
          </div>

          {/* Ring 2 */}
          <div className="mb-5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Ring 2 — Fahrer fast da (driver_almost_there)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={30}
                max={500}
                step={10}
                value={ring2}
                onChange={(e) => setRing2(Number(e.target.value))}
                className="flex-1 accent-matcha-600"
              />
              <span className="w-16 text-right font-mono text-sm font-bold">{ring2} m</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Push: "Dein Fahrer ist in ~2 Minuten bei dir!"
            </p>
          </div>

          {ring2 >= ring1 && (
            <p className="text-xs text-red-600 mb-3">
              ⚠ Ring 2 muss kleiner als Ring 1 sein
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || ring2 >= ring1}
            className="w-full"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Speichere…' : saved ? '✓ Gespeichert' : 'Konfiguration speichern'}
          </Button>
        </Card>

        {/* Visualisierung Radien */}
        <Card className="p-5 flex flex-col">
          <h2 className="font-semibold text-sm mb-4">Geofence-Radien (Vorschau)</h2>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative" style={{ width: 200, height: 200 }}>
              {/* Outer ring */}
              <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                <circle
                  cx={100} cy={100}
                  r={85}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.6}
                />
                <circle
                  cx={100} cy={100}
                  r={Math.round(85 * ring2 / ring1)}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.7}
                />
                <circle cx={100} cy={100} r={6} fill="#1e293b" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-slate-700">🛵 Fahrer</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 justify-center mt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Ring 1: {ring1}m
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-matcha-600 inline-block" /> Ring 2: {ring2}m
            </span>
          </div>
        </Card>
      </div>

      {/* Events-Tabelle */}
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-3">
          Geofence-Events heute ({data?.recentEvents.length ?? 0})
        </h2>

        {(data?.recentEvents.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Noch keine Geofence-Events heute.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left pb-2 pr-4">Zeit</th>
                  <th className="text-left pb-2 pr-4">Bestellung</th>
                  <th className="text-left pb-2 pr-4">Ring</th>
                  <th className="text-right pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data!.recentEvents.map((ev, i) => (
                  <tr key={`${ev.order_id}-${i}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-xs text-muted-foreground font-mono">
                      {new Date(ev.triggered_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-4">
                      {ev.bestellnummer ?? ev.order_id.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-4">
                      {ev.ring === 2 ? (
                        <Badge className="bg-matcha-100 text-matcha-800 text-xs">
                          Ring 2 — fast da
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          Ring 1 — in der Nähe
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <span className="text-xs text-emerald-600 font-medium">Push gesendet</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Auto-Refresh alle 60 Sekunden · Dedup via status_push_log (1 Push je Bestellung + Event)
        </p>
      </Card>

    </div>
  );
}

// ── KPI-Kachel ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color?: 'default' | 'amber' | 'matcha';
}) {
  const colorClass =
    color === 'amber'  ? 'text-amber-600'  :
    color === 'matcha' ? 'text-matcha-700' : 'text-slate-700';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <div className={`font-display text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </Card>
  );
}
