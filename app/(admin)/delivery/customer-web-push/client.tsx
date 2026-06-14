'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Settings,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
  Clock,
  Users,
  Zap,
  Activity,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type Config = {
  id: string;
  locationId: string;
  enabled: boolean;
  eventsEnabled: string[];
  dailyLimitPerSub: number;
  updatedAt: string;
};

type Stats = {
  totalSubs: number;
  subsActive7d: number;
  events24h: number;
  sent24h: number;
  failed24h: number;
  expired7d: number;
  deliveryRate24hPct: number | null;
};

type LogEntry = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  status: 'sent' | 'failed' | 'expired' | 'skipped';
  error: string | null;
  createdAt: string;
};

type SubCounts = { total: number; withEmail: number; withOrder: number };

type Dashboard = {
  config: Config | null;
  stats: Stats;
  recentLog: LogEntry[];
  subscriptions: SubCounts;
  vapidConfigured: boolean;
};

const ALL_EVENTS = [
  { key: 'driver_assigned',       label: 'Fahrer zugewiesen' },
  { key: 'driver_at_restaurant',  label: 'Fahrer am Restaurant' },
  { key: 'driver_departing',      label: 'Bestellung unterwegs' },
  { key: 'driver_nearby',         label: 'Fahrer in der Nähe' },
  { key: 'driver_almost_there',   label: 'Fahrer ~2 Min weg' },
  { key: 'delivered',             label: 'Bestellung geliefert' },
  { key: 'cancelled',             label: 'Bestellung storniert' },
  { key: 'delayed',               label: 'Verzögerung' },
  { key: 'rating_request',        label: 'Bewertungsanfrage' },
  { key: 'loyalty_tier_upgrade',  label: 'Treuepunkte-Level' },
] as const;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'sent')    return 'text-green-600 bg-green-50 border-green-200';
  if (s === 'failed')  return 'text-red-600 bg-red-50 border-red-200';
  if (s === 'expired') return 'text-gray-500 bg-gray-50 border-gray-200';
  return 'text-amber-600 bg-amber-50 border-amber-200';
}

