'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare, Send, Bell, Radio, Cpu, RefreshCw,
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Filter, User, ArrowUpDown,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

type CommChannel   = 'push' | 'broadcast' | 'in_app' | 'system';
type CommStatus    = 'sent' | 'delivered' | 'read' | 'failed';

interface CommLogEntry {
  id: string;
  locationId: string;
  driverId: string | null;
  driverName: string | null;
  channel: CommChannel;
  messageType: string;
  direction: string;
  title: string | null;
  body: string;
  status: CommStatus;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  sentByName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
}

interface CommLogStats {
  totalMessages: number;
  messagesToday: number;
  messagesWeek: number;
  pushCount: number;
  broadcastCount: number;
  inAppCount: number;
  systemCount: number;
  readCount: number;
  deliveredCount: number;
  failedCount: number;
  readRatePct: number | null;
  deliveryRatePct: number | null;
}

interface DriverCommSummary {
  driverId: string;
  driverName: string | null;
  totalMessages: number;
  messagesToday: number;
  lastMessageAt: string | null;
  readCount: number;
  pushCount: number;
  broadcastCount: number;
}

interface HourlyBucket { hour: number; count: number }

interface Dashboard {
  stats: CommLogStats;
  recentMessages: CommLogEntry[];
  driverSummaries: DriverCommSummary[];
  hourlyVolume: HourlyBucket[];
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function channelLabel(c: CommChannel) {
  return c === 'push' ? 'Push' : c === 'broadcast' ? 'Broadcast' : c === 'in_app' ? 'In-App' : 'System';
}

function channelIcon(c: CommChannel) {
  switch (c) {
    case 'push':      return <Bell className="w-3.5 h-3.5" />;
    case 'broadcast': return <Radio className="w-3.5 h-3.5" />;
    case 'in_app':    return <MessageSquare className="w-3.5 h-3.5" />;
    case 'system':    return <Cpu className="w-3.5 h-3.5" />;
  }
}

function channelColor(c: CommChannel) {
  return c === 'push'      ? 'bg-blue-900/40 text-blue-300 border-blue-700'
    :  c === 'broadcast'   ? 'bg-purple-900/40 text-purple-300 border-purple-700'
    :  c === 'in_app'      ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700'
    :                        'bg-zinc-800 text-zinc-400 border-zinc-600';
}

function statusIcon(s: CommStatus) {
  return s === 'read'      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
    :  s === 'delivered'   ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
    :  s === 'failed'      ? <XCircle className="w-3.5 h-3.5 text-red-400" />
    :                        <Clock className="w-3.5 h-3.5 text-zinc-400" />;
}

function statusLabel(s: CommStatus) {
  return s === 'read'      ? 'Gelesen'
    :  s === 'delivered'   ? 'Zugestellt'
    :  s === 'failed'      ? 'Fehlgeschlagen'
    :                        'Gesendet';
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    dispatch_assign: 'Tour-Zuweisung',
    route_update:    'Routen-Update',
    broadcast:       'Broadcast',
    surge_notify:    'Surge-Warnung',
    positioning:     'Positionierung',
    challenge:       'Challenge',
    shift_alert:     'Schicht-Alarm',
    system:          'System',
    custom:          'Direkt-Nachricht',
  };
  return map[t] ?? t;
}

