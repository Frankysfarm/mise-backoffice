'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, RefreshCw, Sparkles, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle2, Clock, Euro, Users,
  Star, Truck, ChefHat, BarChart2, CalendarDays, ChevronDown,
  ChevronUp, Mail, Send, Settings, X, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMetrics, DigestAnomaly, DailyDigest, DigestHistoryEntry } from '@/lib/delivery/daily-digest';
import type { DigestEmailConfig } from '@/lib/delivery/digest-mailer';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

interface EmailLogEntry {
  id: string;
  digestDate: string;
  sentAt: string;
  recipientsCount: number;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}

interface DigestResponse {
  digest: DailyDigest | null;
  liveMetrics: { metrics: DailyMetrics; anomalies: DigestAnomaly[] } | null;
  history: DigestHistoryEntry[];
  date: string;
  emailConfig: DigestEmailConfig | null;
  emailLog: EmailLogEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, unit = '', fallback = '–'): string {
  if (v == null) return fallback;
  return `${v}${unit}`;
}

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '–';
  return `€${v.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// KpiCard
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: 'green' | 'red' | 'amber' | 'blue' | 'default';
}) {
  const colorMap = {
    green:   'border-emerald-200 bg-emerald-50',
    red:     'border-red-200 bg-red-50',
    amber:   'border-amber-200 bg-amber-50',
    blue:    'border-blue-200 bg-blue-50',
    default: 'border-zinc-200 bg-white',
  };

  return (
    <div className={cn(
      'rounded-xl border p-4 shadow-sm',
      colorMap[color ?? 'default'],
    )}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-zinc-800">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnomalyChip
// ─────────────────────────────────────────────────────────────────────────────

function AnomalyChip({ a }: { a: DigestAnomaly }) {
  const isCrit = a.severity === 'critical';
  const sign = a.deltaPct >= 0 ? '+' : '';

  return (
    <div className={cn(
      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
      isCrit
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-700',
    )}>
      {a.direction === 'up'
        ? <TrendingUp size={12} className="mt-0.5 shrink-0" />
        : <TrendingDown size={12} className="mt-0.5 shrink-0" />}
      <div>
        <span className="font-semibold">{a.label}: </span>
        {fmt(a.current)} (war {fmt(a.previous)},{' '}
        <span className="font-semibold">{sign}{a.deltaPct}%</span>)
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AiSummaryPanel
// ─────────────────────────────────────────────────────────────────────────────

function AiSummaryPanel({
  locationId,
  date,
  savedSummary,
}: {
  locationId: string;
  date: string;
  savedSummary: string | null;
}) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState(savedSummary ?? '');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const finishedRef = useRef(false);

  const startStream = useCallback(async () => {
    if (streaming) return;
    setText('');
    setError(null);
    setStreaming(true);
    finishedRef.current = false;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/delivery/admin/daily-digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, date, stream: true }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { finishedRef.current = true; break; }
          setText((prev) => prev + payload.replace(/\\n/g, '\n'));
        }
        if (finishedRef.current) break;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setStreaming(false);
    }
  }, [locationId, date, streaming]);

  function renderText(raw: string) {
    return raw.split('\n').map((line, i) => {
      const cleaned = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('##')) {
        return <h3 key={i} className="mt-3 text-sm font-bold text-indigo-800" dangerouslySetInnerHTML={{ __html: cleaned.replace(/^##\s*/, '') }} />;
      }
      if (/^\d+\./.test(line)) {
        return <p key={i} className="mt-2 text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: cleaned }} />;
      }
      if (line.startsWith('-') || line.startsWith('•')) {
        return <p key={i} className="ml-3 mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: '· ' + cleaned.replace(/^[-•]\s*/, '') }} />;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm leading-relaxed text-zinc-700" dangerouslySetInnerHTML={{ __html: cleaned }} />;
    });
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">KI-Zusammenfassung</span>
          {savedSummary && !streaming && text === savedSummary && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600">gespeichert</span>
          )}
        </div>
        <button
          onClick={() => void startStream()}
          disabled={streaming}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            streaming
              ? 'cursor-not-allowed bg-indigo-200 text-indigo-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700',
          )}
        >
          <Sparkles size={12} />
          {streaming ? 'Analysiert…' : text ? 'Neu analysieren' : 'KI analysieren'}
        </button>
      </div>

      {error && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {text ? (
        <div className="max-h-80 overflow-y-auto rounded-lg bg-white p-3 shadow-inner">
          {renderText(text)}
        </div>
      ) : !streaming ? (
        <p className="text-xs text-indigo-400">
          Klicke auf &quot;KI analysieren&quot; für eine automatische Management-Zusammenfassung des Tages.
        </p>
      ) : (
        <div className="flex items-center gap-2 text-xs text-indigo-500">
          <RefreshCw size={12} className="animate-spin" />
          Analyse läuft…
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricsPanel
// ─────────────────────────────────────────────────────────────────────────────

function MetricsPanel({ m }: { m: DailyMetrics }) {
  const onTimeColor =
    m.performance.onTimeRatePct == null ? 'default' :
    m.performance.onTimeRatePct >= 80 ? 'green' :
    m.performance.onTimeRatePct >= 60 ? 'amber' : 'red';

  const cdesColor =
    m.experience.avgCdesScore == null ? 'default' :
    m.experience.avgCdesScore >= 70 ? 'green' :
    m.experience.avgCdesScore >= 50 ? 'amber' : 'red';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <KpiCard
        icon={<ChefHat size={12} />}
        label="Bestellungen"
        value={m.orders.total}
        sub={`${m.orders.delivery} Lieferung · ${m.orders.pickup} Abholung`}
      />
      <KpiCard
        icon={<CheckCircle2 size={12} />}
        label="Abgeschlossen"
        value={m.orders.completed}
        sub={`${m.orders.cancelled} storniert${m.orders.cancellationRatePct != null ? ` (${m.orders.cancellationRatePct}%)` : ''}`}
        color={m.orders.cancellationRatePct != null && m.orders.cancellationRatePct > 10 ? 'amber' : 'default'}
      />
      <KpiCard
        icon={<Euro size={12} />}
        label="Umsatz"
        value={fmtEur(m.revenue.totalEur)}
        sub={`Lieferumsatz: ${fmtEur(m.revenue.deliveryEur)}`}
      />
      <KpiCard
        icon={<Clock size={12} />}
        label="Ø Lieferzeit"
        value={fmt(m.performance.avgDeliveryMin, ' Min')}
        sub={`${m.performance.totalDelivered} Lieferungen`}
      />
      <KpiCard
        icon={<TrendingUp size={12} />}
        label="On-Time-Rate"
        value={fmt(m.performance.onTimeRatePct, '%')}
        sub={`Ø ETA-Abw.: ${fmt(m.performance.avgEtaDeviationMin, ' Min')}`}
        color={onTimeColor}
      />
      <KpiCard
        icon={<Users size={12} />}
        label="Aktive Fahrer"
        value={m.drivers.uniqueActive}
        sub={`${m.drivers.totalShifts} Schichten · Ø ${fmt(m.drivers.avgDeliveriesPerDriver)} Lief./Fahrer`}
      />
      <KpiCard
        icon={<Star size={12} />}
        label="CDES-Score"
        value={fmt(m.experience.avgCdesScore, '/100')}
        sub={`${m.experience.cdesCriticalCount} kritisch`}
        color={cdesColor}
      />
      <KpiCard
        icon={<Truck size={12} />}
        label="Verspätungen"
        value={m.experience.delayCount}
        sub={`${m.experience.delayVouchersIssued} Gutscheine · ${fmt(m.experience.avgSatisfactionRating, '/5')} ⭐ (${m.experience.satisfactionCount})`}
        color={m.experience.delayCount > 5 ? 'amber' : 'default'}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryRow
// ─────────────────────────────────────────────────────────────────────────────

function HistoryRow({ entry, onClick, isActive }: {
  entry: DigestHistoryEntry;
  onClick: () => void;
  isActive: boolean;
}) {
  const m = entry.metrics;
  const onTimeOk = m.performance.onTimeRatePct == null || m.performance.onTimeRatePct >= 75;
  const hasAnomaly = entry.anomalies.length > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-100',
        isActive && 'bg-indigo-50 hover:bg-indigo-100',
      )}
    >
      <div className="flex items-center gap-2">
        {hasAnomaly ? (
          <AlertTriangle size={12} className="text-amber-500" />
        ) : (
          <CheckCircle2 size={12} className="text-emerald-500" />
        )}
        <span className="font-medium text-zinc-700">{fmtDate(entry.digestDate)}</span>
      </div>
      <div className="flex items-center gap-3 text-zinc-500">
        <span>{m.orders.total} Bestellungen</span>
        <span className={cn(!onTimeOk && 'text-amber-600 font-medium')}>
          {fmt(m.performance.onTimeRatePct, '% OT')}
        </span>
        <span>{fmtEur(m.revenue.totalEur)}</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailConfigPanel
// ─────────────────────────────────────────────────────────────────────────────

function EmailConfigPanel({
  locationId,
  config,
  emailLog,
  onSaved,
}: {
  locationId: string;
  config: DigestEmailConfig | null;
  emailLog: EmailLogEntry[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [sendHour, setSendHour] = useState(config?.sendHourUtc ?? 7);
  const [includeAi, setIncludeAi] = useState(config?.includeAiSummary ?? true);
  const [extraEmails, setExtraEmails] = useState<string[]>(config?.extraRecipients ?? []);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Sync wenn config prop sich ändert
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setSendHour(config.sendHourUtc);
      setIncludeAi(config.includeAiSummary);
      setExtraEmails(config.extraRecipients);
    }
  }, [config]);

  async function saveConfig() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/delivery/admin/daily-digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          action: 'save_email_config',
          enabled,
          send_hour_utc: sendHour,
          include_ai_summary: includeAi,
          extra_recipients: extraEmails,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg('Gespeichert ✓');
      onSaved();
    } catch {
      setMsg('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    setSending(true);
    setMsg(null);
    try {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const date = yesterday.toISOString().slice(0, 10);
      const res = await fetch('/api/delivery/admin/daily-digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'send_email', date }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { result?: { recipientsCount: number; status: string } };
      const r = json.result;
      if (r?.status === 'sent') setMsg(`Gesendet an ${r.recipientsCount} Empfänger ✓`);
      else if (r?.status === 'skipped') setMsg('Übersprungen — kein Digest oder keine Empfänger');
      else setMsg('Versand fehlgeschlagen');
      onSaved();
    } catch {
      setMsg('Versandfehler');
    } finally {
      setSending(false);
    }
  }

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e.includes('@') || extraEmails.includes(e)) return;
    setExtraEmails([...extraEmails, e]);
    setNewEmail('');
  }

  function removeEmail(e: string) {
    setExtraEmails(extraEmails.filter((x) => x !== e));
  }

  const lastSent = emailLog[0];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-zinc-800">E-Mail-Versand konfigurieren</span>
          {config?.enabled && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Aktiv · {config.sendHourUtc}:00 UTC
            </span>
          )}
          {lastSent && (
            <span className="text-[10px] text-zinc-400">
              Letzter Versand: {fmtDate(lastSent.digestDate)} —{' '}
              {lastSent.status === 'sent' ? `${lastSent.recipientsCount} Empfänger` : lastSent.status}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 space-y-4">
          {/* Aktivieren */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-700">Täglicher Versand</div>
              <div className="text-xs text-zinc-400">Bericht automatisch per E-Mail versenden</div>
            </div>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                enabled ? 'bg-indigo-600' : 'bg-zinc-300',
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                enabled ? 'translate-x-5' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          {/* Uhrzeit */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-600 w-32 shrink-0">Versandzeit (UTC)</label>
            <select
              value={sendHour}
              onChange={(e) => setSendHour(Number(e.target.value))}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
              ))}
            </select>
          </div>

          {/* KI-Zusammenfassung einschließen */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-700">KI-Zusammenfassung einschließen</div>
              <div className="text-xs text-zinc-400">Claude-Analyse im E-Mail-Body</div>
            </div>
            <button
              onClick={() => setIncludeAi((v) => !v)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                includeAi ? 'bg-indigo-600' : 'bg-zinc-300',
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                includeAi ? 'translate-x-5' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          {/* Zusätzliche Empfänger */}
          <div>
            <div className="text-sm font-medium text-zinc-700 mb-1">Zusätzliche Empfänger</div>
            <div className="text-xs text-zinc-400 mb-2">
              Manager/Admins mit hinterlegter E-Mail erhalten den Bericht automatisch.
              Hier weitere Adressen ergänzen:
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                placeholder="email@beispiel.de"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={addEmail}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
              >
                <Plus size={12} /> Hinzufügen
              </button>
            </div>
            {extraEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extraEmails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] text-indigo-700">
                    {e}
                    <button onClick={() => removeEmail(e)} className="ml-0.5 hover:text-red-600">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {msg && (
            <div className={cn(
              'rounded-lg px-3 py-2 text-xs font-medium',
              msg.includes('✓') || msg.includes('Gesendet')
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}>
              {msg}
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void saveConfig()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Settings size={12} />
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
            <button
              onClick={() => void sendNow()}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <Send size={12} />
              {sending ? 'Sendet…' : 'Jetzt senden (Gestern)'}
            </button>
          </div>

          {/* Versand-Log */}
          {emailLog.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Versand-Log</div>
              <div className="space-y-1">
                {emailLog.slice(0, 7).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 font-bold text-[10px]',
                      entry.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                      entry.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500',
                    )}>
                      {entry.status === 'sent' ? `✓ ${entry.recipientsCount}×` : entry.status}
                    </span>
                    <span>{fmtDate(entry.digestDate)}</span>
                    {entry.error && <span className="text-red-500">{entry.error.slice(0, 50)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DigestClient
// ─────────────────────────────────────────────────────────────────────────────

export function DigestClient({ locationId }: { locationId: string }) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeMetrics: DailyMetrics | null =
    data?.digest?.metrics ?? data?.liveMetrics?.metrics ?? null;

  const activeAnomalies: DigestAnomaly[] =
    data?.digest?.anomalies ?? data?.liveMetrics?.anomalies ?? [];

  const savedSummary: string | null = data?.digest?.aiSummary ?? null;

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/delivery/admin/daily-digest?location_id=${locationId}&date=${d}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as DigestResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ladefehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(date); }, [date, load]);

  const saveDigest = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/delivery/admin/daily-digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, date, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load(date);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [locationId, date, load]);

  return (
    <div className="space-y-5 pb-10">

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" />
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load(date)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
          <button
            onClick={() => void saveDigest()}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Sparkles size={12} />
            {saving ? 'Speichere…' : 'Digest erstellen & speichern'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
          <RefreshCw size={14} className="animate-spin" /> Lade Digest…
        </div>
      )}

      {/* Metrics */}
      {activeMetrics && (
        <>
          <MetricsPanel m={activeMetrics} />

          {/* Anomalien */}
          {activeAnomalies.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                <AlertTriangle size={14} className="text-amber-500" />
                Anomalien vs. Vortag ({activeAnomalies.length})
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {activeAnomalies.map((a) => (
                  <AnomalyChip key={a.field} a={a} />
                ))}
              </div>
            </div>
          )}

          {activeAnomalies.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={14} /> Keine signifikanten Anomalien erkannt.
            </div>
          )}

          {/* AI-Zusammenfassung */}
          <AiSummaryPanel
            locationId={locationId}
            date={date}
            savedSummary={savedSummary}
          />
        </>
      )}

      {/* Digest-Verlauf */}
      {data?.history && data.history.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700"
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-zinc-500" />
              Verlauf ({data.history.length} Tage)
            </div>
            {historyOpen
              ? <ChevronUp size={14} className="text-zinc-400" />
              : <ChevronDown size={14} className="text-zinc-400" />}
          </button>

          {historyOpen && (
            <div className="border-t border-zinc-100 px-2 py-2">
              {data.history.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  isActive={entry.digestDate === date}
                  onClick={() => setDate(entry.digestDate)}
                />
              ))}
            </div>
          )}

          {/* Sparkline KPI-Übersicht (letzte 7 Tage) */}
          {historyOpen && data.history.length > 1 && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <p className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
                <BarChart2 size={11} /> Bestellungen letzte {Math.min(data.history.length, 14)} Tage
              </p>
              <div className="flex h-16 items-end gap-1">
                {[...data.history].reverse().slice(0, 14).map((entry) => {
                  const max = Math.max(...data.history.map((e) => e.metrics.orders.total), 1);
                  const pct = Math.round((entry.metrics.orders.total / max) * 100);
                  const isToday = entry.digestDate === todayStr();
                  return (
                    <div
                      key={entry.digestDate}
                      className="group relative flex flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className={cn(
                          'w-full rounded-t transition-all',
                          isToday ? 'bg-indigo-500' : 'bg-zinc-300 group-hover:bg-zinc-400',
                        )}
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-20 -translate-x-1/2 rounded border border-zinc-200 bg-white p-1 text-center text-[10px] shadow opacity-0 group-hover:opacity-100">
                        <p className="font-medium">{fmtDate(entry.digestDate)}</p>
                        <p>{entry.metrics.orders.total} Bestellungen</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeMetrics == null && !loading && (
        <div className="py-10 text-center text-sm text-zinc-400">
          Kein Digest für {fmtDate(date)} gefunden. Klicke &quot;Digest erstellen&amp; speichern&quot;.
        </div>
      )}

      {/* E-Mail-Versand Konfiguration */}
      <EmailConfigPanel
        locationId={locationId}
        config={data?.emailConfig ?? null}
        emailLog={data?.emailLog ?? []}
        onSaved={() => void load(date)}
      />
    </div>
  );
}
