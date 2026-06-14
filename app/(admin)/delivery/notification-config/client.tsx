'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Save, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface NotificationConfig {
  locationId: string;
  isEnabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  enabledEvents: string[];
  messagePrefix: string | null;
  maxPerOrder: number;
  timeoutMs: number;
}

interface NotificationStats {
  sent24h: number;
  failed24h: number;
  successRate: number | null;
}

const EVENT_LABELS: Record<string, string> = {
  driver_assigned:      'Fahrer zugewiesen',
  driver_at_restaurant: 'Fahrer im Restaurant',
  driver_departing:     'Fahrer unterwegs',
  driver_nearby:        'Fahrer in der Nähe',
  delivered:            'Zugestellt',
  cancelled:            'Storniert',
  delayed:              'Verspätet',
};

export function NotificationConfigClient({ locationId }: { locationId: string }) {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/notification-config?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.config) setConfig(d.config as NotificationConfig);
        if (d?.stats) setStats(d.stats as NotificationStats);
        if (d?.availableEvents) setAvailableEvents(d.availableEvents as string[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const toggleEvent = (event: string) => {
    if (!config) return;
    const enabled = config.enabledEvents.includes(event)
      ? config.enabledEvents.filter(e => e !== event)
      : [...config.enabledEvents, event];
    setConfig({ ...config, enabledEvents: enabled });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/delivery/admin/notification-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, ...config }),
    });
    const json = await res.json();
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setError(json.error ?? 'Fehler beim Speichern');
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Konfiguration…</div>;
  if (!config) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Keine Konfiguration gefunden.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesendet 24h</div>
            <div className="font-display text-2xl font-black">{stats.sent24h}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.failed24h > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fehlgeschlagen 24h</div>
            <div className={cn('font-display text-2xl font-black', stats.failed24h > 0 ? 'text-red-700' : '')}>{stats.failed24h}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Erfolgsrate</div>
            <div className="font-display text-2xl font-black text-matcha-700">
              {stats.successRate !== null ? `${stats.successRate.toFixed(0)} %` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Enable toggle */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold">Benachrichtigungen aktiv</div>
            <div className="text-sm text-muted-foreground">Push/SMS an Kunden bei Statusänderungen senden</div>
          </div>
          <button
            onClick={() => setConfig({ ...config, isEnabled: !config.isEnabled })}
            className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition',
              config.isEnabled ? 'bg-matcha-700' : 'bg-muted')}
          >
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition',
              config.isEnabled ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
      </div>

      {/* Webhook config */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold text-sm">Webhook-Einstellungen</h3>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Webhook-URL</label>
          <input
            type="url"
            value={config.webhookUrl ?? ''}
            placeholder="https://..."
            onChange={e => setConfig({ ...config, webhookUrl: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Webhook-Secret</label>
          <input
            type="password"
            value={config.webhookSecret ?? ''}
            placeholder="Geheimschlüssel (optional)"
            onChange={e => setConfig({ ...config, webhookSecret: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Nachrichtenprefix (optional)</label>
          <input
            type="text"
            value={config.messagePrefix ?? ''}
            placeholder="z.B. 'Ihre Bestellung:'"
            onChange={e => setConfig({ ...config, messagePrefix: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Max. pro Bestellung</label>
            <input
              type="number" min={1} max={20}
              value={config.maxPerOrder}
              onChange={e => setConfig({ ...config, maxPerOrder: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Timeout (ms)</label>
            <input
              type="number" min={1000} step={500}
              value={config.timeoutMs}
              onChange={e => setConfig({ ...config, timeoutMs: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
            />
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-display font-bold text-sm">Aktivierte Ereignisse</h3>
        <div className="space-y-2">
          {(availableEvents.length > 0 ? availableEvents : Object.keys(EVENT_LABELS)).map(evt => {
            const enabled = config.enabledEvents.includes(evt);
            return (
              <label key={evt} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={() => toggleEvent(evt)}
                  className="h-4 w-4 rounded border-border accent-matcha-700" />
                <span className="text-sm">{EVENT_LABELS[evt] ?? evt}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-4 py-2 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-matcha-700">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