// ─── Subkomponenten ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MessageRow({ entry }: { entry: CommLogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-3 hover:bg-zinc-800/40 transition-colors text-left"
      >
        <div className="mt-0.5 flex-shrink-0">{channelIcon(entry.channel)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${channelColor(entry.channel)}`}>
              {channelLabel(entry.channel)}
            </span>
            <span className="text-xs text-zinc-500">{typeLabel(entry.messageType)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
              {statusIcon(entry.status)}{statusLabel(entry.status)}
            </span>
            {entry.driverName && (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <User className="w-3 h-3" />{entry.driverName}
              </span>
            )}
            {!entry.driverId && (
              <span className="text-xs text-zinc-500 italic">→ Alle Fahrer</span>
            )}
          </div>
          <p className="text-sm text-zinc-200 mt-1 truncate">{entry.title ?? entry.body}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{fmtDate(entry.sentAt)}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="bg-zinc-900/60 border-t border-zinc-800 p-4 text-sm space-y-2">
          {entry.title && (
            <div>
              <span className="text-zinc-500 text-xs">Titel:</span>
              <p className="text-zinc-200">{entry.title}</p>
            </div>
          )}
          <div>
            <span className="text-zinc-500 text-xs">Nachricht:</span>
            <p className="text-zinc-200 whitespace-pre-wrap">{entry.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">Gesendet:</span>{' '}
              <span className="text-zinc-300">{fmtTime(entry.sentAt)}</span>
            </div>
            {entry.deliveredAt && (
              <div>
                <span className="text-zinc-500">Zugestellt:</span>{' '}
                <span className="text-zinc-300">{fmtTime(entry.deliveredAt)}</span>
              </div>
            )}
            {entry.readAt && (
              <div>
                <span className="text-zinc-500">Gelesen:</span>{' '}
                <span className="text-green-400">{fmtTime(entry.readAt)}</span>
              </div>
            )}
            {entry.sentByName && (
              <div>
                <span className="text-zinc-500">Von:</span>{' '}
                <span className="text-zinc-300">{entry.sentByName}</span>
              </div>
            )}
            {entry.referenceType && (
              <div>
                <span className="text-zinc-500">Referenz:</span>{' '}
                <span className="text-zinc-400">{entry.referenceType} {entry.referenceId?.slice(0, 8)}…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HourlyBar({ data }: { data: HourlyBucket[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">Nachrichten-Volumen (24h)</h3>
      <div className="flex items-end gap-1 h-20">
        {data.map(({ hour, count }) => (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-blue-600/60 rounded-sm transition-all"
              style={{ height: `${(count / max) * 72}px`, minHeight: count > 0 ? '2px' : '0' }}
              title={`${hour}:00 — ${count} Nachrichten`}
            />
            {hour % 6 === 0 && (
              <span className="text-[10px] text-zinc-600">{hour}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Direkt-Nachricht senden ──────────────────────────────────────────────────

function SendDirectForm({
  locationId,
  drivers,
  dispatcherName,
  onSent,
}: {
  locationId: string;
  drivers: DriverCommSummary[];
  dispatcherName?: string;
  onSent: () => void;
}) {
  const [driverId, setDriverId] = useState('');
  const [title, setTitle]   = useState('Nachricht vom Dispatch');
  const [body, setBody]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<string | null>(null);

  async function handleSend() {
    if (!driverId || !body.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/delivery/admin/comms-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_direct',
          location_id: locationId,
          driver_id: driverId,
          title,
          body: body.trim(),
        }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (json.ok) {
        setResult('✓ Nachricht gesendet');
        setBody('');
        onSent();
      } else {
        setResult(`Fehler: ${json.error ?? 'Unbekannt'}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Send className="w-4 h-4 text-blue-400" />
        Direkt-Nachricht senden
      </h3>
      <select
        value={driverId}
        onChange={e => setDriverId(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
      >
        <option value="">— Fahrer auswählen —</option>
        {drivers.map(d => (
          <option key={d.driverId} value={d.driverId}>
            {d.driverName ?? d.driverId.slice(0, 8)}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Titel"
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Nachricht (max. 280 Zeichen)"
        maxLength={280}
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{body.length}/280</span>
        <button
          onClick={handleSend}
          disabled={loading || !driverId || !body.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Senden
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
          {result}
        </p>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function CommsLogClient({
  locationId,
  dispatcherName,
}: {
  locationId: string;
  dispatcherName?: string;
}) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'log' | 'drivers' | 'send'>('log');

  // Filter
  const [filterChannel, setFilterChannel] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterDriver,  setFilterDriver]  = useState('');
  const [filteredEntries, setFilteredEntries] = useState<CommLogEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/comms-log?location_id=${locationId}&action=dashboard`);
      const data = await res.json() as Dashboard;
      setDashboard(data);
      setFilteredEntries(data.recentMessages ?? []);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh 60s
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Filter anwenden
  useEffect(() => {
    if (!dashboard) return;
    let entries = dashboard.recentMessages;
    if (filterChannel) entries = entries.filter(e => e.channel === filterChannel);
    if (filterStatus)  entries = entries.filter(e => e.status  === filterStatus);
    if (filterDriver)  entries = entries.filter(e => e.driverId === filterDriver || e.driverName?.toLowerCase().includes(filterDriver.toLowerCase()));
    setFilteredEntries(entries);
  }, [dashboard, filterChannel, filterStatus, filterDriver]);

  const stats = dashboard?.stats;

  return (
    <div className="space-y-6 p-6">

      {/* ─── KPI-Karten ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gesamt heute"
          value={stats?.messagesToday ?? '—'}
          sub={`${stats?.messagesWeek ?? 0} diese Woche`}
          icon={MessageSquare}
          color="bg-blue-900/40 text-blue-400"
        />
        <StatCard
          label="Zustellrate"
          value={stats?.deliveryRatePct != null ? `${stats.deliveryRatePct}%` : '—'}
          sub={`${stats?.deliveredCount ?? 0} zugestellt`}
          icon={CheckCircle2}
          color="bg-green-900/40 text-green-400"
        />
        <StatCard
          label="Leserate"
          value={stats?.readRatePct != null ? `${stats.readRatePct}%` : '—'}
          sub={`${stats?.readCount ?? 0} gelesen`}
          icon={ArrowUpDown}
          color="bg-amber-900/40 text-amber-400"
        />
        <StatCard
          label="Fehler"
          value={stats?.failedCount ?? '—'}
          sub={`Push: ${stats?.pushCount ?? 0} · Broadcast: ${stats?.broadcastCount ?? 0}`}
          icon={XCircle}
          color="bg-red-900/40 text-red-400"
        />
      </div>

      {/* ─── Stunden-Balkendiagramm ─────────────────────────────────────────── */}
      {dashboard?.hourlyVolume && dashboard.hourlyVolume.length > 0 && (
        <HourlyBar data={dashboard.hourlyVolume} />
      )}

      {/* ─── Kanal-Übersicht ────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {([
            { key: 'push',      label: 'Push',       count: stats.pushCount,      icon: Bell,         color: 'text-blue-400' },
            { key: 'broadcast', label: 'Broadcast',  count: stats.broadcastCount, icon: Radio,        color: 'text-purple-400' },
            { key: 'in_app',    label: 'In-App',     count: stats.inAppCount,     icon: MessageSquare,color: 'text-cyan-400' },
            { key: 'system',    label: 'System',     count: stats.systemCount,    icon: Cpu,          color: 'text-zinc-400' },
          ] as const).map(({ key, label, count, icon: Icon, color }) => (
            <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold text-white">{count}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-zinc-800 pb-0">
        {(['log', 'drivers', 'send'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t transition-colors ${
              tab === t
                ? 'bg-zinc-800 text-white border-t border-l border-r border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'log' ? 'Nachrichten-Log' : t === 'drivers' ? 'Fahrer-Übersicht' : 'Nachricht senden'}
          </button>
        ))}
        <button
          onClick={() => { void load(); }}
          className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* ─── Tab: Nachrichten-Log ───────────────────────────────────────────── */}
      {tab === 'log' && (
        <div className="space-y-4">
          {/* Filter-Leiste */}
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
            >
              <option value="">Alle Kanäle</option>
              <option value="push">Push</option>
              <option value="broadcast">Broadcast</option>
              <option value="in_app">In-App</option>
              <option value="system">System</option>
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
            >
              <option value="">Alle Status</option>
              <option value="sent">Gesendet</option>
              <option value="delivered">Zugestellt</option>
              <option value="read">Gelesen</option>
              <option value="failed">Fehler</option>
            </select>
            <input
              type="text"
              value={filterDriver}
              onChange={e => setFilterDriver(e.target.value)}
              placeholder="Fahrer suchen…"
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 w-36"
            />
            {(filterChannel || filterStatus || filterDriver) && (
              <button
                onClick={() => { setFilterChannel(''); setFilterStatus(''); setFilterDriver(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕ Zurücksetzen
              </button>
            )}
            <span className="text-xs text-zinc-600 ml-auto">{filteredEntries.length} Einträge</span>
          </div>

          {loading && !dashboard && (
            <div className="text-center py-12 text-zinc-500">Lade…</div>
          )}

          {!loading && filteredEntries.length === 0 && (
            <div className="text-center py-12 text-zinc-500 border border-zinc-800 rounded-lg">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Noch keine Nachrichten vorhanden.</p>
              <p className="text-xs mt-1">Nachrichten werden automatisch geloggt sobald Push-, Broadcast- oder System-Nachrichten gesendet werden.</p>
            </div>
          )}

          <div className="space-y-2">
            {filteredEntries.map(entry => (
              <MessageRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Tab: Fahrer-Übersicht ──────────────────────────────────────────── */}
      {tab === 'drivers' && (
        <div className="space-y-3">
          {(dashboard?.driverSummaries ?? []).length === 0 && (
            <div className="text-center py-12 text-zinc-500 border border-zinc-800 rounded-lg">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Noch keine Fahrer-Kommunikationsdaten.</p>
            </div>
          )}
          {(dashboard?.driverSummaries ?? []).map(d => (
            <div key={d.driverId} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white">{d.driverName ?? 'Unbekannt'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {d.messagesToday} heute · {d.totalMessages} gesamt
                    {d.lastMessageAt && ` · Zuletzt: ${fmtDate(d.lastMessageAt)}`}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="bg-blue-900/40 text-blue-300 border border-blue-700 px-2 py-0.5 rounded">
                    {d.pushCount} Push
                  </span>
                  <span className="bg-purple-900/40 text-purple-300 border border-purple-700 px-2 py-0.5 rounded">
                    {d.broadcastCount} Broadcast
                  </span>
                  <span className="bg-green-900/40 text-green-300 border border-green-700 px-2 py-0.5 rounded">
                    {d.readCount} gelesen
                  </span>
                </div>
              </div>
              {d.totalMessages > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500/60 rounded-full"
                      style={{ width: `${Math.round((d.readCount / d.totalMessages) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {Math.round((d.readCount / d.totalMessages) * 100)}% Leserate
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Tab: Nachricht senden ──────────────────────────────────────────── */}
      {tab === 'send' && (
        <SendDirectForm
          locationId={locationId}
          drivers={dashboard?.driverSummaries ?? []}
          dispatcherName={dispatcherName}
          onSent={() => { void load(); }}
        />
      )}

      {/* ─── Info-Box ───────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-500 space-y-1">
        <p className="font-medium text-zinc-400">So funktioniert der Kommunikations-Log:</p>
        <p>• <strong className="text-zinc-400">Push</strong> — Direkte Push-Benachrichtigungen an Fahrer-App (Tour-Zuweisung, Surge-Warnung)</p>
        <p>• <strong className="text-zinc-400">Broadcast</strong> — Nachrichten an alle aktiven Fahrer einer Location</p>
        <p>• <strong className="text-zinc-400">In-App</strong> — Nachrichten die in der Fahrer-App angezeigt werden</p>
        <p>• <strong className="text-zinc-400">System</strong> — Automatische System-Benachrichtigungen (Schicht-Alerts, Positions-Empfehlungen)</p>
        <p className="pt-1">Der Log wird automatisch befüllt — kein manueller Aufwand. Logs älter als 90 Tage werden automatisch gelöscht.</p>
      </div>
    </div>
  );
}