function statusIcon(s: string) {
  if (s === 'sent')    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (s === 'failed')  return <XCircle      className="h-3.5 w-3.5 text-red-500" />;
  if (s === 'expired') return <Clock        className="h-3.5 w-3.5 text-gray-400" />;
  return <Clock className="h-3.5 w-3.5 text-amber-400" />;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function CustomerWebPushClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'overview' | 'log' | 'config' | 'broadcast'>('overview');
  const [saving, setSaving]   = useState(false);

  // Config form state
  const [cfgEnabled,   setCfgEnabled]   = useState(false);
  const [cfgEvents,    setCfgEvents]    = useState<string[]>([]);
  const [cfgDailyLimit, setCfgDailyLimit] = useState(10);

  // Broadcast form
  const [bcTitle,  setBcTitle]  = useState('');
  const [bcBody,   setBcBody]   = useState('');
  const [bcUrl,    setBcUrl]    = useState('/');
  const [bcResult, setBcResult] = useState<{ sent: number; failed: number; expired: number } | null>(null);
  const [bcSending, setBcSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/customer-web-push?location_id=${locationId}`);
      if (!res.ok) return;
      const d: Dashboard = await res.json();
      setData(d);
      if (d.config) {
        setCfgEnabled(d.config.enabled);
        setCfgEvents(d.config.eventsEnabled);
        setCfgDailyLimit(d.config.dailyLimitPerSub);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/delivery/admin/customer-web-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_config', enabled: cfgEnabled, eventsEnabled: cfgEvents, dailyLimitPerSub: cfgDailyLimit }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcast = async () => {
    if (!bcTitle || !bcBody) return;
    setBcSending(true);
    setBcResult(null);
    try {
      const res = await fetch('/api/delivery/admin/customer-web-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'broadcast', title: bcTitle, body: bcBody, url: bcUrl }),
      });
      const d = await res.json();
      setBcResult({ sent: d.sent ?? 0, failed: d.failed ?? 0, expired: d.expired ?? 0 });
      await load();
    } finally {
      setBcSending(false);
    }
  };

  const toggleEvent = (key: string) => {
    setCfgEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
    );
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Lade...</div>;
  }

  const s = data?.stats;
  const sub = data?.subscriptions;

  return (
    <div className="space-y-5 p-1">

      {/* VAPID-Warnung */}
      {data && !data.vapidConfigured && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            VAPID nicht konfiguriert — setze <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>, <code className="bg-amber-100 px-1 rounded">VAPID_PRIVATE_KEY</code> und <code className="bg-amber-100 px-1 rounded">VAPID_CONTACT</code> als Umgebungsvariablen.
          </p>
        </Card>
      )}

      {/* Status-Hero */}
      <Card className={cn('p-5 flex items-center gap-4', data?.config?.enabled ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-gray-50/40')}>
        <div className={cn('rounded-full p-3', data?.config?.enabled ? 'bg-green-100' : 'bg-gray-100')}>
          {data?.config?.enabled ? <BellRing className="h-6 w-6 text-green-600" /> : <BellOff className="h-6 w-6 text-gray-400" />}
        </div>
        <div className="flex-1">
          <div className="font-bold text-base">{data?.config?.enabled ? 'Browser-Push aktiv' : 'Browser-Push deaktiviert'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data?.config?.eventsEnabled?.length ?? 0} Events konfiguriert · max. {data?.config?.dailyLimitPerSub ?? 10} Push/Tag/Abo
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </Card>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<Users className="h-4 w-4" />}    label="Subscriptions"    value={sub?.total ?? 0}                                 sub={`${sub?.withEmail ?? 0} mit E-Mail`} />
        <KpiCard icon={<Bell className="h-4 w-4" />}     label="Gesendet (24h)"   value={s?.sent24h ?? 0}                                 sub={`${s?.events24h ?? 0} Events`} color="green" />
        <KpiCard icon={<Zap className="h-4 w-4" />}      label="Zustellrate"      value={s?.deliveryRate24hPct != null ? `${s.deliveryRate24hPct}%` : '—'} sub="letzte 24h" color={Number(s?.deliveryRate24hPct) >= 90 ? 'green' : 'amber'} />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Aktiv (7 Tage)"   value={s?.subsActive7d ?? 0}                            sub={`${s?.expired7d ?? 0} abgelaufen`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0">
        {(['overview', 'log', 'config', 'broadcast'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px transition',
              tab === t ? 'border-matcha-600 text-matcha-700' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'overview' ? 'Übersicht' : t === 'log' ? 'Push-Log' : t === 'config' ? 'Konfiguration' : 'Broadcast'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Subscription-Aufschlüsselung</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-2xl font-bold">{sub?.total ?? 0}</div><div className="text-xs text-muted-foreground">Gesamt</div></div>
              <div><div className="text-2xl font-bold text-blue-600">{sub?.withEmail ?? 0}</div><div className="text-xs text-muted-foreground">Mit E-Mail</div></div>
              <div><div className="text-2xl font-bold text-purple-600">{sub?.withOrder ?? 0}</div><div className="text-xs text-muted-foreground">Mit Bestellung</div></div>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">Wie funktioniert es?</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>1. Kunde öffnet Storefront → Browser fragt Push-Permission</li>
              <li>2. Bei Zustimmung: VAPID-Subscription wird mit Bestellung verknüpft</li>
              <li>3. Lieferstatus-Events lösen automatisch Browser-Push aus</li>
              <li>4. Klick auf Notification öffnet Live-Tracking-Seite</li>
            </ul>
          </Card>
        </div>
      )}

      {/* Log */}
      {tab === 'log' && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Push-Log (letzte 50)</h3>
          {(data?.recentLog ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Noch keine Pushes gesendet.</p>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {data?.recentLog.map((entry) => (
                <div key={entry.id} className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-xs', statusColor(entry.status))}>
                  <div className="mt-0.5 flex-shrink-0">{statusIcon(entry.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entry.title}</div>
                    <div className="text-[10px] opacity-70 truncate">{entry.body}</div>
                    {entry.error && <div className="text-[10px] text-red-500 mt-0.5">{entry.error}</div>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div>{fmtTime(entry.createdAt)}</div>
                    <Badge variant="secondary" className="text-[9px] h-4 mt-0.5">{entry.eventType}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Config */}
      {tab === 'config' && (
        <Card className="p-5 space-y-5">
          <h3 className="font-semibold text-sm">Browser-Push Konfiguration</h3>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Browser-Push aktivieren</div>
              <div className="text-xs text-muted-foreground">Sendet native Browser-Benachrichtigungen an Kunden</div>
            </div>
            <button
              onClick={() => setCfgEnabled((v) => !v)}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition', cfgEnabled ? 'bg-matcha-600' : 'bg-gray-200')}
            >
              <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', cfgEnabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>

          {/* Events */}
          <div>
            <div className="font-medium text-sm mb-2">Events mit Push-Benachrichtigung</div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_EVENTS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={cfgEvents.includes(key)}
                    onChange={() => toggleEvent(key)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Daily limit */}
          <div>
            <label className="block font-medium text-sm mb-1">Max. Pushes pro Subscription pro Tag</label>
            <input
              type="number"
              min={1}
              max={50}
              value={cfgDailyLimit}
              onChange={(e) => setCfgDailyLimit(Number(e.target.value))}
              className="w-24 rounded border border-input px-3 py-1.5 text-sm"
            />
          </div>

          <Button onClick={saveConfig} disabled={saving} size="sm">
            {saving ? 'Speichern...' : 'Konfiguration speichern'}
          </Button>
        </Card>
      )}

      {/* Broadcast */}
      {tab === 'broadcast' && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm">Broadcast an alle Subscriber</h3>
          <p className="text-xs text-muted-foreground">Sendet eine Push-Benachrichtigung an alle aktiven Browser-Subscriptions dieser Location.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Titel</label>
              <input
                type="text"
                value={bcTitle}
                onChange={(e) => setBcTitle(e.target.value)}
                placeholder="z.B. Sonderangebot heute Abend 🍕"
                className="w-full rounded border border-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nachricht</label>
              <textarea
                value={bcBody}
                onChange={(e) => setBcBody(e.target.value)}
                rows={3}
                placeholder="z.B. Heute 20% Rabatt auf alle Pizzen mit Code PIZZA20"
                className="w-full rounded border border-input px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">URL (Zielseite bei Klick)</label>
              <input
                type="text"
                value={bcUrl}
                onChange={(e) => setBcUrl(e.target.value)}
                placeholder="/"
                className="w-full rounded border border-input px-3 py-2 text-sm"
              />
            </div>
          </div>

          <Button onClick={sendBroadcast} disabled={bcSending || !bcTitle || !bcBody} size="sm">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {bcSending ? 'Sende...' : `Broadcast senden (${sub?.total ?? 0} Subscriber)`}
          </Button>

          {bcResult && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              ✅ Gesendet: <strong>{bcResult.sent}</strong> · Fehlgeschlagen: {bcResult.failed} · Abgelaufen: {bcResult.expired}
            </div>
          )}

          <div className="mt-4 border-t pt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                await fetch('/api/delivery/admin/customer-web-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prune_logs', days: 30 }) });
                load();
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Logs &gt;30 Tage löschen
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={async () => {
                await fetch('/api/delivery/admin/customer-web-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prune_subs', days: 90 }) });
                load();
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Inaktive Subs &gt;90 Tage löschen
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'amber' | 'red';
}) {
  const colorMap = { green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600' };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">{icon}<span className="text-xs">{label}</span></div>
      <div className={cn('text-2xl font-bold', color ? colorMap[color] : '')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
