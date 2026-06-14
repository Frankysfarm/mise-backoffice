'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, CheckCircle2, XCircle, Clock, Users, Send,
  Settings, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  RefreshCw, Smartphone, Zap, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface WhatsAppConfig {
  locationId: string;
  isEnabled: boolean;
  provider: 'meta' | 'twilio' | 'disabled';
  metaPhoneId: string | null;
  metaAccessToken: string | null;
  twilioSid: string | null;
  twilioToken: string | null;
  twilioWhatsappFrom: string | null;
  templateDriverAssigned: string;
  templateDriverDeparting: string;
  templateDriverNearby: string;
  templateDelivered: string;
  templateCancelled: string;
  templateDelayed: string;
  languageCode: string;
  enabledEvents: string[];
  optinMode: 'explicit' | 'implicit';
  dailyLimitPerNumber: number;
}

interface WhatsAppStats {
  totalMessages: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  last24h: number;
  uniqueRecipients: number;
  activeOptins: number;
  deliveryRatePct: number | null;
}

interface LogEntry {
  id: string;
  phone: string;
  eventType: string;
  templateName: string | null;
  provider: string;
  status: string;
  providerMsgId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

const ALL_EVENTS = [
  { key: 'driver_assigned',  label: 'Fahrer zugewiesen' },
  { key: 'driver_departing', label: 'Fahrer losgefahren' },
  { key: 'driver_nearby',    label: 'Fahrer gleich da' },
  { key: 'delivered',        label: 'Geliefert' },
  { key: 'cancelled',        label: 'Storniert' },
  { key: 'delayed',          label: 'Verspätet' },
];

// ── Haupt-Komponente ───────────────────────────────────────────────────────────

export function WhatsAppClient({ locationId }: { locationId: string }) {
  const [config, setConfig]   = useState<WhatsAppConfig | null>(null);
  const [stats, setStats]     = useState<WhatsAppStats | null>(null);
  const [log, setLog]         = useState<LogEntry[]>([]);
  const [tab, setTab]         = useState<'overview' | 'config' | 'log'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, logRes] = await Promise.all([
        fetch(`/api/delivery/admin/whatsapp-config?action=stats`),
        fetch(`/api/delivery/admin/whatsapp-config?action=log&limit=50`),
      ]);
      if (statsRes.ok) {
        const d = await statsRes.json() as { config: WhatsAppConfig | null; stats: WhatsAppStats };
        setConfig(d.config);
        setStats(d.stats);
      }
      if (logRes.ok) {
        const d = await logRes.json() as { log: LogEntry[] };
        setLog(d.log);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async (patch: Partial<WhatsAppConfig>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/delivery/admin/whatsapp-config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'save_config', ...patch }),
      });
      if (res.ok) {
        setConfig((prev) => prev ? { ...prev, ...patch } : prev);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    if (!config) return;
    void handleSave({ isEnabled: !config.isEnabled });
  };

  const handleSendTest = async () => {
    if (!testPhone) return;
    setTestSending(true);
    setTestResult(null);
    try {
      // Opt-in für Testphone setzen
      await fetch('/api/delivery/admin/whatsapp-config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'set_optin', phone: testPhone, optedIn: true }),
      });
      const res = await fetch('/api/delivery/admin/whatsapp-config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'send_test', phone: testPhone }),
      });
      const d = await res.json() as { ok?: boolean; note?: string; error?: string };
      setTestResult(d.note ?? d.error ?? (d.ok ? 'Gesendet' : 'Fehler'));
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {(['overview', 'config', 'log'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-semibold rounded-t transition',
              tab === t
                ? 'bg-card border border-b-white text-foreground shadow-sm -mb-px'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'overview' ? 'Übersicht' : t === 'config' ? 'Konfiguration' : 'Nachrichten-Log'}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <button onClick={load} className="text-muted-foreground hover:text-foreground p-1.5 rounded transition">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Übersicht ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Status-Banner */}
          <Card className={cn(
            'p-4 flex items-center justify-between',
            config?.isEnabled ? 'bg-green-50 border-green-200' : 'bg-muted/40',
          )}>
            <div className="flex items-center gap-3">
              <MessageCircle className={cn('h-6 w-6', config?.isEnabled ? 'text-green-600' : 'text-muted-foreground')} />
              <div>
                <div className="font-bold text-sm">
                  WhatsApp {config?.isEnabled ? 'Aktiv' : 'Inaktiv'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Provider: {config?.provider === 'meta' ? 'Meta Cloud API' : config?.provider === 'twilio' ? 'Twilio' : 'Nicht konfiguriert'}
                </div>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={saving || !config}
              className="text-muted-foreground hover:text-foreground transition"
            >
              {config?.isEnabled
                ? <ToggleRight className="h-8 w-8 text-green-600" />
                : <ToggleLeft  className="h-8 w-8" />}
            </button>
          </Card>

          {/* KPI-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Send   className="h-4 w-4" />} label="Gesendet (gesamt)" value={stats?.sentCount ?? 0} />
            <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Zugestellt" value={stats?.deliveredCount ?? 0} color="green" />
            <KpiCard icon={<XCircle className="h-4 w-4" />} label="Fehlgeschlagen" value={stats?.failedCount ?? 0} color="red" />
            <KpiCard icon={<Users  className="h-4 w-4" />} label="Opt-Ins aktiv" value={stats?.activeOptins ?? 0} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard icon={<Clock  className="h-4 w-4" />} label="Letzte 24h" value={stats?.last24h ?? 0} />
            <KpiCard icon={<Smartphone className="h-4 w-4" />} label="Einzel-Empfänger" value={stats?.uniqueRecipients ?? 0} />
            <KpiCard
              icon={<Zap className="h-4 w-4" />}
              label="Zustellrate"
              value={stats?.deliveryRatePct != null ? `${stats.deliveryRatePct}%` : '—'}
              color={stats?.deliveryRatePct != null && stats.deliveryRatePct >= 90 ? 'green' : 'amber'}
            />
          </div>

          {/* Aktive Events */}
          {config && (
            <Card className="p-4">
              <div className="font-display font-bold text-sm mb-3">Aktive Ereignis-Typen</div>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((e) => (
                  <Badge
                    key={e.key}
                    variant={config.enabledEvents.includes(e.key) ? 'default' : 'secondary'}
                    className={cn(config.enabledEvents.includes(e.key) && 'bg-matcha-700 text-white')}
                  >
                    {e.label}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Test-Senden */}
          <Card className="p-4">
            <div className="font-display font-bold text-sm mb-3">Test-Nachricht senden</div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+49 176 12345678"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
              <Button
                onClick={handleSendTest}
                disabled={testSending || !testPhone || !config?.isEnabled}
                size="sm"
              >
                {testSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="ml-1">Senden</span>
              </Button>
            </div>
            {testResult && (
              <p className="mt-2 text-xs text-muted-foreground">{testResult}</p>
            )}
          </Card>
        </div>
      )}

      {/* ── Konfiguration ─────────────────────────────────────────── */}
      {tab === 'config' && config && (
        <ConfigPanel config={config} onSave={handleSave} saving={saving} />
      )}
      {tab === 'config' && !config && (
        <ConfigPanel
          config={{
            locationId,
            isEnabled: false,
            provider: 'disabled',
            metaPhoneId: null,
            metaAccessToken: null,
            twilioSid: null,
            twilioToken: null,
            twilioWhatsappFrom: null,
            templateDriverAssigned:  'mise_driver_assigned',
            templateDriverDeparting: 'mise_driver_departing',
            templateDriverNearby:    'mise_driver_nearby',
            templateDelivered:       'mise_delivered',
            templateCancelled:       'mise_cancelled',
            templateDelayed:         'mise_delayed',
            languageCode:    'de',
            enabledEvents:   ['driver_departing', 'driver_nearby', 'delivered', 'cancelled'],
            optinMode:       'explicit',
            dailyLimitPerNumber: 10,
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* ── Log ───────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border font-display font-bold text-sm">
            Zuletzt gesendete Nachrichten ({log.length})
          </div>
          {log.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Noch keine Nachrichten gesendet.</div>
          ) : (
            <div className="divide-y divide-border">
              {log.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Log-Zeile ─────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const statusColor = {
    sent:      'text-blue-600',
    delivered: 'text-green-600',
    failed:    'text-red-600',
    read:      'text-purple-600',
    pending:   'text-amber-600',
  }[entry.status] ?? 'text-muted-foreground';

  const statusIcon = {
    sent:      <Clock      className="h-3.5 w-3.5" />,
    delivered: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed:    <XCircle    className="h-3.5 w-3.5" />,
    read:      <Eye        className="h-3.5 w-3.5" />,
    pending:   <RefreshCw  className="h-3.5 w-3.5" />,
  }[entry.status] ?? <AlertTriangle className="h-3.5 w-3.5" />;

  return (
    <div className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-muted/30">
      <span className={cn('flex items-center gap-1 font-medium w-24 shrink-0', statusColor)}>
        {statusIcon}
        <span className="capitalize">{entry.status}</span>
      </span>
      <span className="font-mono text-xs text-muted-foreground w-36 shrink-0 truncate">
        {entry.phone}
      </span>
      <span className="text-xs text-muted-foreground w-32 shrink-0">
        {entry.eventType.replace(/_/g, ' ')}
      </span>
      <span className="text-xs text-muted-foreground truncate flex-1">
        {entry.templateName ?? '—'}
      </span>
      <span className="text-xs text-muted-foreground w-24 shrink-0 text-right">
        {new Date(entry.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </span>
      {entry.errorMessage && (
        <span className="text-xs text-red-500 truncate max-w-[200px]" title={entry.errorMessage}>
          {entry.errorMessage}
        </span>
      )}
    </div>
  );
}

// ── Konfigurationspanel ───────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
  saving,
}: {
  config: WhatsAppConfig;
  onSave: (patch: Partial<WhatsAppConfig>) => Promise<void>;
  saving: boolean;
}) {
  const [local, setLocal]             = useState<WhatsAppConfig>(config);
  const [showToken, setShowToken]     = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const update = (patch: Partial<WhatsAppConfig>) => setLocal((p) => ({ ...p, ...patch }));

  const toggleEvent = (key: string) => {
    const has = local.enabledEvents.includes(key);
    update({ enabledEvents: has ? local.enabledEvents.filter((e) => e !== key) : [...local.enabledEvents, key] });
  };

  return (
    <div className="space-y-4">
      {/* Provider */}
      <Card className="p-4 space-y-4">
        <h3 className="font-display font-bold text-sm">Provider</h3>
        <div className="flex gap-2">
          {(['meta', 'twilio', 'disabled'] as const).map((p) => (
            <button
              key={p}
              onClick={() => update({ provider: p })}
              className={cn(
                'flex-1 py-2 rounded-lg border text-sm font-semibold transition',
                local.provider === p
                  ? 'bg-matcha-700 text-white border-matcha-700'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              {p === 'meta' ? 'Meta Cloud API' : p === 'twilio' ? 'Twilio' : 'Deaktiviert'}
            </button>
          ))}
        </div>

        {local.provider === 'meta' && (
          <div className="space-y-3">
            <LabeledInput
              label="Phone ID (aus Meta Business Suite)"
              value={local.metaPhoneId ?? ''}
              onChange={(v) => update({ metaPhoneId: v })}
              placeholder="123456789012345"
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground">Access Token</span>
                <button onClick={() => setShowToken((v) => !v)} className="text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <input
                type={showToken ? 'text' : 'password'}
                value={local.metaAccessToken ?? ''}
                onChange={(e) => update({ metaAccessToken: e.target.value })}
                placeholder="EAAxxxxxxx..."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono"
              />
            </div>
          </div>
        )}

        {local.provider === 'twilio' && (
          <div className="space-y-3">
            <LabeledInput
              label="Twilio Account SID"
              value={local.twilioSid ?? ''}
              onChange={(v) => update({ twilioSid: v })}
              placeholder="ACxxxxxxxx"
            />
            <LabeledInput
              label="Twilio Auth Token"
              value={local.twilioToken ?? ''}
              onChange={(v) => update({ twilioToken: v })}
              placeholder="Auth Token"
              type="password"
            />
            <LabeledInput
              label="WhatsApp-Absendernummer"
              value={local.twilioWhatsappFrom ?? ''}
              onChange={(v) => update({ twilioWhatsappFrom: v })}
              placeholder="+14155238886"
            />
          </div>
        )}
      </Card>

      {/* Ereignisse */}
      <Card className="p-4 space-y-3">
        <h3 className="font-display font-bold text-sm">Aktive Ereignisse</h3>
        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENTS.map((e) => (
            <label key={e.key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={local.enabledEvents.includes(e.key)}
                onChange={() => toggleEvent(e.key)}
                className="h-4 w-4 rounded accent-matcha-700"
              />
              <span className="text-sm">{e.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Template-Namen */}
      <Card className="p-4">
        <button
          onClick={() => setTemplateOpen((v) => !v)}
          className="w-full flex items-center justify-between text-sm font-display font-bold"
        >
          <span>Template-Namen (Meta Business Manager)</span>
          {templateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {templateOpen && (
          <div className="mt-3 space-y-2">
            <LabeledInput label="Fahrer zugewiesen" value={local.templateDriverAssigned}  onChange={(v) => update({ templateDriverAssigned: v })} />
            <LabeledInput label="Fahrer losgefahren" value={local.templateDriverDeparting} onChange={(v) => update({ templateDriverDeparting: v })} />
            <LabeledInput label="Fahrer gleich da"  value={local.templateDriverNearby}    onChange={(v) => update({ templateDriverNearby: v })} />
            <LabeledInput label="Geliefert"         value={local.templateDelivered}       onChange={(v) => update({ templateDelivered: v })} />
            <LabeledInput label="Storniert"         value={local.templateCancelled}       onChange={(v) => update({ templateCancelled: v })} />
            <LabeledInput label="Verspätet"         value={local.templateDelayed}         onChange={(v) => update({ templateDelayed: v })} />
            <LabeledInput label="Sprach-Code" value={local.languageCode} onChange={(v) => update({ languageCode: v })} placeholder="de" />
          </div>
        )}
      </Card>

      {/* Limits */}
      <Card className="p-4 space-y-3">
        <h3 className="font-display font-bold text-sm">Opt-In & Limits</h3>
        <div className="flex gap-3">
          {(['explicit', 'implicit'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ optinMode: mode })}
              className={cn(
                'flex-1 py-2 rounded-lg border text-sm font-semibold transition',
                local.optinMode === mode
                  ? 'bg-matcha-700 text-white border-matcha-700'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              {mode === 'explicit' ? 'Explizit (Checkbox)' : 'Implizit (Bestätigung)'}
            </button>
          ))}
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1">Tages-Limit pro Nummer (0 = unbegrenzt)</div>
          <input
            type="number"
            min={0}
            max={50}
            value={local.dailyLimitPerNumber}
            onChange={(e) => update({ dailyLimitPerNumber: Number(e.target.value) })}
            className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background"
          />
        </div>
      </Card>

      <Button
        onClick={() => void onSave(local)}
        disabled={saving}
        className="w-full"
      >
        {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
        Konfiguration speichern
      </Button>
    </div>
  );
}

// ── Hilfselemente ─────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: 'green' | 'red' | 'amber';
}) {
  const textColor = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-foreground';
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-matcha-700">{icon}</span>
        {label}
      </div>
      <div className={cn('mt-1.5 font-display text-2xl font-bold', textColor)}>{value}</div>
    </Card>
  );
}

function LabeledInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
      />
    </div>
  );
}
