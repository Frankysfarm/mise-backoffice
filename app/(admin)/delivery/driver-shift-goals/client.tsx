'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Target, TrendingUp, Euro, Star, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import type { DriverShiftGoalDashboard, DriverShiftProgress, DriverShiftGoalConfig, PaceLabel } from '@/lib/delivery/driver-shift-goals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paceColor(p: PaceLabel): string {
  if (p === 'ahead')     return 'text-emerald-600';
  if (p === 'on_track')  return 'text-blue-600';
  if (p === 'behind')    return 'text-amber-600';
  return 'text-slate-400';
}

function paceBg(p: PaceLabel): string {
  if (p === 'ahead')    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (p === 'on_track') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (p === 'behind')   return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function paceLabel(p: PaceLabel): string {
  if (p === 'ahead')       return 'Über Plan';
  if (p === 'on_track')    return 'Im Plan';
  if (p === 'behind')      return 'Unter Plan';
  return 'Noch nicht gestartet';
}

function barColor(p: PaceLabel): string {
  if (p === 'ahead')    return 'bg-emerald-500';
  if (p === 'on_track') return 'bg-blue-500';
  if (p === 'behind')   return 'bg-amber-400';
  return 'bg-slate-300';
}

function ProgressBar({ pct, pace }: { pct: number; pace: PaceLabel }) {
  const w = Math.min(100, Math.round(pct * 100));
  return (
    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor(pace)}`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function PaceBadge({ pace }: { pace: PaceLabel }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${paceBg(pace)}`}>
      {pace === 'ahead' && <ChevronUp className="h-3 w-3" />}
      {pace === 'behind' && <ChevronDown className="h-3 w-3" />}
      {pace === 'on_track' && <Minus className="h-3 w-3" />}
      {paceLabel(pace)}
    </span>
  );
}

// ─── Config-Formular ──────────────────────────────────────────────────────────

function ConfigPanel({
  initialConfig,
  onSaved,
}: {
  initialConfig: DriverShiftGoalConfig | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<DriverShiftGoalConfig>(
    initialConfig ?? {
      targetStops:       12,
      targetEarningsEur: 80,
      targetScore:       75,
      shiftStartHour:    10,
      shiftHoursTotal:   8,
    },
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    await fetch('/api/delivery/admin/driver-shift-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_config', ...form }),
    });
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('de-DE'));
    onSaved();
  };

  const field = (
    label: string,
    key: keyof DriverShiftGoalConfig,
    unit: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        <span className="ml-1 text-slate-400">({unit})</span>
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={form[key] as number}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
        className="border rounded px-3 py-1.5 text-sm w-full"
      />
    </div>
  );

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-slate-800">Ziel-Konfiguration</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
        {field('Ziel-Stops', 'targetStops', 'Stops/Schicht', 1, 50)}
        {field('Ziel-Verdienst', 'targetEarningsEur', '€/Schicht', 10, 500, 5)}
        {field('Ziel-Score', 'targetScore', 'Punkte', 30, 100)}
        {field('Schichtstart (UTC)', 'shiftStartHour', 'Uhr', 0, 23)}
        {field('Schichtdauer', 'shiftHoursTotal', 'Stunden', 1, 24)}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? 'Speichern…' : 'Ziele speichern'}
        </Button>
        {savedAt && (
          <span className="text-xs text-slate-400">Gespeichert um {savedAt}</span>
        )}
      </div>
    </Card>
  );
}

// ─── Fahrer-Zeile ─────────────────────────────────────────────────────────────

