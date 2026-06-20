'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin, Users, RefreshCw, Settings, Activity,
  CheckCircle, XCircle, Clock, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutoHoursDashboard, AutoHoursConfig } from '@/lib/delivery/geofence-auto-hours';

interface Props {
  locationId: string;
  initial: AutoHoursDashboard;
}

type Tab = 'overview' | 'log' | 'config';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return String(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function ActionBadge({ action }: { action: 'opened' | 'closed' | 'no_change' }) {
  if (action === 'opened')
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Geöffnet</span>;
  if (action === 'closed')
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Geschlossen</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Keine Änderung</span>;
}

export function GeofenceAutoHoursClient({ locationId, initial }: Props) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [config, setConfig] = useState<AutoHoursConfig>(initial.config);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/geofence-auto-hours?location_id=${locationId}`);
      const json = await res.json();
      if (json.ok) {
        setData(json as AutoHoursDashboard);
        setConfig(json.config);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/geofence-auto-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          location_id: locationId,
          is_enabled: config.isEnabled,
          min_drivers_to_open: config.minDriversToOpen,
          auto_open_enabled: config.autoOpenEnabled,
          auto_close_enabled: config.autoCloseEnabled,
          grace_period_min: config.gracePeriodMin,
          open_message_de: config.openMessageDe,
          close_message_de: config.closeMessageDe,
        }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }, [config, locationId, reload]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      await fetch('/api/delivery/admin/geofence-auto-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_now', location_id: locationId }),
      });
      await reload();
    } finally {
      setChecking(false);
    }
  }, [locationId, reload]);

  const signalColor = data.currentSignal === 'normal'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : data.currentSignal === 'paused'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-amber-700 bg-amber-50 border-amber-200';

  const kpis = [
    {
      icon: <Users size={16} />,
      label: 'Fahrer online',
      value: fmt(data.driversOnline),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      icon: <CheckCircle size={16} />,
      label: 'Öffnungen (7T)',
      value: fmt(data.stats.openEvents7d),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      icon: <XCircle size={16} />,
      label: 'Schließungen (7T)',
      value: fmt(data.stats.closeEvents7d),
      color: 'text-red-700',
      bg: 'bg-red-50',
    },
    {
      icon: <Activity size={16} />,
      label: 'Ereignisse (7T)',
      value: fmt(data.stats.totalEvents7d),
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
  ];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Übersicht', icon: <Activity size={14} /> },
    { id: 'log', label: 'Ereignis-Log', icon: <Clock size={14} /> },
    { id: 'config', label: 'Konfiguration', icon: <Settings size={14} /> },
  ];

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest', k.color)}>
              <span className={cn('p-1 rounded', k.bg)}>{k.icon}</span>
              {k.label}
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id
                ? 'border-matcha-600 text-matcha-800'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          <Button size="sm" variant="outline" onClick={checkNow} disabled={checking}>
            <Zap size={14} className={cn(checking && 'animate-pulse')} />
            Jetzt prüfen
          </Button>
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Übersicht */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4">
            <div className="font-display font-bold text-base flex items-center gap-2">
              <MapPin size={16} className="text-matcha-600" /> Aktueller Status
            </div>
            <div className={cn('border rounded-xl p-4 text-center', signalColor)}>
              <div className="font-display text-2xl font-bold capitalize">
                {data.currentSignal === 'normal' ? '✓ Lieferung aktiv' :
                 data.currentSignal === 'paused' ? '⏸ Lieferung pausiert' :
                 '⚡ Erhöhte Wartezeit'}
              </div>
              <div className="text-sm mt-1 opacity-70">
                {data.driversOnline} Fahrer online · Min. {data.config.minDriversToOpen} erforderlich
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-display font-bold text-base flex items-center gap-2">
              <Settings size={16} className="text-slate-500" /> Engine-Status
            </div>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Öffnung</span>
                <span className={cn('font-bold text-xs', data.config.isEnabled && data.config.autoOpenEnabled ? 'text-emerald-700' : 'text-muted-foreground')}>
                  {data.config.isEnabled && data.config.autoOpenEnabled ? '✓ Aktiv' : '✗ Inaktiv'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Schließung</span>
                <span className={cn('font-bold text-xs', data.config.isEnabled && data.config.autoCloseEnabled ? 'text-emerald-700' : 'text-muted-foreground')}>
                  {data.config.isEnabled && data.config.autoCloseEnabled ? '✓ Aktiv' : '✗ Inaktiv'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min. Fahrer</span>
                <span className="font-bold">{data.config.minDriversToOpen}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Karenzzeit</span>
                <span className="font-bold">{data.config.gracePeriodMin} Min</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Ereignis-Log */}
      {tab === 'log' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Zeit', 'Aktion', 'Fahrer online', 'Auslöser', 'Grund'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Noch keine Ereignisse
                    </td>
                  </tr>
                )}
                {data.recentEvents.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-2.5"><ActionBadge action={row.action} /></td>
                    <td className="px-4 py-2.5 font-mono">{row.driversOnline}</td>
                    <td className="px-4 py-2.5 text-xs capitalize">{row.triggeredBy}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{row.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Konfiguration */}
      {tab === 'config' && (
        <Card className="p-6 space-y-5 max-w-xl">
          <div className="font-display font-bold text-base">Konfiguration</div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Auto-Hours Engine aktiv</label>
            <button
              onClick={() => setConfig((c) => ({ ...c, isEnabled: !c.isEnabled }))}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.isEnabled ? 'bg-matcha-600' : 'bg-muted',
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                config.isEnabled ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <label className="font-medium">Mindestanzahl Fahrer zum Öffnen</label>
              <span className="font-mono font-bold text-matcha-800">{config.minDriversToOpen}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={config.minDriversToOpen}
              onChange={(e) => setConfig((c) => ({ ...c, minDriversToOpen: parseInt(e.target.value) }))}
              className="w-full accent-matcha-600"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <label className="font-medium">Karenzzeit bis Auto-Schließung (Min)</label>
              <span className="font-mono font-bold text-matcha-800">{config.gracePeriodMin}</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={config.gracePeriodMin}
              onChange={(e) => setConfig((c) => ({ ...c, gracePeriodMin: parseInt(e.target.value) }))}
              className="w-full accent-matcha-600"
            />
          </div>

          {([
            { key: 'autoOpenEnabled' as const, label: 'Automatisches Öffnen' },
            { key: 'autoCloseEnabled' as const, label: 'Automatisches Schließen' },
          ]).map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm font-medium">{label}</label>
              <button
                onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config[key] ? 'bg-matcha-600' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  config[key] ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-sm font-medium">Öffnungs-Nachricht</label>
            <input
              type="text"
              value={config.openMessageDe}
              onChange={(e) => setConfig((c) => ({ ...c, openMessageDe: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Schließungs-Nachricht</label>
            <input
              type="text"
              value={config.closeMessageDe}
              onChange={(e) => setConfig((c) => ({ ...c, closeMessageDe: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <Button onClick={saveConfig} disabled={saving} className="w-full">
            {saving ? 'Speichert…' : 'Konfiguration speichern'}
          </Button>
        </Card>
      )}
    </div>
  );
}
