'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  RefreshCw, Plus, CheckCircle2, AlertTriangle, Webhook,
  Trash2, FlaskConical, ToggleLeft, ToggleRight, ChevronRight,
  Clock, CheckCircle, XCircle, Loader2, Activity, BarChart3,
  Eye, EyeOff, Copy,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookWithStats {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  secret: string;
  created_at: string;
  last_delivered_at: string | null;
  consecutive_failures: number;
  total_delivered: number;
  pending_deliveries: number;
  failed_deliveries: number;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  delivered_at: string | null;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_EVENTS = [
  'order_received', 'order_dispatched', 'order_bundled',
  'batch_created', 'batch_assigned', 'batch_picked_up', 'batch_completed', 'batch_cancelled',
  'stop_delivered',
  'driver_online', 'driver_offline',
  'eta_updated',
  'kitchen_ready', 'kitchen_cooking',
  'delay_first_notice', 'delay_critical_notice', 'delay_compensation_created',
  'order_scheduled', 'order_released_for_dispatch',
];

const EVENT_GROUP: Record<string, string> = {
  order_received: 'Bestellungen', order_dispatched: 'Bestellungen', order_bundled: 'Bestellungen',
  batch_created: 'Touren', batch_assigned: 'Touren', batch_picked_up: 'Touren',
  batch_completed: 'Touren', batch_cancelled: 'Touren',
  stop_delivered: 'Stops',
  driver_online: 'Fahrer', driver_offline: 'Fahrer',
  eta_updated: 'ETA',
  kitchen_ready: 'Küche', kitchen_cooking: 'Küche',
  delay_first_notice: 'Verspätungen', delay_critical_notice: 'Verspätungen',
  delay_compensation_created: 'Verspätungen',
  order_scheduled: 'Geplant', order_released_for_dispatch: 'Geplant',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function statusColor(status: number | null) {
  if (status === null) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-emerald-600';
  if (status === 0 || status === -1) return 'text-red-600';
  return 'text-amber-600';
}

type Tab = 'webhooks' | 'log' | 'stats';

// ─── Main Component ───────────────────────────────────────────────────────────

export function WebhooksClient({ locationId }: { locationId: string }) {
  const [tab, setTab] = useState<Tab>('webhooks');
  const [webhooks, setWebhooks] = useState<WebhookWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadWebhooks = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/webhooks?location_id=${locationId}`)
      .then(r => r.json() as Promise<{ webhooks?: WebhookWithStats[]; migration_pending?: boolean }>)
      .then(d => {
        setWebhooks(d.webhooks ?? []);
        if (d.migration_pending) setMigrationPending(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="h-3.5 w-3.5" /> },
    { id: 'log', label: 'Delivery-Log', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'stats', label: 'Statistiken', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
              tab === t.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={loadWebhooks}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>

      {migrationPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          Webhook-Tabellen noch nicht verfügbar (Migration 025 ausstehend).
        </div>
      )}

      {globalError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {globalError}
          <button onClick={() => setGlobalError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade…
        </div>
      )}

      {!loading && tab === 'webhooks' && (
        <WebhooksTab
          locationId={locationId}
          webhooks={webhooks}
          onUpdate={loadWebhooks}
          onError={setGlobalError}
        />
      )}

      {!loading && tab === 'log' && (
        <LogTab locationId={locationId} webhooks={webhooks} />
      )}

      {!loading && tab === 'stats' && (
        <StatsTab webhooks={webhooks} />
      )}
    </div>
  );
}

// ─── Tab: Webhooks ────────────────────────────────────────────────────────────

function WebhooksTab({
  locationId,
  webhooks,
  onUpdate,
  onError,
}: {
  locationId: string;
  webhooks: WebhookWithStats[];
  onUpdate: () => void;
  onError: (msg: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; status: number; body: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState<Record<string, boolean>>({});

  const toggle = async (wh: WebhookWithStats) => {
    setTogglingId(wh.id);
    try {
      const res = await fetch(`/api/delivery/admin/webhooks/${wh.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, is_active: !wh.is_active }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        onError(j.error ?? 'Fehler beim Umschalten');
      } else {
        onUpdate();
      }
    } catch { onError('Netzwerkfehler'); }
    setTogglingId(null);
  };

  const del = async (wh: WebhookWithStats) => {
    if (!confirm(`Webhook "${truncate(wh.url, 50)}" wirklich löschen?`)) return;
    setDeletingId(wh.id);
    try {
      await fetch(`/api/delivery/admin/webhooks/${wh.id}?location_id=${locationId}`, { method: 'DELETE' });
      onUpdate();
    } catch { onError('Fehler beim Löschen'); }
    setDeletingId(null);
  };

  const test = async (wh: WebhookWithStats) => {
    setTestingId(wh.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/delivery/admin/webhooks/${wh.id}?action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const j = await res.json() as { ok?: boolean; status?: number; body?: string };
      setTestResult({ id: wh.id, ok: j.ok ?? false, status: j.status ?? -1, body: j.body ?? '' });
    } catch { onError('Test fehlgeschlagen'); }
    setTestingId(null);
  };

  return (
    <div className="space-y-4">
      {webhooks.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Webhook className="h-10 w-10 opacity-40" />
          <div className="text-sm">Noch keine Webhooks konfiguriert.</div>
        </div>
      )}

      {webhooks.map(wh => (
        <div
          key={wh.id}
          className={cn(
            'rounded-xl border bg-card p-5 space-y-4 transition',
            !wh.is_active && 'opacity-60',
          )}
        >
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', wh.is_active ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                <span className="text-sm font-medium font-mono truncate">{wh.url}</span>
              </div>
              {wh.description && (
                <div className="text-xs text-muted-foreground mt-0.5 pl-4">{wh.description}</div>
              )}
            </div>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold border shrink-0',
              wh.consecutive_failures >= 5
                ? 'bg-red-50 border-red-200 text-red-700'
                : wh.consecutive_failures > 0
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : wh.is_active
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-muted border-border text-muted-foreground',
            )}>
              {wh.consecutive_failures > 0 ? `${wh.consecutive_failures}× Fehler` : wh.is_active ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pl-4">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <strong className="text-foreground">{wh.total_delivered}</strong> zugestellt
            </span>
            {wh.failed_deliveries > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                <strong>{wh.failed_deliveries}</strong> fehlgeschl.
              </span>
            )}
            {wh.pending_deliveries > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3.5 w-3.5" />
                <strong>{wh.pending_deliveries}</strong> ausstehend
              </span>
            )}
            {wh.last_delivered_at && (
              <span>Zuletzt: <strong className="text-foreground">{fmtTime(wh.last_delivered_at)}</strong></span>
            )}
          </div>

          {/* Secret row */}
          <div className="pl-4 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Secret</span>
            <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">
              {secretVisible[wh.id] ? wh.secret : '••••••••••••••••'}
            </code>
            <button
              onClick={() => setSecretVisible(p => ({ ...p, [wh.id]: !p[wh.id] }))}
              className="text-muted-foreground hover:text-foreground transition"
            >
              {secretVisible[wh.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => { void navigator.clipboard.writeText(wh.secret); }}
              className="text-muted-foreground hover:text-foreground transition"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Events */}
          <div className="pl-4 flex flex-wrap gap-1">
            {wh.events.map(e => (
              <span key={e} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {e}
              </span>
            ))}
          </div>

          {/* Test result */}
          {testResult?.id === wh.id && (
            <div className={cn(
              'ml-4 rounded-lg border px-3 py-2 text-xs font-mono',
              testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800',
            )}>
              <span className="font-bold">{testResult.ok ? '✓ Test OK' : '✗ Test Fehler'}</span>
              {' '}HTTP {testResult.status}
              {testResult.body && <div className="mt-1 opacity-80 break-all">{truncate(testResult.body, 200)}</div>}
            </div>
          )}

          {/* Action buttons */}
          <div className="pl-4 flex items-center gap-2 pt-1 border-t border-border/50">
            <button
              onClick={() => { void test(wh); }}
              disabled={testingId === wh.id}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
            >
              {testingId === wh.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <FlaskConical className="h-3 w-3" />}
              Test
            </button>
            <button
              onClick={() => { void toggle(wh); }}
              disabled={togglingId === wh.id}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
            >
              {togglingId === wh.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : wh.is_active
                ? <ToggleLeft className="h-3.5 w-3.5 text-amber-500" />
                : <ToggleRight className="h-3.5 w-3.5 text-emerald-500" />}
              {wh.is_active ? 'Deaktivieren' : 'Aktivieren'}
            </button>
            <button
              onClick={() => { void del(wh); }}
              disabled={deletingId === wh.id}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50 ml-auto"
            >
              {deletingId === wh.id
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Trash2 className="h-3 w-3" />}
              Löschen
            </button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {adding ? (
        <AddWebhookForm
          locationId={locationId}
          onSuccess={() => { setAdding(false); onUpdate(); }}
          onCancel={() => setAdding(false)}
          onError={onError}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-matcha-500 hover:text-matcha-700 transition w-full"
        >
          <Plus className="h-4 w-4" /> Webhook registrieren
        </button>
      )}
    </div>
  );
}

