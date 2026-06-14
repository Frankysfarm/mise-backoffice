'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Send, Plus, Clock, Users, TrendingUp, Bell, CheckCircle,
  XCircle, Calendar, Zap, BarChart2, RefreshCw, Trash2, Play,
} from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────────

type CampaignChannel  = 'vapid' | 'whatsapp' | 'driver' | 'all';
type CampaignAudience = 'all' | 'active_7d' | 'active_30d' | 'inactive_30d' | 'inactive_90d';
type CampaignStatus   = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';

interface PushCampaign {
  id:               string;
  name:             string;
  channel:          CampaignChannel;
  title:            string;
  body:             string;
  url:              string | null;
  audience:         CampaignAudience;
  status:           CampaignStatus;
  scheduledAt:      string | null;
  useBestTime:      boolean;
  recipientsTotal:  number;
  recipientsSent:   number;
  recipientsFailed: number;
  startedAt:        string | null;
  completedAt:      string | null;
  createdAt:        string;
}

interface CampaignPerformance extends PushCampaign {
  sendRatePct:     number | null;
  deliveredCount:  number;
  deliveryRatePct: number | null;
  durationSec:     number | null;
}

interface BestSendHour {
  hourUtc:         number;
  totalSent:       number;
  deliveryRatePct: number | null;
  sendScore:       number;
}

interface Dashboard {
  totalCampaigns:    number;
  scheduledCount:    number;
  completedCount:    number;
  totalRecipients:   number;
  avgSendRatePct:    number | null;
  bestHourUtc:       number | null;
  recentCampaigns:   CampaignPerformance[];
  upcomingCampaigns: PushCampaign[];
  bestSendHours:     BestSendHour[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  vapid:     'Browser-Push',
  whatsapp:  'WhatsApp',
  driver:    'Fahrer-App',
  all:       'Alle Kanäle',
};

const AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  all:          'Alle Abonnenten',
  active_7d:    'Aktiv letzte 7T',
  active_30d:   'Aktiv letzte 30T',
  inactive_30d: 'Inaktiv 30-90T',
  inactive_90d: 'Inaktiv > 90T',
};

