'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Thermometer, Zap, BarChart2, CheckCircle2, AlertCircle, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import type { ScoringV2Config, ZoneVehicleStat } from '@/lib/delivery/scoring-v2';

interface Dashboard {
  config: ScoringV2Config;
  zoneVehicleStats: ZoneVehicleStat[];
  weightSum: number;
  lastRebuiltAt: string | null;
  v2ActiveLocations: number;
}

interface Props { locationId: string }

const FACTOR_LABELS: { key: keyof ScoringV2Config; label: string; min: number; max: number }[] = [
  { key: 'wDistance',   label: 'Distanz',           min: 0, max: 25 },
  { key: 'wLoad',       label: 'Fahrerauslastung',  min: 0, max: 20 },
  { key: 'wVehicle',    label: 'Fahrzeugtyp',       min: 0, max: 20 },
  { key: 'wExperience', label: 'Erfahrung',         min: 0, max: 20 },
  { key: 'wZone',       label: 'Zonenpassung',      min: 0, max: 25 },
  { key: 'wPrepTime',   label: 'Küchen-Timing',     min: 0, max: 20 },
  { key: 'wTimeOfDay',  label: 'Tageszeit',         min: 0, max: 15 },
  { key: 'wPriority',   label: 'Priorität',         min: 0, max: 15 },
  { key: 'wBundleFit',  label: 'Bündelbarkeit',     min: 0, max: 20 },
  { key: 'wHistory',    label: 'Fahrer-Historie',   min: 0, max: 20 },
  { key: 'wWeather',    label: '★ Wetter (NEU)',    min: 0, max: 20 },
  { key: 'wVelocity',   label: '★ Geschwindigkeit (NEU)', min: 0, max: 20 },
];

