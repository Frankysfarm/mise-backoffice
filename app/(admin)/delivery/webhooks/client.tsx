'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Plus, CheckCircle2, AlertTriangle, Webhook } from 'lucide-react';

interface WebhookWithStats {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  last_delivered_at: string | null;
  consecutive_failures: number;
  total_delivered: number;
  pending_deliveries: number;
  failed_deliveries: number;
}

const ALL_EVENTS = [
  'order_received', 'order_dispatched', 'order_bundled',
  'batch_created', 'batch_assigned', 'batch_picked_up', 'batch_completed', 'batch_cancelled',
  'stop_delivered', 'driver_online', 'driver_offline',
  'eta_updated', 'kitchen_ready', 'kitchen_cooking',
  'delay_first_notice', 'delay_critical_notice', 'delay_compensation_created',
  'order_scheduled', 'order_released_for_dispatch',
];

const EVENT_GROUP: Record<string, string> = {
  order_received: 'Bestellungen', order_dispatched: 'Bestellungen', order_bundled: 'Bestellungen',
  batch_created: 'Touren', batch_assigned: 'Touren', batch_picked_up: 'Touren', batch_completed: 'Touren', batch_cancelled: 'Touren',
  stop_delivered: 'Stops',
  driver_online: 'Fahrer', driver_offline: 'Fahrer',
  eta_updated: 'ETA',
  kitchen_ready: 'Küche', kitchen_cooking: 'Küche',
  delay_first_notice: 'Verspätungen', delay_critical_notice: 'Verspätungen', delay_compensation_created: 'Verspätungen',
  order_scheduled: 'Geplant', order_released_for_dispatch: 'Geplant',
};

export function WebhooksClient({ locationId }: { locationId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);

  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['order_dispatched', 'stop_delivered', 'batch_completed']);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/webhooks?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.webhooks) setWebhooks(d.webhooks as WebhookWithStats[]);
        if (d?.migration_pending) setMigrationPending(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const toggleEvent = (evt: string) => {
    setNewEvents(prev => prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]);
  };

  const register = async () => {
    if (!newUrl) { setError('URL ist erforderlich'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/delivery/admin/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: locationId,
        url: newUrl,
        secret: newSecret || undefined,
        events: newEvents,
        description: newDesc || undefined,
      }),
    });
    const json = await res.json();
    if (res.ok && json.webhook) {
      setWebhooks(prev => [json.webhook as WebhookWithStats, ...prev]);
      setAdding(false);
      setNewUrl(''); setNewSecret(''); setNewDesc('');
      setNewEvents(['order_dispatched', 'stop_delivered', 'batch_completed']);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } else {
      setError(json.error ?? 'Fehler beim Registrieren');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        {saved && <div className="flex items-center gap-1.5 text-sm text-matcha-700"><CheckCircle2 className="h-4 w-4" /> Registriert</div>}
      </div>

      {migrationPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Webhook-Tabelle noch nicht verfügbar (Migration 025 ausstehend).
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-12 text-muted-foreground">Lade Webhooks…</div>}

      {!loading && webhooks.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Webhook className="h-8 w-8" />
          <div className="text-sm">Noch keine Webhooks konfiguriert.</div>
        </div>
      )}

      {/* Webhook list */}
      {!loading && webhooks.map(wh => (
        <div key={wh.id} className={cn('rounded-xl border bg-card p-5 space-y-3', !wh.is_active && 'opacity-60')}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{wh.url}</div>
              {wh.description && <div className="text-xs text-muted-foreground">{wh.description}</div>}
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border shrink-0',
              wh.consecutive_failures > 0 ? 'bg-red-50 border-red-200 text-red-700' : wh.is_active ? 'bg-matcha-50 border-matcha-200 text-matcha-700' : 'bg-muted border-border text-muted-foreground')}>
              {wh.consecutive_failures > 0 ? `${wh.consecutive_failures}× Fehler` : wh.is_active ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Zugestellt: <strong>{wh.total_delivered}</strong></span>
            {wh.failed_deliveries > 0 && <span className="text-red-600">Fehlgeschl.: <strong>{wh.failed_deliveries}</strong></span>}
            {wh.pending_deliveries > 0 && <span className="text-amber-600">Ausstehend: <strong>{wh.pending_deliveries}</strong></span>}
            {wh.last_delivered_at && <span>Zuletzt: <strong>{new Date(wh.last_delivered_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</strong></span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {wh.events.map(e => (
              <span key={e} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono">{e}</span>
            ))}
          </div>
        </div>
      ))}

      {/* Add webhook form */}
      {adding ? (
        <div className="rounded-xl border border-matcha-200 bg-matcha-50/30 p-5 space-y-4">
          <div className="font-display font-bold text-sm">Neuer Webhook</div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">URL *</label>
              <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Secret (optional)</label>
              <input type="text" value={newSecret} onChange={e => setNewSecret(e.target.value)} placeholder="Signatur-Secret"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Beschreibung (optional)</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="z.B. CRM-Integration"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Ereignisse</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {ALL_EVENTS.map(evt => (
                  <label key={evt} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newEvents.includes(evt)} onChange={() => toggleEvent(evt)}
                      className="h-3.5 w-3.5 rounded border-border accent-matcha-700" />
                    <span className="text-xs font-mono">{evt}</span>
                    <span className="text-[10px] text-muted-foreground">({EVENT_GROUP[evt] ?? ''})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={register} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50">
              {saving ? 'Registriert…' : 'Registrieren'}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm text-muted-foreground hover:text-foreground">Abbrechen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-matcha-500 hover:text-matcha-700 transition w-full">
          <Plus className="h-4 w-4" /> Webhook registrieren
        </button>
      )}
    </div>
  );
}
