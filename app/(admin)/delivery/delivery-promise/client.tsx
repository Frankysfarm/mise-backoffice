'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, Zap, Target, Timer, ShieldAlert,
} from 'lucide-react';

// ── Types (mirrors lib/delivery/delivery-promise.ts) ─────────────────────────

interface PromiseKpis {
  total7d: number;
  settled7d: number;
  onTimeRatePct: number;
  avgActualMin: number | null;
  avgPromiseMidpoint: number | null;
  avgMissMin: number | null;
  veryLate7d: number;
}

interface PromiseAccuracyDay {
  promiseDate: string;
  totalPromises: number;
  settledCount: number;
  earlyCount: number;
  onTimeCount: number;
  lateCount: number;
  veryLateCount: number;
  onTimeRatePct: number;
  avgActualMin: number | null;
  avgWindowWidthMin: number | null;
  avgMissMin: number | null;
}

interface PromiseDashboard {
  kpis: PromiseKpis;
  trend30d: PromiseAccuracyDay[];
  unsettledCount: number;
  lastComputedAt: string;
}

interface PromiseWindow {
  minMin: number;
  maxMin: number;
  confidenceScore: number;
  label: string;
  queueDepth: number;
  availableDrivers: number;
  weatherFactor: number;
  surgeActive: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function onTimeGrade(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: 'A', color: 'text-green-600' };
  if (pct >= 80) return { label: 'B', color: 'text-lime-600' };
  if (pct >= 70) return { label: 'C', color: 'text-amber-600' };
  if (pct >= 60) return { label: 'D', color: 'text-orange-600' };
  return { label: 'F', color: 'text-red-600' };
}

function onTimeColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 80) return '#84cc16';
  if (pct >= 70) return '#f59e0b';
  if (pct >= 60) return '#f97316';
  return '#ef4444';
}

function formatDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getDate()}.${dt.getMonth() + 1}.`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            {icon}
            {label}
          </div>
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
        </div>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AccuracyGauge({ pct }: { pct: number }) {
  const grade = onTimeGrade(pct);
  const r = 54;
  const circumference = Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 128 72" className="w-40 h-20">
        {/* Background arc */}
        <path
          d="M12,64 A52,52 0 0,1 116,64"
          fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M12,64 A52,52 0 0,1 116,64"
          fill="none"
          stroke={onTimeColor(pct)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <text x="64" y="62" textAnchor="middle" fontSize="20" fontWeight="bold" fill="currentColor">
          {pct.toFixed(1)}%
        </text>
      </svg>
      <span className={`text-2xl font-black ${grade.color}`}>{grade.label}</span>
      <span className="text-xs text-muted-foreground">Pünktlichkeitsrate</span>
    </div>
  );
}

function TrendBar({ day }: { day: PromiseAccuracyDay }) {
  const total = day.earlyCount + day.onTimeCount + day.lateCount + day.veryLateCount;
  if (total === 0) return null;
  const earlyPct    = (day.earlyCount    / total) * 100;
  const onTimePct   = (day.onTimeCount   / total) * 100;
  const latePct     = (day.lateCount     / total) * 100;
  const veryLatePct = (day.veryLateCount / total) * 100;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="h-2 rounded overflow-hidden flex">
        <div style={{ width: `${earlyPct}%`,    backgroundColor: '#3b82f6' }} />
        <div style={{ width: `${onTimePct}%`,   backgroundColor: '#22c55e' }} />
        <div style={{ width: `${latePct}%`,     backgroundColor: '#f59e0b' }} />
        <div style={{ width: `${veryLatePct}%`, backgroundColor: '#ef4444' }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        {formatDate(day.promiseDate)}
      </p>
      <p className="text-[10px] text-center font-medium" style={{ color: onTimeColor(day.onTimeRatePct) }}>
        {day.onTimeRatePct}%
      </p>
    </div>
  );
}

function LivePreview({ locationId }: { locationId: string }) {
  const [win, setWin] = useState<PromiseWindow | null>(null);
  const [loading, setLoading] = useState(false);
  const [zone, setZone] = useState('A');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/delivery/admin/delivery-promise?action=compute&zone=${zone}&location_id=${locationId}`,
      );
      if (r.ok) setWin(await r.json());
    } finally {
      setLoading(false);
    }
  }, [locationId, zone]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          Live-Vorschau — Aktuelles Versprechen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zone:</span>
          {(['A', 'B', 'C', 'D'] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZone(z)}
              className={`px-2 py-0.5 text-xs rounded border transition ${
                zone === z
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {z}
            </button>
          ))}
          <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {win && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-black">{win.label}</span>
              <Badge variant={win.confidenceScore >= 70 ? 'default' : 'secondary'}>
                {win.confidenceScore}% Konfidenz
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>Queue:</span>
                <span className="font-medium text-foreground">{win.queueDepth} Bestellungen</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Fahrer:</span>
                <span className="font-medium text-foreground">{win.availableDrivers} verfügbar</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Wetter:</span>
                <span className={`font-medium ${win.weatherFactor > 1.1 ? 'text-amber-600' : 'text-foreground'}`}>
                  Faktor {win.weatherFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>Surge:</span>
                <span className={`font-medium ${win.surgeActive ? 'text-red-600' : 'text-foreground'}`}>
                  {win.surgeActive ? 'Aktiv 🔥' : 'Inaktiv'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeliveryPromiseClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<PromiseDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/delivery/admin/delivery-promise?action=dashboard&location_id=${locationId}`,
      );
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const handleSettle = async () => {
    setSettling(true);
    try {
      await fetch('/api/delivery/admin/delivery-promise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle_pending' }),
      });
      await load();
    } finally {
      setSettling(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Lade Versprechen-Daten…
      </div>
    );
  }

  const kpis = data?.kpis;
  const trend = data?.trend30d ?? [];
  const grade = onTimeGrade(kpis?.onTimeRatePct ?? 0);

  // Build legend for stacked bar
  const legend = [
    { label: 'Zu früh',    color: '#3b82f6' },
    { label: 'Pünktlich',  color: '#22c55e' },
    { label: 'Spät',       color: '#f59e0b' },
    { label: 'Sehr spät',  color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Letzte Aktualisierung:{' '}
          {data ? new Date(data.lastComputedAt).toLocaleTimeString('de-DE') : '—'}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={handleSettle} disabled={settling}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {settling ? 'Settling…' : `Offene abrechnen (${data?.unsettledCount ?? 0})`}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Pünktlichkeitsrate (7T)"
          value={`${kpis?.onTimeRatePct?.toFixed(1) ?? '0.0'}%`}
          sub={`Note ${grade.label}`}
        />
        <KpiCard
          icon={<Timer className="h-4 w-4" />}
          label="Ø Istlieferzeit (7T)"
          value={kpis?.avgActualMin != null ? `${kpis.avgActualMin.toFixed(0)} min` : '—'}
          sub={`Versprechen Ø: ${kpis?.avgPromiseMidpoint?.toFixed(0) ?? '—'} min`}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Ø Überschreitung"
          value={kpis?.avgMissMin != null ? `${kpis.avgMissMin.toFixed(0)} min` : '—'}
          sub="bei verspäteten Lieferungen"
        />
        <KpiCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Sehr spät (7T)"
          value={String(kpis?.veryLate7d ?? 0)}
          sub={`von ${kpis?.settled7d ?? 0} abgerechneten`}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gauge + Grade */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Genauigkeits-Score (7 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <AccuracyGauge pct={kpis?.onTimeRatePct ?? 0} />
            <div className="w-full grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-muted-foreground">Zu früh</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-muted-foreground">Pünktlich</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-muted-foreground">Spät (&lt;10 min)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                <span className="text-muted-foreground">Sehr spät (&gt;10 min)</span>
              </div>
            </div>
            <div className="w-full text-xs text-muted-foreground text-center border-t pt-2">
              {kpis?.total7d ?? 0} Versprechen · {kpis?.settled7d ?? 0} abgerechnet
            </div>
          </CardContent>
        </Card>

        {/* 30-day trend bars */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              30-Tage Verlauf (Pünktlichkeit je Tag)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Noch keine historischen Daten — Versprechen werden nach Lieferung automatisch abgerechnet.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1 items-end">
                  {[...trend].reverse().map((day) => (
                    <div key={day.promiseDate} className="flex-1 min-w-0">
                      <TrendBar day={day} />
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                  {legend.map((l) => (
                    <span key={l.label} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live preview + daily table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LivePreview locationId={locationId} />

        {/* Last 7 days table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Letzte 7 Tage — Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Keine Daten</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1 font-medium">Datum</th>
                    <th className="text-right py-1 font-medium">Pünktl.</th>
                    <th className="text-right py-1 font-medium">Ø Ist</th>
                    <th className="text-right py-1 font-medium">Ø Miss</th>
                    <th className="text-right py-1 font-medium">Anz.</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.slice(0, 7).map((day) => {
                    const g = onTimeGrade(day.onTimeRatePct);
                    return (
                      <tr key={day.promiseDate} className="border-b last:border-0">
                        <td className="py-1.5">{formatDate(day.promiseDate)}</td>
                        <td className={`text-right font-semibold ${g.color}`}>
                          {day.onTimeRatePct}%
                        </td>
                        <td className="text-right">
                          {day.avgActualMin != null ? `${day.avgActualMin.toFixed(0)}min` : '—'}
                        </td>
                        <td className="text-right">
                          {day.avgMissMin != null ? `+${day.avgMissMin.toFixed(0)}min` : '—'}
                        </td>
                        <td className="text-right text-muted-foreground">{day.settledCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
            So funktioniert die Promise Engine
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Bei jeder Bestellung wird anhand von Zone, Queue-Tiefe, Fahrerverfügbarkeit,
            Wetter-Faktor und Surge-Status ein Lieferfenster (min–max Minuten) berechnet.
            Nach der Lieferung wird das Versprechen abgerechnet und in die Genauigkeits-Statistik
            eingeflossen. Der Engine kalibriert sich automatisch: wenn Versprechen systematisch
            überschritten werden, wird der Puffer für zukünftige Versprechen erhöht.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