function DriverRow({ d }: { d: DriverShiftProgress }) {
  const name = d.driverName ?? `Fahrer ${d.driverId.slice(0, 6)}`;
  return (
    <div className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-800 truncate max-w-[140px]">{name}</span>
          {d.vehicle && (
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {d.vehicle}
            </span>
          )}
          {d.currentState && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              d.currentState === 'unterwegs' ? 'bg-blue-100 text-blue-700' :
              d.currentState === 'online'    ? 'bg-emerald-100 text-emerald-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {d.currentState}
            </span>
          )}
        </div>
        <PaceBadge pace={d.overallPace} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Stops */}
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className={`font-medium ${paceColor(d.stopsPace)}`}>
              {d.stopsCompleted} / {d.targetStops} Stops
            </span>
            <span className="text-slate-400">{Math.round(d.stopsPct * 100)}%</span>
          </div>
          <ProgressBar pct={d.stopsPct} pace={d.stopsPace} />
        </div>

        {/* Verdienst */}
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className={`font-medium ${paceColor(d.earningsPace)}`}>
              {d.earningsEur.toFixed(2)} / {d.targetEarningsEur.toFixed(0)} €
            </span>
            <span className="text-slate-400">{Math.round(d.earningsPct * 100)}%</span>
          </div>
          <ProgressBar pct={d.earningsPct} pace={d.earningsPace} />
        </div>

        {/* Score */}
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className={`font-medium ${paceColor(d.scorePace)}`}>
              {d.liveScore} / {d.targetScore} Pkt.
            </span>
            <span className="text-slate-400">{Math.round(d.scorePct * 100)}%</span>
          </div>
          <ProgressBar pct={d.scorePct} pace={d.scorePace} />
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function DriverShiftGoalsClient({
  initialConfig,
}: {
  initialConfig: DriverShiftGoalConfig | null;
}) {
  const [data, setData] = useState<DriverShiftGoalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'config'>('live');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/delivery/admin/driver-shift-goals');
    if (res.ok) {
      const json = await res.json() as DriverShiftGoalDashboard;
      setData(json);
      setLastUpdate(new Date().toLocaleTimeString('de-DE'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const d = data;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Fahrer-Schichtziele"
        description="Schicht-Ziele konfigurieren und Fahrer-Fortschritt in Echtzeit verfolgen."
      />

      {/* KPI-Band */}
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Target className="h-4 w-4 text-blue-500" />}
            label="Aktive Fahrer"
            value={d.summary.activeDrivers}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Über Plan"
            value={d.summary.aheadCount}
            sub={`${d.summary.onTrackCount} im Plan`}
          />
          <KpiCard
            icon={<Euro className="h-4 w-4 text-amber-500" />}
            label="Ø Verdienst-Fortschritt"
            value={`${Math.round(d.summary.avgEarningsPct * 100)} %`}
          />
          <KpiCard
            icon={<Star className="h-4 w-4 text-violet-500" />}
            label="Ø Score-Fortschritt"
            value={`${Math.round(d.summary.avgScorePct * 100)} %`}
          />
        </div>
      )}

      {/* Schicht-Fortschrittsbalken */}
      {d && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-slate-700">Schichtfortschritt</span>
            <span className="text-slate-500 text-xs">
              {new Date(d.shiftStart).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} –{' '}
              {new Date(d.shiftEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} UTC
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-500 rounded-full"
              style={{ width: `${Math.round(d.shiftPctElapsed * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {Math.round(d.shiftPctElapsed * 100)} % der Schicht abgelaufen
          </p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {(['live', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'live' ? 'Fahrer-Fortschritt' : 'Ziele konfigurieren'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          {lastUpdate && <span className="text-xs text-slate-400">Aktualisiert {lastUpdate}</span>}
          <Button onClick={load} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {tab === 'live' && (
        <div>
          {loading && !d && (
            <p className="text-slate-400 text-sm text-center py-8">Lade Fahrer-Daten…</p>
          )}
          {d && d.drivers.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">
              Keine aktiven Fahrer in dieser Schicht.
            </p>
          )}
          {d && d.drivers.length > 0 && (
            <div className="space-y-3">
              {/* Zusammenfassung */}
              {(d.summary.aheadCount > 0 || d.summary.behindCount > 0) && (
                <div className="flex gap-3 text-xs">
                  {d.summary.aheadCount > 0 && (
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full">
                      {d.summary.aheadCount} × Über Plan
                    </span>
                  )}
                  {d.summary.onTrackCount > 0 && (
                    <span className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full">
                      {d.summary.onTrackCount} × Im Plan
                    </span>
                  )}
                  {d.summary.behindCount > 0 && (
                    <span className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full">
                      {d.summary.behindCount} × Unter Plan
                    </span>
                  )}
                </div>
              )}

              {d.drivers.map((driver) => (
                <DriverRow key={driver.driverId} d={driver} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <ConfigPanel initialConfig={initialConfig} onSaved={load} />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </Card>
  );
}