// ─── Add Webhook Form ─────────────────────────────────────────────────────────

function AddWebhookForm({
  locationId,
  onSuccess,
  onCancel,
  onError,
}: {
  locationId: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [desc, setDesc] = useState('');
  const [events, setEvents] = useState<string[]>(['order_dispatched', 'stop_delivered', 'batch_completed']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (e: string) => {
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  const grouped = ALL_EVENTS.reduce<Record<string, string[]>>((acc, e) => {
    const g = EVENT_GROUP[e] ?? 'Sonstige';
    (acc[g] = acc[g] ?? []).push(e);
    return acc;
  }, {});

  const submit = async () => {
    if (!url) { setError('URL ist erforderlich'); return; }
    if (events.length === 0) { setError('Mindestens ein Event muss ausgewählt werden'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/delivery/admin/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id: locationId,
        url,
        secret: secret || undefined,
        events,
        description: desc || undefined,
      }),
    });
    const j = await res.json() as { webhook?: unknown; error?: string };
    if (res.ok && j.webhook) {
      onSuccess();
    } else {
      const msg = j.error ?? 'Fehler beim Registrieren';
      setError(msg);
      onError(msg);
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/30 p-5 space-y-4">
      <div className="font-display font-bold text-sm flex items-center gap-2">
        <Plus className="h-4 w-4" /> Neuer Webhook
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-3">
        <Field label="Endpoint-URL *">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://api.example.com/mise-events"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </Field>
        <Field label="HMAC-Secret (mind. 16 Zeichen)">
          <input
            type="text"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Zufälliges Secret für Signatur-Verifikation"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </Field>
        <Field label="Beschreibung (optional)">
          <input
            type="text"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="z.B. CRM-Integration, Analytics-Export"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
          />
        </Field>

        <Field label={`Events (${events.length} ausgewählt)`}>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {Object.entries(grouped).map(([group, evts]) => (
              <div key={group}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{group}</div>
                <div className="space-y-1">
                  {evts.map(evt => (
                    <label key={evt} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={events.includes(evt)}
                        onChange={() => toggleEvent(evt)}
                        className="h-3.5 w-3.5 rounded border-border accent-matcha-700"
                      />
                      <span className="text-xs font-mono group-hover:text-foreground transition">{evt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => { void submit(); }}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-4 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {saving ? 'Registriert…' : 'Registrieren'}
        </button>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Tab: Delivery-Log ────────────────────────────────────────────────────────

function LogTab({ locationId, webhooks }: { locationId: string; webhooks: WebhookWithStats[] }) {
  const [selectedId, setSelectedId] = useState<string>(webhooks[0]?.id ?? '');
  const [log, setLog] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLog = useCallback((id: string) => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/delivery/admin/webhooks/${id}?location_id=${locationId}&log=true&limit=100`)
      .then(r => r.json() as Promise<{ log?: WebhookDelivery[] }>)
      .then(d => setLog(d.log ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (selectedId) loadLog(selectedId);
  }, [selectedId, loadLog]);

  useEffect(() => {
    if (!selectedId && webhooks[0]?.id) setSelectedId(webhooks[0].id);
  }, [webhooks, selectedId]);

  if (webhooks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Activity className="h-8 w-8 opacity-40" />
        <div className="text-sm">Keine Webhooks vorhanden.</div>
      </div>
    );
  }

  const selected = webhooks.find(w => w.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Webhook selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500"
        >
          {webhooks.map(w => (
            <option key={w.id} value={w.id}>
              {truncate(w.url, 50)} {w.description ? `— ${w.description}` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => loadLog(selectedId)}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {selected && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span><strong>{selected.total_delivered}</strong> zugestellt</span>
          {selected.failed_deliveries > 0 && (
            <><XCircle className="h-3.5 w-3.5 text-red-500 ml-2" /><span className="text-red-600"><strong>{selected.failed_deliveries}</strong> Fehler</span></>
          )}
          {selected.pending_deliveries > 0 && (
            <><Clock className="h-3.5 w-3.5 text-amber-500 ml-2" /><span className="text-amber-600"><strong>{selected.pending_deliveries}</strong> ausstehend</span></>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Lade Log…
        </div>
      )}

      {!loading && log.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Activity className="h-8 w-8 opacity-40" />
          <div className="text-sm">Noch keine Delivery-Einträge vorhanden.</div>
        </div>
      )}

      {!loading && log.length > 0 && (
        <div className="space-y-2">
          {log.map(entry => {
            const isSuccess = !!entry.delivered_at && entry.response_status !== null && entry.response_status >= 200 && entry.response_status < 300;
            const isPending = !entry.delivered_at && entry.attempt_count < 5;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className={cn(
                  'rounded-xl border text-sm transition',
                  isSuccess ? 'border-emerald-200 bg-emerald-50/50'
                  : isPending ? 'border-amber-200 bg-amber-50/50'
                  : 'border-red-200 bg-red-50/50',
                )}
              >
                <button
                  className="flex items-start gap-3 w-full px-4 py-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {isSuccess
                      ? <CheckCircle className="h-4 w-4 text-emerald-600" />
                      : isPending
                      ? <Clock className="h-4 w-4 text-amber-600" />
                      : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">{entry.event_type}</span>
                      <span className={cn('font-bold text-xs', statusColor(entry.response_status))}>
                        {entry.response_status !== null ? `HTTP ${entry.response_status}` : '—'}
                      </span>
                      <span className="text-muted-foreground text-xs">{entry.attempt_count} Versuch{entry.attempt_count !== 1 ? 'e' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{fmtDate(entry.created_at)} {fmtTime(entry.created_at)}</span>
                      {entry.delivered_at && <><ChevronRight className="h-2.5 w-2.5" /><span>{fmtTime(entry.delivered_at)}</span></>}
                      {entry.next_retry_at && <span className="text-amber-600">Retry: {fmtTime(entry.next_retry_at)}</span>}
                    </div>
                  </div>
                  <ChevronRight className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 border-t border-inherit/50 space-y-2">
                    {entry.response_body && (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Antwort</div>
                        <pre className="text-[10px] font-mono bg-muted/50 rounded p-2 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {entry.response_body}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Payload</div>
                      <pre className="text-[10px] font-mono bg-muted/50 rounded p-2 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Statistiken ─────────────────────────────────────────────────────────

function StatsTab({ webhooks }: { webhooks: WebhookWithStats[] }) {
  const total = webhooks.length;
  const active = webhooks.filter(w => w.is_active).length;
  const totalDelivered = webhooks.reduce((s, w) => s + (w.total_delivered ?? 0), 0);
  const totalFailed = webhooks.reduce((s, w) => s + (w.failed_deliveries ?? 0), 0);
  const totalPending = webhooks.reduce((s, w) => s + (w.pending_deliveries ?? 0), 0);
  const successRate = totalDelivered + totalFailed > 0
    ? Math.round(totalDelivered / (totalDelivered + totalFailed) * 100)
    : 0;
  const unhealthy = webhooks.filter(w => w.consecutive_failures > 0);

  const eventCounts: Record<string, number> = {};
  for (const wh of webhooks) {
    for (const e of wh.events) {
      eventCounts[e] = (eventCounts[e] ?? 0) + 1;
    }
  }
  const topEvents = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Webhooks gesamt', value: String(total), sub: `${active} aktiv`, color: 'text-foreground' },
          { label: 'Zugestellt', value: totalDelivered.toLocaleString(), sub: 'Alle Webhooks', color: 'text-emerald-600' },
          { label: 'Fehler', value: totalFailed.toLocaleString(), sub: `${totalPending} ausstehend`, color: totalFailed > 0 ? 'text-red-600' : 'text-muted-foreground' },
          {
            label: 'Erfolgsrate',
            value: `${successRate}%`,
            sub: totalDelivered + totalFailed > 0 ? `${totalDelivered + totalFailed} gesamt` : 'Keine Daten',
            color: successRate >= 95 ? 'text-emerald-600' : successRate >= 80 ? 'text-amber-600' : 'text-red-600',
          },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground mb-1">{kpi.label}</div>
            <div className={cn('text-2xl font-display font-bold', kpi.color)}>{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Unhealthy webhooks */}
      {unhealthy.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {unhealthy.length} Webhook{unhealthy.length !== 1 ? 's' : ''} mit Fehlern
          </div>
          {unhealthy.map(wh => (
            <div key={wh.id} className="flex items-center justify-between text-xs">
              <span className="font-mono text-red-800 truncate flex-1">{truncate(wh.url, 50)}</span>
              <span className="shrink-0 ml-2 font-bold text-red-600">{wh.consecutive_failures}× in Folge</span>
            </div>
          ))}
        </div>
      )}

      {/* Event distribution */}
      {topEvents.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="font-display font-bold text-sm">Event-Abonnements</div>
          <div className="space-y-2">
            {topEvents.map(([evt, count]) => (
              <div key={evt} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-xs font-mono text-muted-foreground truncate">{evt}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-matcha-600 rounded-full transition-all"
                    style={{ width: `${total > 0 ? Math.round(count / total * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground w-6 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{total} Webhook{total !== 1 ? 's' : ''} abonniert</div>
        </div>
      )}

      {/* Per-webhook overview */}
      {webhooks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="font-display font-bold text-sm">Webhook-Übersicht</div>
          <div className="space-y-2">
            {webhooks.map(wh => {
              const rate = wh.total_delivered + wh.failed_deliveries > 0
                ? Math.round(wh.total_delivered / (wh.total_delivered + wh.failed_deliveries) * 100)
                : null;
              return (
                <div key={wh.id} className="flex items-center gap-3 py-1 border-b border-border/50 last:border-0">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', wh.is_active ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                  <span className="flex-1 text-xs font-mono truncate text-muted-foreground">{truncate(wh.url, 45)}</span>
                  <span className="text-xs text-emerald-600 font-semibold w-12 text-right shrink-0">
                    {wh.total_delivered.toLocaleString()} ✓
                  </span>
                  {wh.failed_deliveries > 0 && (
                    <span className="text-xs text-red-600 font-semibold w-10 text-right shrink-0">
                      {wh.failed_deliveries} ✗
                    </span>
                  )}
                  {rate !== null && (
                    <span className={cn(
                      'text-xs font-bold w-10 text-right shrink-0',
                      rate >= 95 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      {rate}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {webhooks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <div className="text-sm">Keine Statistiken — noch keine Webhooks konfiguriert.</div>
        </div>
      )}
    </div>
  );
}