function kpiCard(label: string, value: string | number, sub: string, icon: React.ReactNode, ok = true) {
  return (
    <div className="bg-white rounded-xl border p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${ok ? 'text-gray-900' : 'text-amber-600'}`}>{value}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}

function successRateBadge(rate: number) {
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{pct}%</span>;
}

export function ScoringV2Client({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [tab, setTab] = useState<'config' | 'stats'>('config');
  const [localConfig, setLocalConfig] = useState<ScoringV2Config | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/scoring-v2?location_id=${locationId}`);
      if (r.ok) {
        const d = await r.json() as Dashboard;
        setDashboard(d);
        setLocalConfig(d.config);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  const weightSum = localConfig
    ? (localConfig.wDistance + localConfig.wLoad + localConfig.wVehicle + localConfig.wExperience +
       localConfig.wZone + localConfig.wPrepTime + localConfig.wTimeOfDay + localConfig.wPriority +
       localConfig.wBundleFit + localConfig.wHistory + localConfig.wWeather + localConfig.wVelocity)
    : 0;
  const weightOk = weightSum === 100;

  async function saveConfig() {
    if (!localConfig) return;
    setSaving(true);
    setFeedback(null);
    try {
      const r = await fetch('/api/delivery/admin/scoring-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config: localConfig }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      setFeedback(d.ok ? { ok: true, msg: 'Konfiguration gespeichert ✓' } : { ok: false, msg: d.error ?? 'Fehler' });
      if (d.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    if (!localConfig) return;
    const next = !localConfig.isActive;
    setSaving(true);
    try {
      const r = await fetch('/api/delivery/admin/scoring-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', isActive: next }),
      });
      const d = await r.json() as { ok: boolean };
      if (d.ok) {
        setLocalConfig((c) => c ? { ...c, isActive: next } : c);
        setFeedback({ ok: true, msg: next ? 'V2 aktiviert — Dispatch nutzt ab sofort ML-Scoring' : 'V2 deaktiviert — zurück zu V1' });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function rebuild() {
    setRebuilding(true);
    setFeedback(null);
    try {
      const r = await fetch('/api/delivery/admin/scoring-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild' }),
      });
      const d = await r.json() as { ok: boolean; rows: number };
      setFeedback({ ok: d.ok, msg: d.ok ? `${d.rows} Zone×Fahrzeug-Zeilen neu berechnet` : 'Rebuild fehlgeschlagen' });
      if (d.ok) await load();
    } finally {
      setRebuilding(false);
    }
  }

  function updateWeight(key: keyof ScoringV2Config, val: number) {
    setLocalConfig((c) => c ? { ...c, [key]: val } : c);
  }

  if (loading) {
    return <div className="p-8 text-gray-400 animate-pulse">Lade Scoring V2…</div>;
  }

  if (!dashboard || !localConfig) {
    return <div className="p-8 text-red-500">Fehler beim Laden</div>;
  }

  const { zoneVehicleStats, lastRebuiltAt, v2ActiveLocations } = dashboard;

  return (
    <div className="space-y-6 pb-12">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCard('Engine-Status', localConfig.isActive ? 'V2 aktiv' : 'V1 aktiv', 'Scoring-Version im Dispatch', <Brain className="w-4 h-4" />, localConfig.isActive)}
        {kpiCard('Gewicht-Summe', weightSum, weightOk ? 'Korrekt (= 100)' : 'Muss 100 ergeben!', <BarChart2 className="w-4 h-4" />, weightOk)}
        {kpiCard('Wetter-Factor', localConfig.useWeather ? 'Aktiv' : 'Aus', 'Faktor 11', <Thermometer className="w-4 h-4" />)}
        {kpiCard('Zone×Kfz-Daten', zoneVehicleStats.length, lastRebuiltAt ? new Date(lastRebuiltAt).toLocaleDateString('de') : 'Noch nie', <Zap className="w-4 h-4" />)}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${feedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.msg}
        </div>
      )}

      {/* V2 Toggle */}
      <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">ML-Scoring V2 für diesen Standort</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {localConfig.isActive
              ? 'Dispatch nutzt jetzt 12-Faktoren V2-Scoring mit Wetter + Geschwindigkeit'
              : 'Dispatch nutzt Standard V1-Scoring (10 Faktoren, gleiche Gewichtung)'}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors hover:bg-gray-50"
        >
          {localConfig.isActive
            ? <><ToggleRight className="w-5 h-5 text-green-600" /> Deaktivieren</>
            : <><ToggleLeft className="w-5 h-5 text-gray-400" /> Aktivieren</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['config', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'config' ? 'Gewichtung (12 Faktoren)' : 'Zone × Fahrzeug Statistik'}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="bg-white rounded-xl border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Faktor-Gewichtung</div>
              <div className={`text-xs mt-0.5 ${weightOk ? 'text-green-600' : 'text-amber-600 font-semibold'}`}>
                Summe: {weightSum}/100 {!weightOk && '— bitte anpassen!'}
              </div>
            </div>
            <button
              onClick={saveConfig}
              disabled={saving || !weightOk}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Speichere…' : 'Speichern'}
            </button>
          </div>

          <div className="space-y-3">
            {FACTOR_LABELS.map(({ key, label, min, max }) => {
              const val = (localConfig[key] as number) ?? 0;
              const isNew = label.startsWith('★');
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-44 text-sm shrink-0 ${isNew ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                    {label}
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={val}
                    onChange={(e) => updateWeight(key, parseInt(e.target.value, 10))}
                    className="flex-1"
                  />
                  <div className="w-8 text-right text-sm font-mono text-gray-800">{val}</div>
                </div>
              );
            })}
          </div>

          {/* Feature flags */}
          <div className="border-t pt-4">
            <div className="font-medium text-gray-700 mb-3">Feature-Flags</div>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  { key: 'useWeather' as const,          label: 'Wetter-Faktor' },
                  { key: 'useVelocity' as const,         label: 'Geschwindigkeits-Faktor' },
                  { key: 'useZoneVehicleStats' as const, label: 'Zone×Kfz-Statistik' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={localConfig[key] as boolean}
                    onChange={(e) => setLocalConfig((c) => c ? { ...c, [key]: e.target.checked } : c)}
                    className="w-4 h-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b">
            <div>
              <div className="font-semibold text-gray-900">Historische Zone×Fahrzeug-Erfolgsraten</div>
              <div className="text-xs text-gray-400 mt-0.5">Letzte 30 Tage · Min. 20 Lieferungen für Einfluss auf Scoring</div>
            </div>
            <button
              onClick={rebuild}
              disabled={rebuilding}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} />
              {rebuilding ? 'Berechne…' : 'Neu berechnen'}
            </button>
          </div>
          {zoneVehicleStats.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Keine Daten. Klicke &quot;Neu berechnen&quot; um die Statistik aufzubauen.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2">Zone</th>
                  <th className="text-left px-4 py-2">Fahrzeug</th>
                  <th className="text-right px-4 py-2">Lieferungen</th>
                  <th className="text-right px-4 py-2">Pünktlich</th>
                  <th className="text-right px-4 py-2">Erfolgsrate</th>
                  <th className="text-right px-4 py-2">Ø Lieferzeit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {zoneVehicleStats.map((s) => (
                  <tr key={`${s.zone}_${s.vehicle}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-blue-700">Zone {s.zone}</td>
                    <td className="px-4 py-2 capitalize text-gray-700">{s.vehicle === 'bike' ? 'Fahrrad' : 'Auto'}</td>
                    <td className="px-4 py-2 text-right text-gray-800">{s.totalDeliveries}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{s.onTimeCount}</td>
                    <td className="px-4 py-2 text-right">{successRateBadge(s.successRate)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{Math.round(s.avgDeliveryMin)} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Wie V2 aktivieren:</strong> Stelle die Gewichte ein (Summe = 100) → Speichern → &quot;Aktivieren&quot;.
        V2 gilt nur für diesen Standort. Andere Standorte laufen weiter mit V1.
        Zone×Fahrzeug-Statistik wird täglich um 04:30 UTC automatisch neu berechnet.
      </div>
    </div>
  );
}
