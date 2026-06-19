'use client';

/**
 * AssignmentOptimizerClient — Echtzeit-Zuweisung-Optimizer
 *
 * Zeigt:
 *  - 4 KPI-Karten: Offene Vorschläge / Sofort-Verfügbar / Bald-zurück / Ø Score
 *  - Vorschlagsliste: Score-Balken, Typ-Badge, Fahrer-Info, Return-Prognose-Badge
 *  - Annehmen / Verwerfen Buttons
 *  - "Neu generieren" Button
 *  - 30s Auto-Refresh
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Zap, Clock, RotateCcw, CheckCircle2, XCircle, RefreshCw,
  Bike, Car, ArrowRight, Loader2, TrendingUp, AlertTriangle,
  UserCheck, Timer,
} from 'lucide-react';
import type { AssignmentSuggestion, OptimizerDashboard } from '@/lib/delivery/assignment-optimizer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'text-matcha-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-matcha-500';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function typeLabel(type: string): { label: string; color: string; Icon: React.FC<{ className?: string }> } {
  switch (type) {
    case 'immediate': return { label: 'Sofort', color: 'bg-matcha-100 text-matcha-800', Icon: Zap };
    case 'pre_assign': return { label: 'Bald frei', color: 'bg-blue-100 text-blue-800', Icon: Clock };
    default:           return { label: 'Reserve', color: 'bg-gray-100 text-gray-600', Icon: Timer };
  }
}

function stateLabel(state: string | null | undefined): string {
  switch (state) {
    case 'idle':          return 'Verfügbar';
    case 'returning':     return 'Rückkehr';
    case 'en_route':      return 'Unterwegs';
    case 'at_restaurant': return 'Im Restaurant';
    case 'assigned':      return 'Zugewiesen';
    default:              return state ?? '–';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  return `vor ${Math.floor(m / 60)} Std`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-matcha-400 bg-matcha-50' : 'border-gray-100 bg-white'} shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-matcha-500">{icon}</span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${highlight ? 'text-matcha-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Suggestion Card ───────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  onAccept,
  onDismiss,
  busy,
}: {
  s: AssignmentSuggestion;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  busy: boolean;
}) {
  const { label, color, Icon } = typeLabel(s.suggestionType);
  const expiresIn = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 60000));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
            <Icon className="w-3 h-3" />
            {label}
          </span>
          <span className="text-[11px] text-gray-500 truncate">
            #{s.bestellnummer ?? s.orderId.slice(0, 8)}
          </span>
          {s.priority === 'high' && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">PRIO</span>
          )}
        </div>
        {/* Score */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBg(s.score)}`} style={{ width: `${s.score}%` }} />
          </div>
          <span className={`text-xs font-black tabular-nums ${scoreColor(s.score)}`}>{Math.round(s.score)}</span>
        </div>
      </div>

      {/* Driver + order info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Driver */}
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 mb-1 font-medium">FAHRER</p>
          <div className="flex items-center gap-1.5">
            {s.vehicle === 'car'
              ? <Car className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              : <Bike className="w-3.5 h-3.5 text-matcha-500 shrink-0" />}
            <span className="text-[12px] font-semibold text-gray-800 truncate">
              {s.driverName ?? 'Fahrer'}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">{stateLabel(s.driverState)}</p>
          {s.minutesUntilReturn != null && (
            <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
              Rückkehr in {s.minutesUntilReturn} Min
            </p>
          )}
        </div>

        {/* Order */}
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 mb-1 font-medium">BESTELLUNG</p>
          <p className="text-[12px] font-semibold text-gray-800 truncate">
            {s.kundeAdresse ?? '–'}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {s.gesamtbetrag != null ? `${s.gesamtbetrag.toFixed(2)} €` : '–'}
          </p>
          {s.distanceKm != null && (
            <p className="text-[10px] text-gray-500">{s.distanceKm.toFixed(1)} km</p>
          )}
        </div>
      </div>

      {/* Reason */}
      <p className="text-[11px] text-gray-500 mb-3">{s.reason}</p>

      {/* Return prediction badge */}
      {s.returnConfidence != null && (
        <div className="flex items-center gap-1 mb-3">
          <TrendingUp className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] text-blue-600">
            Konfidenz {Math.round(s.returnConfidence * 100)}%
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          Läuft ab in {expiresIn} Min
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDismiss(s.id)}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" /> Verwerfen
          </button>
          <button
            onClick={() => onAccept(s.id)}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-matcha-500 text-white text-[11px] font-semibold hover:bg-matcha-600 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3" /> Annehmen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AssignmentOptimizerClient({
  initialDashboard,
}: {
  initialDashboard: OptimizerDashboard | null;
}) {
  const [dashboard, setDashboard] = useState<OptimizerDashboard | null>(initialDashboard);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/assignment-optimizer', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OptimizerDashboard = await res.json();
      setDashboard(data);
      setLastRefresh(new Date());
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      await fetch('/api/delivery/admin/assignment-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      await fetchDashboard();
    } finally {
      setGenerating(false);
    }
  }, [fetchDashboard]);

  const handleAccept = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await fetch('/api/delivery/admin/assignment-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', id }),
      });
      await fetchDashboard();
    } finally {
      setBusyId(null);
    }
  }, [fetchDashboard]);

  const handleDismiss = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await fetch('/api/delivery/admin/assignment-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', id }),
      });
      await fetchDashboard();
    } finally {
      setBusyId(null);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = dashboard?.summary;
  const suggestions = dashboard?.suggestions ?? [];
  const stats = dashboard?.stats;

  const immediate = suggestions.filter((s) => s.suggestionType === 'immediate');
  const preAssign  = suggestions.filter((s) => s.suggestionType === 'pre_assign');
  const standby    = suggestions.filter((s) => s.suggestionType === 'standby');

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-matcha-500 text-white text-[12px] font-semibold rounded-lg hover:bg-matcha-600 disabled:opacity-50"
        >
          {generating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RotateCcw className="w-3.5 h-3.5" />}
          Neu generieren
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<AlertTriangle size={16} />}
          label="Offene Vorschläge"
          value={sum?.pendingCount ?? 0}
          sub={`${stats?.unassignedOrders ?? 0} Bestellungen unzugewiesen`}
          highlight={(sum?.pendingCount ?? 0) > 0}
        />
        <KpiCard
          icon={<Zap size={16} />}
          label="Sofort verfügbar"
          value={sum?.immediateCount ?? 0}
          sub="Fahrer direkt einsatzbereit"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Bald frei"
          value={sum?.preAssignCount ?? 0}
          sub={`${stats?.returningDrivers ?? 0} kehren zurück (<20 Min)`}
        />
        <KpiCard
          icon={<UserCheck size={16} />}
          label="Ø Score (akzeptiert)"
          value={sum?.avgAcceptedScore != null ? `${sum.avgAcceptedScore}` : '–'}
          sub={`${sum?.acceptedCount ?? 0} akzeptiert heute`}
        />
      </div>

      {/* Stats banner */}
      {stats && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-6 text-[12px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-matcha-500 animate-pulse" />
            <span className="text-gray-600">{stats.availableDrivers} Fahrer verfügbar</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-600">{stats.unassignedOrders} Bestellungen warten auf Zuweisung</span>
          {sum?.lastGeneratedAt && (
            <>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              <span className="text-gray-400">Zuletzt generiert: {timeAgo(sum.lastGeneratedAt)}</span>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {suggestions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine aktiven Vorschläge</p>
          <p className="text-xs mt-1">Klicke "Neu generieren" um Vorschläge zu erstellen</p>
        </div>
      )}

      {/* Immediate section */}
      {immediate.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-matcha-500" />
            Sofort zuweisen ({immediate.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {immediate.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                busy={busyId === s.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pre-assign section */}
      {preAssign.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Vorab zuweisen — Fahrer kehren bald zurück ({preAssign.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {preAssign.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                busy={busyId === s.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standby section */}
      {standby.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Timer className="w-4 h-4 text-gray-400" />
            Reserve ({standby.length})
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {standby.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                busy={busyId === s.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
