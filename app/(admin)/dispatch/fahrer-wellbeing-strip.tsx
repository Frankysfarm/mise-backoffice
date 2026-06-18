'use client';

/**
 * DispatchFahrerWellbeingStrip — Phase 226 Wellbeing-Index im Dispatch-Board.
 *
 * Zeigt den Burnout-Präventions-Index (0–100) je aktiven Fahrer als kompakten
 * Strip. Dispatcher erkennen sofort wer gefährdet ist, bevor neue Touren
 * zugewiesen werden.
 *
 * Tier-Farbcodierung: thriving=emerald · healthy=blue · stressed=amber · burnout_risk=red
 * Pollt automatisch alle 5 Minuten.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, Heart, Loader2, RefreshCw, ShieldAlert, Sparkles,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type WellbeingTier = 'thriving' | 'healthy' | 'stressed' | 'burnout_risk';

interface WellbeingRow {
  driverId: string;
  driverName: string | null;
  vehicleType: string | null;
  wellbeingScore: number;
  wellbeingTier: WellbeingTier;
  fatigueComponent: number;
  satisfactionComponent: number;
  retentionComponent: number;
  incentiveComponent: number;
  interventionTriggered: boolean;
  interventionType: string | null;
  wellbeingRank: number;
}

interface WellbeingOverview {
  totalDrivers: number;
  avgWellbeingScore: number;
  thrivingCount: number;
  healthyCount: number;
  stressedCount: number;
  burnoutRiskCount: number;
  interventionsToday: number;
}

interface Dashboard {
  overview: WellbeingOverview | null;
  atRisk: WellbeingRow[];
  leaderboard: WellbeingRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER: Record<WellbeingTier, { label: string; bg: string; border: string; text: string }> = {
  thriving:    { label: 'Bestens',        bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700' },
  healthy:     { label: 'Gesund',         bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-700'    },
  stressed:    { label: 'Belastet',       bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700'   },
  burnout_risk:{ label: 'Burnout-Risiko', bg: 'bg-red-50',      border: 'border-red-300',     text: 'text-red-700'     },
};

function score2bar(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-red-500';
}

function DriverWellbeingChip({ row }: { row: WellbeingRow }) {
  const t = TIER[row.wellbeingTier];
  const pulse = row.wellbeingTier === 'burnout_risk' || row.interventionTriggered;

  return (
    <div className={cn(
      'flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 min-w-[130px] flex-shrink-0',
      t.bg, t.border,
      pulse && 'ring-2 ring-red-400/50 ring-offset-1 animate-pulse',
    )}>
      {/* Name + tier */}
      <div className="flex items-center gap-1.5">
        <Heart size={11} className={cn(t.text, 'shrink-0')} />
        <span className="text-[11px] font-bold truncate max-w-[90px]">
          {row.driverName ?? 'Fahrer'}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-end gap-2">
        <span className={cn('text-xl font-black tabular-nums leading-none', t.text)}>
          {Math.round(row.wellbeingScore)}
        </span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', t.text)}>
          {t.label}
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', score2bar(row.wellbeingScore))}
          style={{ width: `${Math.round(row.wellbeingScore)}%` }}
        />
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-stone-400">
        <span>Müdigkeit <strong className="text-stone-600">{Math.round(row.fatigueComponent)}</strong></span>
        <span>Zufr. <strong className="text-stone-600">{Math.round(row.satisfactionComponent)}</strong></span>
        <span>Halt. <strong className="text-stone-600">{Math.round(row.retentionComponent)}</strong></span>
        <span>Bonus <strong className="text-stone-600">{Math.round(row.incentiveComponent)}</strong></span>
      </div>

      {/* Intervention hint */}
      {row.interventionTriggered && row.interventionType && (
        <div className="text-[9px] text-red-600 font-bold leading-snug">
          ⚠ {row.interventionType === 'rest_suggestion' ? 'Pause empfohlen'
             : row.interventionType === 'bonus' ? 'Bonus ausgezahlt'
             : 'Nachricht gesendet'}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DispatchFahrerWellbeingStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (!locationId) return;
    if (showRefresh) setRefreshing(true);
    try {
      const url = `/api/delivery/admin/driver-wellbeing?action=dashboard&location_id=${encodeURIComponent(locationId)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return;
      const json = await r.json() as { ok: boolean; data: Dashboard };
      if (json.ok && json.data) {
        setData(json.data);
        // Auto-expand when drivers are at risk
        const riskCount = json.data.overview?.burnoutRiskCount ?? 0;
        if (riskCount > 0) setOpen(true);
      }
    } catch {
      // Optional feature — ignore silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => load(), 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;
  if (loading) return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-2 text-xs text-stone-400">
      <Loader2 size={13} className="animate-spin" />
      Lade Fahrer-Wellbeing-Index…
    </div>
  );
  if (!data?.overview || data.overview.totalDrivers === 0) return null;

  const ov = data.overview;
  const atRisk = ov.stressedCount + ov.burnoutRiskCount;
  const hasCritical = ov.burnoutRiskCount > 0;

  // All drivers sorted: burnout_risk first → stressed → healthy → thriving
  const allDrivers = [...(data.leaderboard ?? [])].sort((a, b) => {
    const order: WellbeingTier[] = ['burnout_risk', 'stressed', 'healthy', 'thriving'];
    return order.indexOf(a.wellbeingTier) - order.indexOf(b.wellbeingTier);
  });

  return (
    <div className={cn(
      'rounded-2xl border bg-white overflow-hidden transition-colors',
      hasCritical ? 'border-red-300' : atRisk > 0 ? 'border-amber-200' : 'border-stone-200',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
          hasCritical ? 'bg-red-100 text-red-600' : atRisk > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700',
        )}>
          <Sparkles size={14} className={hasCritical ? 'animate-pulse' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-char">
            Fahrer-Wellbeing-Index
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            {ov.totalDrivers} Fahrer · Ø {Math.round(ov.avgWellbeingScore)} Punkte
            {ov.thrivingCount > 0 && (
              <span className="ml-2 text-emerald-600 font-bold">{ov.thrivingCount} bestens</span>
            )}
            {atRisk > 0 && (
              <span className={cn('ml-2 font-bold', hasCritical ? 'text-red-600' : 'text-amber-600')}>
                · {atRisk} gefährdet{hasCritical ? ` (${ov.burnoutRiskCount} Burnout-Risiko!)` : ''}
              </span>
            )}
            {ov.interventionsToday > 0 && (
              <span className="ml-2 text-blue-600 font-bold">· {ov.interventionsToday} Maßnahme{ov.interventionsToday !== 1 ? 'n' : ''} heute</span>
            )}
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasCritical && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {ov.burnoutRiskCount} Risiko
            </span>
          )}
          {ov.stressedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {ov.stressedCount} belastet
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); void load(true); }}
            className="p-1 rounded-lg hover:bg-stone-100 transition"
            aria-label="Aktualisieren"
          >
            <RefreshCw size={12} className={cn('text-stone-400', refreshing && 'animate-spin')} />
          </button>
          {open
            ? <ChevronUp size={13} className="text-stone-400" />
            : <ChevronDown size={13} className="text-stone-300" />}
        </div>
      </button>

      {/* Expanded driver strip */}
      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-3">
          {/* At-risk banner */}
          {hasCritical && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
              <ShieldAlert size={14} className="text-red-600 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-red-700">
                {ov.burnoutRiskCount} Fahrer mit akutem Burnout-Risiko — Bitte Pause einplanen oder Schicht verkürzen!
              </span>
            </div>
          )}

          {/* Driver chips */}
          {allDrivers.length === 0 ? (
            <div className="text-xs text-stone-400 text-center py-2">Keine Wellbeing-Daten für heute</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allDrivers.map(row => <DriverWellbeingChip key={row.driverId} row={row} />)}
            </div>
          )}

          {/* Distribution */}
          <div className="flex items-center gap-3 text-[10px] text-stone-400 border-t border-stone-100 pt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{ov.thrivingCount} bestens</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{ov.healthyCount} gesund</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{ov.stressedCount} belastet</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>{ov.burnoutRiskCount} Risiko</span>
            </div>
            <span className="ml-auto">Phase 226 · Aktualisiert alle 5 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