const STATUS_BADGE: Record<CampaignStatus, { label: string; cls: string }> = {
  draft:     { label: 'Entwurf',    cls: 'bg-stone-100 text-stone-600' },
  scheduled: { label: 'Geplant',    cls: 'bg-blue-100 text-blue-700' },
  running:   { label: 'Läuft…',     cls: 'bg-amber-100 text-amber-700 animate-pulse' },
  completed: { label: 'Abgeschl.',  cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Abgebrochen',cls: 'bg-stone-100 text-stone-400' },
  failed:    { label: 'Fehlgeschl.',cls: 'bg-red-100 text-red-700' },
};

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00 UTC`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ── Erstell-Modal ──────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name,        setName]        = useState('');
  const [channel,     setChannel]     = useState<CampaignChannel>('vapid');
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [url,         setUrl]         = useState('');
  const [audience,    setAudience]    = useState<CampaignAudience>('all');
  const [scheduledAt, setScheduledAt] = useState('');
  const [useBestTime, setUseBestTime] = useState(false);
  const [winStart,    setWinStart]    = useState(8);
  const [winEnd,      setWinEnd]      = useState(21);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function submit() {
    if (!name.trim() || !title.trim() || !body.trim()) {
      setError('Name, Titel und Text sind Pflichtfelder');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/push-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name, channel, title, body, url: url || undefined, audience,
          scheduled_at:          scheduledAt || undefined,
          use_best_time:         useBestTime,
          best_time_window_start: winStart,
          best_time_window_end:   winEnd,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Fehler');
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-violet-600" />
          Neue Kampagne erstellen
        </h2>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Kampagnen-Name *</span>
            <input
              className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. Sommer-Angebot 2026"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Kanal</span>
              <select
                className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                value={channel} onChange={e => setChannel(e.target.value as CampaignChannel)}
              >
                {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">Zielgruppe</span>
              <select
                className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                value={audience} onChange={e => setAudience(e.target.value as CampaignAudience)}
              >
                {Object.entries(AUDIENCE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Push-Titel *</span>
            <input
              className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="z.B. 🍕 Heute 20% auf alle Pizzen!"
              maxLength={60}
            />
            <span className="text-xs text-stone-400">{title.length}/60</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Nachrichtentext *</span>
            <textarea
              className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Jetzt bestellen und 20% sparen. Nur heute!"
              maxLength={140}
            />
            <span className="text-xs text-stone-400">{body.length}/140</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Link (optional)</span>
            <input
              className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Sendezeit (leer = Entwurf)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
              value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
            />
          </label>

          <div className="border border-stone-100 rounded-xl p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useBestTime}
                onChange={e => setUseBestTime(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-stone-700">
                Best-Time-to-Send aktivieren
              </span>
              <Zap className="w-4 h-4 text-amber-500" />
            </label>

            {useBestTime && (
              <div className="flex items-center gap-2 text-sm text-stone-600 ml-6">
                <span>Fenster:</span>
                <input
                  type="number" min={0} max={23}
                  className="w-16 border border-stone-200 rounded px-2 py-1 text-center"
                  value={winStart} onChange={e => setWinStart(Number(e.target.value))}
                />
                <span>bis</span>
                <input
                  type="number" min={0} max={24}
                  className="w-16 border border-stone-200 rounded px-2 py-1 text-center"
                  value={winEnd} onChange={e => setWinEnd(Number(e.target.value))}
                />
                <span className="text-xs text-stone-400">UTC-Stunden</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-stone-200 rounded-xl py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? 'Erstelle…' : 'Kampagne erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export function PushCampaignsClient() {
  const [dashboard,   setDashboard]   = useState<Dashboard | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [activeTab,   setActiveTab]   = useState<'overview' | 'campaigns' | 'hours'>('overview');
  const [executing,   setExecuting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/push-campaigns');
      if (res.ok) setDashboard(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function execute(campaignId: string) {
    setExecuting(campaignId);
    try {
      await fetch('/api/delivery/admin/push-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', campaign_id: campaignId }),
      });
      await load();
    } finally {
      setExecuting(null);
    }
  }

  async function cancel(campaignId: string) {
    await fetch('/api/delivery/admin/push-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', campaign_id: campaignId }),
    });
    await load();
  }

  async function remove(campaignId: string) {
    await fetch('/api/delivery/admin/push-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', campaign_id: campaignId }),
    });
    await load();
  }

  const d = dashboard;

  return (
    <div className="min-h-screen bg-stone-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-600" />
            Push-Kampagnen
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Geplante Benachrichtigungen · Best-Time-to-Send
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50">
            <RefreshCw className={`w-4 h-4 text-stone-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700"
          >
            <Plus className="w-4 h-4" />
            Neue Kampagne
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { icon: Bell,       color: 'violet', label: 'Kampagnen',     val: d?.totalCampaigns ?? '—' },
          { icon: Calendar,   color: 'blue',   label: 'Geplant',       val: d?.scheduledCount ?? '—' },
          { icon: CheckCircle,color: 'green',  label: 'Abgeschlossen', val: d?.completedCount ?? '—' },
          { icon: Users,      color: 'amber',  label: 'Empfänger (Ges.)', val: d?.totalRecipients ?? '—' },
          { icon: Send,       color: 'teal',   label: 'Ø Senderate',   val: d?.avgSendRatePct != null ? `${d.avgSendRatePct}%` : '—' },
          { icon: Clock,      color: 'orange', label: 'Beste Stunde',  val: d?.bestHourUtc != null ? fmtHour(d.bestHourUtc) : '—' },
        ].map(({ icon: Icon, color, label, val }) => (
          <div key={label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
            <div className={`w-8 h-8 rounded-xl bg-${color}-100 flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 text-${color}-600`} />
            </div>
            <div className="text-xl font-bold text-stone-900">{val}</div>
            <div className="text-xs text-stone-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-stone-100 rounded-xl p-1 w-fit">
        {([
          ['overview',   'Übersicht'],
          ['campaigns',  'Alle Kampagnen'],
          ['hours',      'Beste Sendezeiten'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Übersicht ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Geplante Kampagnen */}
          {d && d.upcomingCampaigns.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Nächste geplante Kampagnen ({d.scheduledCount})
              </h3>
              <div className="space-y-2">
                {d.upcomingCampaigns.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-blue-100">
                    <div>
                      <div className="font-medium text-sm text-stone-900">{c.name}</div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {CHANNEL_LABEL[c.channel]} · {AUDIENCE_LABEL[c.audience]} ·{' '}
                        {fmtDate(c.scheduledAt)}
                        {c.useBestTime && <span className="ml-1 text-amber-600">⚡ Best-Time</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => execute(c.id)}
                      disabled={executing === c.id}
                      className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      {executing === c.id ? 'Sende…' : 'Jetzt senden'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Letzte abgeschlossene */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
            <h3 className="font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-stone-500" />
              Letzte abgeschlossene Kampagnen
            </h3>
            {!d || d.recentCampaigns.length === 0 ? (
              <div className="text-sm text-stone-400 text-center py-8">
                Noch keine abgeschlossenen Kampagnen
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 border-b border-stone-50">
                      <th className="text-left pb-2 font-medium">Name</th>
                      <th className="text-left pb-2 font-medium">Kanal</th>
                      <th className="text-right pb-2 font-medium">Empfänger</th>
                      <th className="text-right pb-2 font-medium">Gesendet</th>
                      <th className="text-right pb-2 font-medium">Senderate</th>
                      <th className="text-left pb-2 font-medium pl-3">Abgeschlossen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {d.recentCampaigns.map(c => (
                      <tr key={c.id} className="text-stone-700">
                        <td className="py-2.5 font-medium text-stone-900">{c.name}</td>
                        <td className="py-2.5">
                          <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full text-xs">
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{c.recipientsTotal}</td>
                        <td className="py-2.5 text-right tabular-nums text-green-700">{c.recipientsSent}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {c.sendRatePct != null ? (
                            <span className={c.sendRatePct >= 80 ? 'text-green-700' : c.sendRatePct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                              {c.sendRatePct}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 text-stone-400 text-xs pl-3">{fmtDate(c.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Alle Kampagnen ── */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
          <div className="space-y-3">
            {!d || (d.recentCampaigns.length === 0 && d.upcomingCampaigns.length === 0) ? (
              <div className="text-sm text-stone-400 text-center py-12">
                <Bell className="w-8 h-8 text-stone-200 mx-auto mb-3" />
                Noch keine Kampagnen. Erstelle deine erste Kampagne!
              </div>
            ) : (
              [...(d?.upcomingCampaigns ?? []), ...(d?.recentCampaigns ?? [])].map(c => {
                const badge = STATUS_BADGE[c.status];
                return (
                  <div key={c.id} className="flex items-start justify-between border border-stone-100 rounded-xl p-4 hover:bg-stone-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-stone-900">{c.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {c.useBestTime && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            ⚡ Best-Time
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-stone-600 mt-1 truncate">
                        <span className="font-medium">{c.title}</span>
                        {c.body && <span className="text-stone-400"> — {c.body}</span>}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                        <span>{CHANNEL_LABEL[c.channel]}</span>
                        <span>{AUDIENCE_LABEL[c.audience]}</span>
                        {c.scheduledAt && <span>📅 {fmtDate(c.scheduledAt)}</span>}
                        {c.recipientsTotal > 0 && (
                          <span className="text-green-600">
                            {c.recipientsSent}/{c.recipientsTotal} gesendet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <>
                          <button
                            onClick={() => execute(c.id)}
                            disabled={executing === c.id}
                            className="flex items-center gap-1 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                          >
                            <Play className="w-3 h-3" />
                            {executing === c.id ? '…' : 'Senden'}
                          </button>
                          <button
                            onClick={() => cancel(c.id)}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(c.status === 'completed' || c.status === 'cancelled' || c.status === 'failed') && (
                        <button
                          onClick={() => remove(c.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Beste Sendezeiten ── */}
      {activeTab === 'hours' && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-stone-900">
              Best-Time-to-Send — Historische Öffnungsraten (letzte 30T)
            </h3>
          </div>

          {!d || d.bestSendHours.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-8">
              Nicht genug Daten. Sende mindestens 50 WhatsApp-Nachrichten für eine Analyse.
            </div>
          ) : (
            <div className="space-y-2">
              {d.bestSendHours.map((h, i) => {
                const maxScore = d.bestSendHours[0]?.sendScore ?? 1;
                const pct = maxScore > 0 ? (h.sendScore / maxScore) * 100 : 0;
                const isTop = i === 0;
                return (
                  <div key={h.hourUtc} className={`flex items-center gap-3 p-3 rounded-xl ${isTop ? 'bg-violet-50 border border-violet-100' : 'bg-stone-50'}`}>
                    <div className={`w-16 text-sm font-mono font-bold ${isTop ? 'text-violet-700' : 'text-stone-600'}`}>
                      {fmtHour(h.hourUtc)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isTop ? 'bg-violet-500' : 'bg-stone-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-stone-500 w-12 text-right tabular-nums">
                          {h.deliveryRatePct != null ? `${h.deliveryRatePct}%` : '—'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-400">
                        {h.totalSent} gesendet · Score {h.sendScore}
                      </div>
                    </div>
                    {isTop && (
                      <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">
                        Optimal
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
            <strong>Best-Time-to-Send:</strong> Der Score kombiniert Versandvolumen × Lieferrate.
            Stunden mit hohem Volumen <em>und</em> hoher Lieferrate sind optimal für Kampagnen.
          </div>
        </div>
      )}

      {/* Erstell-Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
