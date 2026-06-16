'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Eye,
  RefreshCw,
  Sun,
  Thermometer,
  TrendingUp,
  Wind,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeatherDashboard, WeatherTrendHour } from '@/lib/delivery/weather-intelligence';

// ── helpers ───────────────────────────────────────────────────────────────────

function difficultyColor(score: number): string {
  if (score >= 80) return 'bg-red-100 text-red-800 border-red-200';
  if (score >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (score >= 40) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (score >= 20) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
}

function difficultyLabel(score: number): string {
  if (score >= 80) return 'Extrem';
  if (score >= 60) return 'Gefährlich';
  if (score >= 40) return 'Schwierig';
  if (score >= 20) return 'Mäßig';
  return 'Normal';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-amber-400';
  if (score >= 20) return 'bg-yellow-300';
  return 'bg-emerald-400';
}

function weatherIcon(code: number | null, className = 'h-6 w-6') {
  if (code == null) return <Cloud className={className} />;
  if (code === 0 || code === 1) return <Sun className={cn(className, 'text-yellow-500')} />;
  if (code <= 3) return <Cloud className={cn(className, 'text-zinc-400')} />;
  if (code === 45 || code === 48) return <Cloud className={cn(className, 'text-zinc-500')} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle className={cn(className, 'text-blue-400')} />;
  if (code >= 61 && code <= 65) return <CloudRain className={cn(className, 'text-blue-500')} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={cn(className, 'text-sky-400')} />;
  if (code >= 80 && code <= 82) return <CloudRain className={cn(className, 'text-blue-600')} />;
  if (code >= 85 && code <= 86) return <CloudSnow className={cn(className, 'text-sky-500')} />;
  if (code >= 95) return <CloudLightning className={cn(className, 'text-yellow-600')} />;
  return <Cloud className={className} />;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color = 'text-zinc-700',
  bg = 'bg-zinc-50',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4', bg)}>
      <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── WeatherCard ───────────────────────────────────────────────────────────────

function WeatherCard({ dash }: { dash: WeatherDashboard }) {
  const c = dash.current;
  if (!c) {
    return (
      <div className="rounded-xl border bg-zinc-50 p-6 text-center text-zinc-400">
        <Cloud className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Keine Wetterdaten verfügbar.</p>
        <p className="text-xs mt-1">Prüfe ob die Location Koordinaten (lat/lng) hat.</p>
      </div>
    );
  }

  const scoreClass = difficultyColor(c.difficultyScore);
  const label      = difficultyLabel(c.difficultyScore);

  return (
    <div className={cn('rounded-xl border p-5', c.isDangerous ? 'border-orange-300 bg-orange-50' : 'bg-white')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {weatherIcon(c.weatherCode, 'h-10 w-10')}
          <div>
            <div className="text-xl font-bold text-zinc-800">
              {c.weatherDesc ?? 'Unbekannt'}
            </div>
            <div className="text-sm text-zinc-500">
              Aktualisiert: {dash.minutesAgo != null ? `vor ${dash.minutesAgo} Min` : '—'}
            </div>
          </div>
        </div>
        <div className={cn('rounded-lg border px-3 py-1 text-sm font-semibold', scoreClass)}>
          {label} ({c.difficultyScore}/100)
        </div>
      </div>

      {c.alertMessage && (
        <div className="mt-3 rounded-lg bg-orange-100 border border-orange-200 px-3 py-2 text-sm text-orange-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{c.alertMessage}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="text-center">
          <Thermometer className="h-4 w-4 text-red-400 mx-auto mb-1" />
          <div className="text-lg font-semibold">{c.tempC != null ? `${c.tempC.toFixed(1)}°C` : '—'}</div>
          <div className="text-xs text-zinc-500">Temperatur</div>
        </div>
        <div className="text-center">
          <Droplets className="h-4 w-4 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-semibold">{c.precipMm != null ? `${c.precipMm.toFixed(1)} mm` : '—'}</div>
          <div className="text-xs text-zinc-500">Niederschlag</div>
        </div>
        <div className="text-center">
          <Wind className="h-4 w-4 text-zinc-400 mx-auto mb-1" />
          <div className="text-lg font-semibold">{c.windKmh != null ? `${c.windKmh.toFixed(0)} km/h` : '—'}</div>
          <div className="text-xs text-zinc-500">Windgeschw.</div>
        </div>
        <div className="text-center">
          <Eye className="h-4 w-4 text-sky-400 mx-auto mb-1" />
          <div className="text-lg font-semibold">{c.visibilityKm != null ? `${c.visibilityKm.toFixed(1)} km` : '—'}</div>
          <div className="text-xs text-zinc-500">Sichtweite</div>
        </div>
      </div>

      {/* Difficulty bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Schwierigkeits-Score</span>
          <span>{c.difficultyScore} / 100</span>
        </div>
        <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor(c.difficultyScore))}
            style={{ width: `${c.difficultyScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── TrendChart ────────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: WeatherTrendHour[] }) {
  if (trend.length === 0) {
    return (
      <div className="text-center text-zinc-400 py-8 text-sm">
        Noch keine 24h-Daten. Cron läuft alle 30 Min.
      </div>
    );
  }

  const reversed = [...trend].reverse(); // oldest first
  const maxDiff  = Math.max(...reversed.map((t) => t.avgDifficulty), 10);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-max">
        {reversed.map((t, i) => {
          const h    = Math.max(4, Math.round((t.avgDifficulty / Math.max(maxDiff, 1)) * 80));
          const col  = barColor(t.avgDifficulty);
          const time = fmtHour(t.hourUtc);
          return (
            <div key={i} className="flex flex-col items-center gap-1 group relative">
              <div
                className={cn('w-6 rounded-t transition-all', col, t.hadDangerous ? 'ring-2 ring-red-400' : '')}
                style={{ height: `${h}px` }}
                title={`${time}: Score ${t.avgDifficulty}, ETA ×${t.avgEtaFactor.toFixed(2)}, Regen ${t.totalPrecipMm.toFixed(1)} mm`}
              />
              <div className="text-[10px] text-zinc-400 rotate-45 origin-left translate-x-2">
                {time}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-400" /> Normal (0–19)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-300" /> Mäßig (20–39)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-400" /> Schwierig (40–59)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-500" /> Gefährlich (60–79)</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> Extrem (80+)</div>
      </div>
    </div>
  );
}

// ── SnapshotTable ─────────────────────────────────────────────────────────────

function SnapshotTable({ snapshots }: { snapshots: WeatherDashboard['recentSnapshots'] }) {
  if (snapshots.length === 0) {
    return <div className="text-sm text-zinc-400 py-4 text-center">Keine Snapshots vorhanden.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 border-b">
            <th className="text-left pb-2 pr-3">Zeit</th>
            <th className="text-left pb-2 pr-3">Wetter</th>
            <th className="text-right pb-2 pr-3">Temp</th>
            <th className="text-right pb-2 pr-3">Regen</th>
            <th className="text-right pb-2 pr-3">Wind</th>
            <th className="text-right pb-2 pr-3">Score</th>
            <th className="text-right pb-2 pr-3">ETA ×</th>
            <th className="text-right pb-2">Nachfrage ×</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.slice(0, 24).map((s) => (
            <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50">
              <td className="py-1.5 pr-3 text-zinc-500 whitespace-nowrap">{fmtTime(s.capturedAt)}</td>
              <td className="py-1.5 pr-3 flex items-center gap-1">
                {weatherIcon(s.weatherCode, 'h-4 w-4')}
                <span className="text-zinc-700">{s.weatherDesc ?? '—'}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-zinc-700">
                {s.tempC != null ? `${s.tempC.toFixed(1)}°C` : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right text-blue-600">
                {s.precipMm != null ? `${s.precipMm.toFixed(1)} mm` : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right text-zinc-600">
                {s.windKmh != null ? `${s.windKmh.toFixed(0)} km/h` : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right">
                <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', difficultyColor(s.difficultyScore))}>
                  {s.difficultyScore}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-zinc-700">
                ×{s.etaFactor.toFixed(2)}
              </td>
              <td className="py-1.5 text-right font-mono text-zinc-700">
                ×{s.demandImpact.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WeatherIntelligenceClient({ locationId }: { locationId: string }) {
  const [dash, setDash]       = useState<WeatherDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [activeTab, setActiveTab] = useState<'trend' | 'history'>('trend');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/weather-intelligence?action=dashboard`);
      if (res.ok) setDash(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(iv);
  }, [load]);

  async function handleSnapshot() {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/weather-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Wetterdaten laden…
      </div>
    );
  }

  const c   = dash?.current ?? null;
  const t24 = dash?.trend24h ?? [];

  // Compute avg difficulty over last 24h
  const avg24h = t24.length > 0
    ? Math.round(t24.reduce((s, t) => s + t.avgDifficulty, 0) / t24.length)
    : null;

  const dangerousHours = t24.filter((t) => t.hadDangerous).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Cron: automatischer Snapshot alle 30 Min. Open-Meteo — kostenlos, kein API-Key.
        </p>
        <button
          onClick={handleSnapshot}
          disabled={snapping}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', snapping && 'animate-spin')} />
          Jetzt aktualisieren
        </button>
      </div>

      {/* Current weather card */}
      {dash && <WeatherCard dash={dash} />}

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Aktueller Score"
          value={c ? `${c.difficultyScore}/100` : '—'}
          sub={c ? difficultyLabel(c.difficultyScore) : 'Keine Daten'}
          color={c && c.difficultyScore >= 60 ? 'text-orange-700' : 'text-emerald-700'}
          bg={c && c.difficultyScore >= 60 ? 'bg-orange-50' : 'bg-emerald-50'}
        />
        <KpiCard
          icon={<Cloud className="h-3.5 w-3.5" />}
          label="ETA-Faktor"
          value={c ? `×${c.etaFactor.toFixed(2)}` : '—'}
          sub={c && c.etaFactor > 1 ? `+${Math.round((c.etaFactor - 1) * 100)}% Lieferzeit` : 'Kein Aufschlag'}
          color="text-blue-700"
          bg="bg-blue-50"
        />
        <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Nachfrage-Faktor"
          value={c ? `×${c.demandImpact.toFixed(2)}` : '—'}
          sub={c && c.demandImpact > 1 ? `+${Math.round((c.demandImpact - 1) * 100)}% mehr Bestellungen erwartet` : 'Normalbestellung'}
          color="text-violet-700"
          bg="bg-violet-50"
        />
        <KpiCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Ø-Score 24h / Gefahr-Stunden"
          value={avg24h != null ? `${avg24h}` : '—'}
          sub={`${dangerousHours} Gefahr-Stunden (Score ≥60)`}
          color={dangerousHours > 0 ? 'text-red-700' : 'text-zinc-700'}
          bg={dangerousHours > 0 ? 'bg-red-50' : 'bg-zinc-50'}
        />
      </div>

      {/* Tabs */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <div className="flex border-b bg-zinc-50">
          {(['trend', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-sky-600 text-sky-700 bg-white'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {tab === 'trend' ? '24h-Verlauf' : 'Snapshot-Verlauf'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'trend' && <TrendChart trend={t24} />}
          {activeTab === 'history' && (
            <SnapshotTable snapshots={dash?.recentSnapshots ?? []} />
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border bg-sky-50 p-5">
        <h3 className="font-semibold text-sky-900 mb-2 flex items-center gap-2">
          <CloudRain className="h-4 w-4" />
          Wie funktioniert der Schwierigkeits-Score?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 text-sm text-sky-800">
          <div>
            <strong>Score 0–19 (Normal):</strong> ETA-Faktor ×1.00 — keine Anpassung.
          </div>
          <div>
            <strong>Score 20–39 (Mäßig):</strong> Leichter Regen / Wind — ETA ×1.10.
          </div>
          <div>
            <strong>Score 40–59 (Schwierig):</strong> Starker Regen / Nebel — ETA ×1.20.
          </div>
          <div>
            <strong>Score 60–79 (Gefährlich):</strong> Gewitter / Sturm — ETA ×1.35, Fahrer-Alert.
          </div>
          <div>
            <strong>Score 80–100 (Extrem):</strong> Starker Schnee / Hagel — ETA ×1.50, Sicherheitsprüfung.
          </div>
          <div>
            <strong>Nachfrage-Faktor:</strong> Regen ×1.20, Gewitter ×1.35 — mehr Bestellungen erwartet.
          </div>
        </div>
        <p className="mt-3 text-xs text-sky-600">
          Datenquelle: Open-Meteo API (open-meteo.com) — kostenlos, ohne API-Key, WMO-konforme Codes.
        </p>
      </div>
    </div>
  );
}
