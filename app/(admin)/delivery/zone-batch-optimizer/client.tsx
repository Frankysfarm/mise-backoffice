'use client';

// Phase 349: Zone-based Multi-Stop Batch Optimizer V2 — Admin Dashboard

import React, { useCallback, useEffect, useState } from 'react';
import {
  Route,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
  History,
  LayoutList,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface BatchStop {
  orderId: string;
  lat: number;
  lng: number;
  address: string | null;
  gesamtbetrag: number;
  eta_latest: string | null;
}

interface Suggestion {
  id: string;
  stops: BatchStop[];
  totalOrders: number;
  routeKm: number;
  individualKm: number;
  kmSavings: number;
  kmSavingsPct: number;
  score: number;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface Config {
  isEnabled: boolean;
  maxStops: number;
  maxRadiusKm: number;
  autoApplyMinScore: number;
  minKmSavingsPct: number;
}

interface Stats {
  pendingCount: number;
  appliedToday: number;
  autoAppliedToday: number;
  rejectedToday: number;
  expiredToday: number;
  avgKmSavingsPct: number | null;
  avgScore: number | null;
  totalKmSaved: number;
}

interface Dashboard {
  config: Config;
  stats: Stats;
  pendingSuggestions: Suggestion[];
  recentHistory: Suggestion[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-blue-100 text-blue-800',
    applied: 'bg-green-100 text-green-800',
    auto_applied: 'bg-purple-100 text-purple-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<string, string> = {
    pending: 'Ausstehend',
    applied: 'Angewandt',
    auto_applied: 'Auto',
    rejected: 'Abgelehnt',
    expired: 'Abgelaufen',
  };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', map[status] ?? 'bg-gray-100 text-gray-600')}>
      {labels[status] ?? status}
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// ── Suggestion Card ───────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  onApply,
  onReject,
  loading,
}: {
  s: Suggestion;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 border border-matcha-100 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Score Badge */}
          <div
            className={cn(
              'flex-shrink-0 w-12 h-12 rounded-xl border flex flex-col items-center justify-center',
              scoreColor(s.score),
            )}
          >
            <span className="text-lg font-bold leading-none">{s.score}</span>
            <span className="text-[9px] font-medium">Score</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">
                {s.totalOrders} Stops · {s.routeKm.toFixed(1)} km Route
              </span>
              <span className="text-xs text-green-700 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                −{s.kmSavingsPct.toFixed(0)}% km
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Gespart: {s.kmSavings.toFixed(2)} km · Einzeln: {s.individualKm.toFixed(1)} km ·{' '}
              {fmtTime(s.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {s.status === 'pending' && (
            <>
              <Button
                size="sm"
                className="h-8 gap-1 bg-matcha-600 hover:bg-matcha-700 text-white text-xs"
                onClick={() => onApply(s.id)}
                disabled={loading}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Annehmen
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50 text-xs"
                onClick={() => onReject(s.id)}
                disabled={loading}
              >
                <XCircle className="h-3.5 w-3.5" />
                Ablehnen
              </Button>
            </>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {s.stops.map((stop, idx) => (
            <div key={stop.orderId} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center font-bold text-[10px]">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{stop.address ?? stop.orderId.slice(0, 8)}</div>
                <div className="text-gray-400">
                  €{stop.gesamtbetrag.toFixed(2)}
                  {stop.eta_latest ? ` · ETA ${fmtTime(stop.eta_latest)}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function ZoneBatchOptimizerClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<'pending' | 'history' | 'config'>('pending');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cfgDraft, setCfgDraft] = useState<Config | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/zone-batch-optimizer?location_id=${locationId}`,
      );
      if (res.ok) {
        const data = (await res.json()) as Dashboard;
        setDashboard(data);
        setCfgDraft((prev) => prev ?? data.config);
        setLastRefresh(new Date());
      }
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleApply = async (id: string) => {
    setLoading(true);
    try {
      await fetch('/api/delivery/admin/zone-batch-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', suggestion_id: id, location_id: locationId }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    try {
      await fetch('/api/delivery/admin/zone-batch-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', suggestion_id: id, location_id: locationId }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/zone-batch-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_now', location_id: locationId }),
      });
      await load();
    } finally {
      setScanning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!cfgDraft) return;
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/zone-batch-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          location_id: locationId,
          is_enabled: cfgDraft.isEnabled,
          max_stops: cfgDraft.maxStops,
          max_radius_km: cfgDraft.maxRadiusKm,
          auto_apply_min_score: cfgDraft.autoApplyMinScore,
          min_km_savings_pct: cfgDraft.minKmSavingsPct,
        }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const stats = dashboard?.stats;

  const kpis = [
    {
      label: 'Ausstehend',
      value: stats?.pendingCount ?? 0,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      label: 'Heute angewandt',
      value: (stats?.appliedToday ?? 0) + (stats?.autoAppliedToday ?? 0),
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-green-700 bg-green-50 border-green-200',
    },
    {
      label: 'Ø km-Einsparung',
      value:
        stats?.avgKmSavingsPct != null ? `${stats.avgKmSavingsPct.toFixed(1)}%` : '—',
      icon: <Route className="h-4 w-4" />,
      color: 'text-matcha-700 bg-matcha-50 border-matcha-200',
    },
    {
      label: 'km gespart heute',
      value:
        stats?.totalKmSaved != null ? `${stats.totalKmSaved.toFixed(2)} km` : '—',
      icon: <Zap className="h-4 w-4" />,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
    },
  ];

  const tabs = [
    { id: 'pending' as const, label: 'Vorschläge', icon: <LayoutList className="h-4 w-4" /> },
    { id: 'history' as const, label: 'Verlauf', icon: <History className="h-4 w-4" /> },
    { id: 'config' as const, label: 'Konfiguration', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Zone Batch Optimizer"
        description="Erkennt automatisch Bestellungen, die sich für gemeinsame Lieferbatches eignen, und berechnet km-Einsparungen."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={cn('p-4 border flex items-start gap-3', kpi.color)}
          >
            <div className="mt-0.5">{kpi.icon}</div>
            <div>
              <div className="text-2xl font-bold leading-none">{kpi.value}</div>
              <div className="text-xs font-medium mt-1 opacity-75">{kpi.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-matcha-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Aktualisiert {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            onClick={handleScan}
            disabled={scanning}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
            {scanning ? 'Scanne…' : 'Jetzt scannen'}
          </Button>
        </div>
      </div>

      {/* Tab: Vorschläge */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {!dashboard && (
            <p className="text-sm text-gray-500 text-center py-8">Lade…</p>
          )}
          {dashboard && dashboard.pendingSuggestions.length === 0 && (
            <Card className="p-8 text-center border-dashed border-gray-200">
              <Route className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Keine ausstehenden Batch-Vorschläge. Starte einen manuellen Scan.
              </p>
            </Card>
          )}
          {dashboard?.pendingSuggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              onApply={handleApply}
              onReject={handleReject}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Tab: Verlauf */}
      {tab === 'history' && (
        <div className="space-y-3">
          {dashboard && dashboard.recentHistory.length === 0 && (
            <Card className="p-8 text-center border-dashed border-gray-200">
              <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Noch kein Verlauf für heute.</p>
            </Card>
          )}
          {dashboard?.recentHistory.map((s) => (
            <Card key={s.id} className="p-3 border border-gray-100 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg border flex flex-col items-center justify-center flex-shrink-0 text-xs font-bold', scoreColor(s.score))}>
                {s.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {s.totalOrders} Stops · {s.routeKm.toFixed(1)} km · −{s.kmSavingsPct.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-400">
                  {fmtTime(s.createdAt)}
                  {s.resolvedAt ? ` → ${fmtTime(s.resolvedAt)}` : ''}
                </div>
              </div>
              {statusBadge(s.status)}
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Konfiguration */}
      {tab === 'config' && cfgDraft && (
        <Card className="p-5 border border-matcha-100 space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-800">Engine-Einstellungen</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-gray-600">
                {cfgDraft.isEnabled ? 'Aktiviert' : 'Deaktiviert'}
              </span>
              <input
                type="checkbox"
                checked={cfgDraft.isEnabled}
                onChange={(e) => setCfgDraft((d) => d && { ...d, isEnabled: e.target.checked })}
                className="w-4 h-4 accent-matcha-600"
              />
            </label>
          </div>

          <SliderField
            label={`Max. Stops pro Batch: ${cfgDraft.maxStops}`}
            min={2} max={6} step={1}
            value={cfgDraft.maxStops}
            onChange={(v) => setCfgDraft((d) => d && { ...d, maxStops: v })}
          />
          <SliderField
            label={`Max. Radius: ${cfgDraft.maxRadiusKm.toFixed(1)} km`}
            min={0.5} max={5} step={0.5}
            value={cfgDraft.maxRadiusKm}
            onChange={(v) => setCfgDraft((d) => d && { ...d, maxRadiusKm: v })}
          />
          <SliderField
            label={`Min. km-Einsparung für Vorschlag: ${cfgDraft.minKmSavingsPct.toFixed(0)}%`}
            min={0} max={50} step={5}
            value={cfgDraft.minKmSavingsPct}
            onChange={(v) => setCfgDraft((d) => d && { ...d, minKmSavingsPct: v })}
          />
          <SliderField
            label={`Auto-Apply ab Score: ${cfgDraft.autoApplyMinScore}`}
            min={50} max={100} step={5}
            value={cfgDraft.autoApplyMinScore}
            onChange={(v) => setCfgDraft((d) => d && { ...d, autoApplyMinScore: v })}
          />

          <Button
            className="w-full bg-matcha-600 hover:bg-matcha-700 text-white"
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? 'Speichert…' : 'Konfiguration speichern'}
          </Button>
        </Card>
      )}
    </div>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm text-gray-700 font-medium">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-matcha-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
