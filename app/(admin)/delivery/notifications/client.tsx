'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { AlertTriangle, Info, CheckCircle2, X, RefreshCw, BellOff, Scan } from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'driver_delay'
  | 'order_cancelled'
  | 'eta_confidence_low'
  | 'batch_stuck'
  | 'no_driver_available'
  | 'high_cancellation_rate'
  | 'driver_offline_mid_tour'
  | 'sla_breach_imminent'
  | 'surge_active'
  | 'kitchen_backlog';

type Severity = 'info' | 'warning' | 'critical';

interface AdminNotification {
  id: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  orderId: string | null;
  driverId: string | null;
  batchId: string | null;
  isRead: boolean;
  isDismissed: boolean;
  ageMinutes: number;
  createdAt: string;
}

interface Summary {
  totalActive: number;
  totalUnread: number;
  criticalCount: number;
  warningCount: number;
  latestNotificationAt: string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<NotificationType, string> = {
  driver_delay: 'Fahrerverzögerung',
  order_cancelled: 'Stornierung',
  eta_confidence_low: 'ETA-Konfidenz',
  batch_stuck: 'Batch feststeckend',
  no_driver_available: 'Kein Fahrer',
  high_cancellation_rate: 'Stornierungsrate',
  driver_offline_mid_tour: 'Fahrer offline',
  sla_breach_imminent: 'SLA-Verletzung',
  surge_active: 'Surge aktiv',
  kitchen_backlog: 'Küchen-Rückstau',
};

function severityColor(s: Severity): string {
  if (s === 'critical') return 'border-red-500 bg-red-50';
  if (s === 'warning') return 'border-amber-400 bg-amber-50';
  return 'border-blue-400 bg-blue-50';
}

function severityIcon(s: Severity) {
  if (s === 'critical') return <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />;
  if (s === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
  return <Info className="h-5 w-5 text-blue-500 shrink-0" />;
}

function ageLabel(minutes: number): string {
  if (minutes < 2) return 'Gerade eben';
  if (minutes < 60) return `${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

// ── Notification-Karte ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onDismiss,
  onMarkRead,
}: {
  notif: AdminNotification;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={`relative rounded-xl border-l-4 p-4 shadow-sm transition-all ${severityColor(notif.severity)} ${!notif.isRead ? 'ring-1 ring-offset-1 ring-slate-300' : 'opacity-80'}`}
    >
      <div className="flex gap-3">
        {severityIcon(notif.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {TYPE_LABELS[notif.type]}
            </span>
            <span className="text-xs text-slate-400">{ageLabel(notif.ageMinutes)}</span>
          </div>
          <p className="font-semibold text-slate-800 mt-0.5">{notif.title}</p>
          <p className="text-sm text-slate-600 mt-1">{notif.body}</p>
          {(notif.orderId || notif.driverId || notif.batchId) && (
            <div className="mt-2 flex gap-2 flex-wrap text-xs text-slate-400">
              {notif.orderId && <span className="bg-white px-2 py-0.5 rounded border">Order: {notif.orderId.slice(0, 8)}</span>}
              {notif.driverId && <span className="bg-white px-2 py-0.5 rounded border">Fahrer: {notif.driverId.slice(0, 8)}</span>}
              {notif.batchId && <span className="bg-white px-2 py-0.5 rounded border">Batch: {notif.batchId.slice(0, 8)}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!notif.isRead && (
            <button
              onClick={() => onMarkRead(notif.id)}
              className="rounded p-1 hover:bg-white/60 text-slate-500 hover:text-slate-800"
              title="Als gelesen markieren"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDismiss(notif.id)}
            className="rounded p-1 hover:bg-white/60 text-slate-500 hover:text-slate-800"
            title="Verwerfen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'unread'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/notifications?action=list');
      const json = await res.json() as { notifications?: AdminNotification[]; summary?: Summary };
      setNotifications(json.notifications ?? []);
      setSummary(json.summary ?? null);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  async function handleDismiss(id: string) {
    await fetch('/api/delivery/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', id }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleMarkRead(id: string) {
    await fetch('/api/delivery/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function handleDismissAll() {
    await fetch('/api/delivery/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss_all' }),
    });
    setNotifications([]);
  }

  async function handleScan() {
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      });
      await load();
    } finally {
      setScanning(false);
    }
  }

  const filtered = notifications.filter((n) => {
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'warning') return n.severity === 'warning';
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const filterBtnClass = (f: typeof filter) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Notification Center"
        description="Kritische Delivery-Events in Echtzeit"
      />

      {/* KPI-Band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Aktiv" value={summary?.totalActive ?? 0} color="text-slate-800" />
        <KpiCard label="Ungelesen" value={summary?.totalUnread ?? 0} color="text-blue-600" />
        <KpiCard label="Kritisch" value={summary?.criticalCount ?? 0} color="text-red-600" />
        <KpiCard label="Warnung" value={summary?.warningCount ?? 0} color="text-amber-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')} className={filterBtnClass('all')}>Alle ({notifications.length})</button>
          <button onClick={() => setFilter('critical')} className={filterBtnClass('critical')}>
            Kritisch ({notifications.filter((n) => n.severity === 'critical').length})
          </button>
          <button onClick={() => setFilter('warning')} className={filterBtnClass('warning')}>
            Warnung ({notifications.filter((n) => n.severity === 'warning').length})
          </button>
          <button onClick={() => setFilter('unread')} className={filterBtnClass('unread')}>
            Ungelesen ({notifications.filter((n) => !n.isRead).length})
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void handleScan()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Scan className="h-4 w-4" />
            {scanning ? 'Scanne…' : 'Jetzt scannen'}
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm font-medium hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {notifications.length > 0 && (
            <button
              onClick={() => void handleDismissAll()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
            >
              <BellOff className="h-4 w-4" />
              Alle verwerfen
            </button>
          )}
        </div>
      </div>

      {lastRefresh && (
        <p className="text-xs text-slate-400">
          Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE')} · Auto-Refresh alle 30s
        </p>
      )}

      {/* Notification-Liste */}
      {loading && notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-3" />
          Lade Notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border rounded-xl bg-white">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-slate-600">Alles in Ordnung</p>
          <p className="text-sm mt-1">Keine aktiven Notifications für diesen Filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <NotifCard
              key={n.id}
              notif={n}
              onDismiss={(id) => void handleDismiss(id)}
              onMarkRead={(id) => void handleMarkRead(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
