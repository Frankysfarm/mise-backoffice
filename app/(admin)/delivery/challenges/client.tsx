'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Trash2, RefreshCw, Trophy, Target, Star,
  Euro, Clock, Users, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriverChallenge, ChallengeParticipation, ChallengeDetail } from '@/lib/delivery/challenges';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

interface ChallengesResponse {
  challenges: DriverChallenge[];
}

type ChallengeTypeOption = {
  value: string;
  label: string;
  unit: string;
  placeholder: string;
};

const CHALLENGE_TYPES: ChallengeTypeOption[] = [
  { value: 'deliveries_count', label: 'Lieferungen',    unit: 'Stück',   placeholder: 'z.B. 8' },
  { value: 'on_time_rate',     label: 'Pünktlichkeit',  unit: '%',        placeholder: 'z.B. 90' },
  { value: 'avg_rating',       label: 'Ø Sterne',       unit: '★',        placeholder: 'z.B. 4.5' },
  { value: 'revenue_total',    label: 'Umsatz (€)',      unit: '€',        placeholder: 'z.B. 200' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '–';
  return `€${v.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function minutesLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 48) return `${Math.ceil(h / 24)} Tage`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'draft':     return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'cancelled': return 'bg-zinc-100 text-zinc-500 border-zinc-200';
    default:          return 'bg-zinc-100 text-zinc-500 border-zinc-200';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':    return 'Aktiv';
    case 'draft':     return 'Entwurf';
    case 'completed': return 'Abgeschlossen';
    case 'cancelled': return 'Storniert';
    default:          return status;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'deliveries_count': return <Zap className="h-4 w-4" />;
    case 'on_time_rate':     return <Clock className="h-4 w-4" />;
    case 'avg_rating':       return <Star className="h-4 w-4" />;
    case 'revenue_total':    return <Euro className="h-4 w-4" />;
    default:                 return <Target className="h-4 w-4" />;
  }
}

function typeLabel(type: string): string {
  return CHALLENGE_TYPES.find(t => t.value === type)?.label ?? type;
}

function typeUnit(type: string): string {
  return CHALLENGE_TYPES.find(t => t.value === type)?.unit ?? '';
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
  color?: 'green' | 'blue' | 'amber' | 'purple' | 'default';
}) {
  const colorMap = {
    green:   'border-emerald-200 bg-emerald-50',
    blue:    'border-blue-200 bg-blue-50',
    amber:   'border-amber-200 bg-amber-50',
    purple:  'border-purple-200 bg-purple-50',
    default: 'border-zinc-200 bg-white',
  };
  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', colorMap[color ?? 'default'])}>
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
// ChallengeCard
// ─────────────────────────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  onDelete,
  locationId,
}: {
  challenge: DriverChallenge;
  onDelete: (id: string) => void;
  locationId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (detail) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/challenges?id=${challenge.id}`,
        { cache: 'no-store' },
      );
      if (res.ok) setDetail(await res.json() as ChallengeDetail);
    } finally {
      setLoading(false);
    }
  }, [challenge.id, detail]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadDetail();
  };

  const pct = detail?.participations.length
    ? Math.round(
        (detail.participations.filter(p => p.completed).length /
          detail.participations.length) * 100,
      )
    : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 rounded-lg bg-zinc-100 p-2 text-zinc-600">
          {typeIcon(challenge.challengeType)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-zinc-900 truncate">{challenge.title}</span>
            <span className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              statusColor(challenge.status),
            )}>
              {statusLabel(challenge.status)}
            </span>
          </div>
          {challenge.description && (
            <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">{challenge.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Ziel: {challenge.targetValue} {typeUnit(challenge.challengeType)}
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3" />
              Prämie: {fmtEur(challenge.rewardEur)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {challenge.status === 'active' ? minutesLeft(challenge.endsAt) : fmtDate(challenge.endsAt)}
            </span>
            {challenge.maxWinners != null && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                {challenge.winnerCount}/{challenge.maxWinners} Gewinner
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {challenge.status !== 'cancelled' && challenge.status !== 'completed' && (
            <button
              onClick={() => {
                if (confirm(`Challenge "${challenge.title}" stornieren?`)) onDelete(challenge.id);
              }}
              className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Stornieren"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            title="Leaderboard"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <RefreshCw className="h-3 w-3 animate-spin" /> Lade Leaderboard …
            </div>
          ) : !detail || detail.participations.length === 0 ? (
            <p className="text-xs text-zinc-400">Noch keine Teilnehmer.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {detail.participations.length} Teilnehmer ·{' '}
                  {detail.participations.filter(p => p.completed).length} abgeschlossen ({pct}%)
                </span>
              </div>
              <div className="space-y-2">
                {detail.participations.slice(0, 10).map((p, i) => (
                  <LeaderboardRow
                    key={p.driverId}
                    participation={p}
                    index={i}
                    challenge={detail.challenge}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({
  participation: p, index, challenge,
}: {
  participation: ChallengeParticipation;
  index: number;
  challenge: DriverChallenge;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  const rankEmoji = index < 3 ? medals[index] : `#${index + 1}`;
  const pct = Math.min(100, Math.round((p.currentValue / challenge.targetValue) * 100));

  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center text-sm">{rankEmoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium text-zinc-700 truncate">{p.driverName}</span>
          <span className="text-xs text-zinc-500 shrink-0 ml-2">
            {p.currentValue} / {challenge.targetValue} {typeUnit(challenge.challengeType)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              p.completed ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-blue-400',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {p.completed && (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateChallengeForm
// ─────────────────────────────────────────────────────────────────────────────

function CreateChallengeForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title:         '',
    description:   '',
    challengeType: 'deliveries_count',
    targetValue:   '',
    rewardEur:     '',
    rewardNote:    '',
    startsAt:      new Date().toISOString().slice(0, 16),
    endsAt:        new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 16),
    maxWinners:    '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/delivery/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         form.title,
          description:   form.description || undefined,
          challengeType: form.challengeType,
          targetValue:   parseFloat(form.targetValue),
          rewardEur:     parseFloat(form.rewardEur || '0'),
          rewardNote:    form.rewardNote || undefined,
          startsAt:      new Date(form.startsAt).toISOString(),
          endsAt:        new Date(form.endsAt).toISOString(),
          maxWinners:    form.maxWinners ? parseInt(form.maxWinners) : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Fehler');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = CHALLENGE_TYPES.find(t => t.value === form.challengeType)!;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" /> Neue Challenge erstellen
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Titel *</label>
          <input
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="z.B. Frühschicht-Sprint: 8 Lieferungen vor 14 Uhr"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Beschreibung</label>
          <input
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Optionale Details für Fahrer"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Challenge-Typ *</label>
          <select
            value={form.challengeType}
            onChange={e => set('challengeType', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          >
            {CHALLENGE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Zielwert * ({selectedType.unit})
          </label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={form.targetValue}
            onChange={e => set('targetValue', e.target.value)}
            placeholder={selectedType.placeholder}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Prämie (€)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={form.rewardEur}
            onChange={e => set('rewardEur', e.target.value)}
            placeholder="z.B. 10"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Max. Gewinner</label>
          <input
            type="number"
            min="1"
            value={form.maxWinners}
            onChange={e => set('maxWinners', e.target.value)}
            placeholder="Leer = unbegrenzt"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Start *</label>
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={e => set('startsAt', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Ende *</label>
          <input
            required
            type="datetime-local"
            value={form.endsAt}
            onChange={e => set('endsAt', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-600 mb-1">Prämien-Notiz</label>
          <input
            value={form.rewardNote}
            onChange={e => set('rewardNote', e.target.value)}
            placeholder="z.B. Bonus wird mit nächster Abrechnung ausbezahlt"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Challenge erstellen
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChallengesClient — Haupt-Komponente
// ─────────────────────────────────────────────────────────────────────────────

export function ChallengesClient({ locationId }: { locationId: string }) {
  const [challenges, setChallenges] = useState<DriverChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter !== 'all'
        ? `/api/delivery/admin/challenges?status=${statusFilter}`
        : '/api/delivery/admin/challenges';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json() as ChallengesResponse;
        setChallenges(j.challenges);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/delivery/admin/challenges?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleCreated = () => {
    setShowCreate(false);
    load();
  };

  // KPI aggregates
  const active    = challenges.filter(c => c.status === 'active');
  const completed = challenges.filter(c => c.status === 'completed');
  const totalRewards = active.reduce((s, c) => s + c.rewardEur, 0);
  const totalWinners = completed.reduce((s, c) => s + c.winnerCount, 0);

  const FILTERS = [
    { value: 'all',       label: 'Alle' },
    { value: 'active',    label: 'Aktiv' },
    { value: 'draft',     label: 'Entwurf' },
    { value: 'completed', label: 'Abgeschlossen' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Aktive Challenges"
          value={active.length}
          sub="Laufende Ziele"
          color="green"
        />
        <KpiCard
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Abgeschlossen"
          value={completed.length}
          sub="Beendete Challenges"
          color="blue"
        />
        <KpiCard
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Aktive Prämien"
          value={`€${totalRewards.toFixed(0)}`}
          sub="Mögliche Bonus-Summe"
          color="amber"
        />
        <KpiCard
          icon={<Award className="h-3.5 w-3.5" />}
          label="Gewinner gesamt"
          value={totalWinners}
          sub="Aus abgeschlossenen Challenges"
          color="purple"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50 transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Neue Challenge
          </button>
        </div>
      </div>

      {/* Create-Formular */}
      {showCreate && (
        <CreateChallengeForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}

      {/* Challenge-Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Lade …
        </div>
      ) : challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center">
          <Zap className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Keine Challenges gefunden.</p>
          <p className="text-xs text-zinc-400 mt-1">Erstelle eine neue Challenge um Fahrer zu motivieren.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map(ch => (
            <ChallengeCard
              key={ch.id}
              challenge={ch}
              onDelete={handleDelete}
              locationId={locationId}
            />
          ))}
        </div>
      )}

      {/* Hinweis */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-600 mb-1 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Automatische Fortschrittsverfolgung
        </p>
        <p>
          Der Fortschritt aller aktiven Challenges wird alle 5 Minuten neu berechnet (Cron).
          Challenge-Typen: <strong>Lieferungen</strong> (Anzahl abgeschlossener Touren),{' '}
          <strong>Pünktlichkeit</strong> (On-Time-Rate in %), <strong>Ø Sterne</strong>{' '}
          (Kundenbewertungen), <strong>Umsatz</strong> (gelieferter Warenwert in €).
        </p>
      </div>
    </div>
  );
}
