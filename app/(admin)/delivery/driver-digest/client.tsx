'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Send, Settings, Clock, Star, TrendingUp, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, Users, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface DriverDigestConfig {
  id: string;
  locationId: string;
  enabled: boolean;
  sendHourUtc: number;
  includeRanking: boolean;
  includeNextShift: boolean;
  updatedAt: string;
}

interface DriverDigestLogEntry {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  digestDate: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}

interface DigestResponse {
  config: DriverDigestConfig | null;
  log: DriverDigestLogEntry[];
}

interface SendResult {
  locationId: string;
  date: string;
  driversSent: number;
  driversSkipped: number;
  driversFailed: number;
  totalDrivers: number;
}

// ─── Haupt-Client ─────────────────────────────────────────────────────────────

export function DriverDigestClient({ locationId }: { locationId: string }) {
  const [data, setData]         = useState<DigestResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Lokale Konfig-State für das Formular
  const [enabled, setEnabled]           = useState(false);
  const [sendHour, setSendHour]         = useState(20);
  const [includeRanking, setIncludeRanking]     = useState(true);
  const [includeNextShift, setIncludeNextShift] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/delivery/admin/driver-digest');
      const json = await res.json() as DigestResponse;
      setData(json);
      if (json.config) {
        setEnabled(json.config.enabled);
        setSendHour(json.config.sendHourUtc);
        setIncludeRanking(json.config.includeRanking);
        setIncludeNextShift(json.config.includeNextShift);
      }
    } catch {
      setError('Fehler beim Laden der Konfiguration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveConfig() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/driver-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          enabled,
          sendHourUtc: sendHour,
          includeRanking,
          includeNextShift,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    if (!confirm('Fahrer-Tagesbericht jetzt an alle aktiven Fahrer senden?')) return;
    setSending(true);
    setSendResult(null);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/driver-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_now' }),
      });
      const json = await res.json() as { ok: boolean; result: SendResult };
      if (!json.ok) throw new Error('Versand fehlgeschlagen');
      setSendResult(json.result);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Versand fehlgeschlagen');
    } finally {
      setSending(false);
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
      <RefreshCw className="h-4 w-4 animate-spin" />
      Lade Konfiguration…
    </div>
  );

  const log = data?.log ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = log.filter((e) => e.digestDate === today);
  const sentToday = todayLog.filter((e) => e.status === 'sent').length;
  const failedToday = todayLog.filter((e) => e.status === 'failed').length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {sendResult && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          <div className="font-bold mb-1">✅ Versand abgeschlossen</div>
          <div>Gesendet: {sendResult.driversSent} · Übersprungen: {sendResult.driversSkipped} · Fehler: {sendResult.driversFailed} · Gesamt: {sendResult.totalDrivers} Fahrer</div>
        </div>
      )}

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Mail className="h-4 w-4" />}
          label="Heute gesendet"
          value={String(sentToday)}
          sub={today}
          color="emerald"
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4" />}
          label="Heute fehlgeschlagen"
          value={String(failedToday)}
          sub={failedToday > 0 ? 'Prüfe Log' : 'Kein Fehler'}
          color={failedToday > 0 ? 'red' : 'gray'}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Versand-Uhrzeit"
          value={`${String(sendHour).padStart(2, '0')}:00 UTC`}
          sub={enabled ? 'Aktiv' : 'Deaktiviert'}
          color={enabled ? 'blue' : 'gray'}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Log-Einträge"
          value={String(log.length)}
          sub="letzte 50"
          color="gray"
        />
      </div>

      {/* Konfiguration */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-bold">E-Mail-Konfiguration</h2>
        </div>

        <div className="space-y-4">
          {/* Aktivieren */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <div className="font-medium">Fahrer-Tagesbericht aktivieren</div>
              <div className="text-sm text-muted-foreground">Täglich personalisierte Berichte an alle aktiven Fahrer mit E-Mail</div>
            </div>
            <button
              onClick={() => setEnabled((v) => !v)}
              className="text-matcha-700 hover:text-matcha-900 transition"
            >
              {enabled
                ? <ToggleRight className="h-8 w-8 text-emerald-600" />
                : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
            </button>
          </div>

          {/* Versand-Uhrzeit */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <div className="font-medium">Versand-Uhrzeit (UTC)</div>
              <div className="text-sm text-muted-foreground">Zu welcher Uhrzeit wird der Bericht gesendet?</div>
            </div>
            <select
              value={sendHour}
              onChange={(e) => setSendHour(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm bg-background"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
              ))}
            </select>
          </div>

          {/* Rangliste einschließen */}
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <div className="font-medium flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-amber-500" /> Tages-Rangliste einschließen
              </div>
              <div className="text-sm text-muted-foreground">Zeigt dem Fahrer seinen Ranglistenplatz unter allen Fahrern</div>
            </div>
            <button
              onClick={() => setIncludeRanking((v) => !v)}
              className="transition"
            >
              {includeRanking
                ? <ToggleRight className="h-8 w-8 text-emerald-600" />
                : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
            </button>
          </div>

          {/* Nächste Schicht einschließen */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="font-medium flex items-center gap-1.5">
                <Star className="h-4 w-4 text-blue-500" /> Nächste Schicht einschließen
              </div>
              <div className="text-sm text-muted-foreground">Zeigt dem Fahrer seine nächste geplante Schicht</div>
            </div>
            <button
              onClick={() => setIncludeNextShift((v) => !v)}
              className="transition"
            >
              {includeNextShift
                ? <ToggleRight className="h-8 w-8 text-emerald-600" />
                : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="bg-matcha-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-matcha-800 disabled:opacity-50 transition"
          >
            {saving ? 'Speichert…' : 'Konfiguration speichern'}
          </button>
          <button
            onClick={sendNow}
            disabled={sending}
            className="flex items-center gap-1.5 border border-matcha-700 text-matcha-800 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-matcha-50 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sendet…' : 'Jetzt senden'}
          </button>
        </div>
      </Card>

      {/* E-Mail-Inhalt Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-bold">E-Mail-Inhalt</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { icon: '📊', label: 'Tagesleistung', desc: 'Lieferungen, Verdienst, Ø Lieferzeit, Pünktlichkeit, Rating, Kilometer' },
            { icon: '↑↓', label: 'Wochenvergleich', desc: 'Vergleich zum Ø der letzten 7 Arbeitstage mit Trend-Pfeilen' },
            { icon: '🏆', label: 'Tages-Rangliste', desc: 'Platz unter allen Fahrern nach Lieferanzahl (konfigurierbar)' },
            { icon: '🎯', label: 'Aktive Challenges', desc: 'Fortschrittsbalken für bis zu 3 laufende Incentive-Challenges' },
            { icon: '📅', label: 'Nächste Schicht', desc: 'Datum und Uhrzeit der nächsten geplanten Schicht (konfigurierbar)' },
            { icon: '💡', label: 'Motivations-Nachricht', desc: 'Kontextbasiertes Feedback je nach Tagesleistung' },
          ].map((item) => (
            <div key={item.label} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Versand-Log */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-lg font-bold">Versand-Log</h2>
          </div>
          <button onClick={load} className="text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Noch keine E-Mails gesendet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="pb-2 text-left">Fahrer</th>
                  <th className="pb-2 text-left">Datum</th>
                  <th className="pb-2 text-left">Gesendet um</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Info</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 transition">
                    <td className="py-2.5 pr-3 font-medium">{entry.driverName ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{entry.digestDate}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {new Date(entry.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                      {entry.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Hilfkomponenten ─────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'emerald' | 'red' | 'blue' | 'gray';
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700',
    red:     'text-red-600',
    blue:    'text-blue-600',
    gray:    'text-muted-foreground',
  };
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${colors[color] ?? ''}`}>
        {icon} {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: 'sent' | 'failed' | 'skipped' }) {
  if (status === 'sent') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-3 w-3" /> Gesendet
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle className="h-3 w-3" /> Fehler
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="h-3 w-3" /> Übersprungen
    </span>
  );
}
