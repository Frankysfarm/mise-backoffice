'use client';

/**
 * DriverReliabilityPanel — Fahrer-Zuverlässigkeits-Leaderboard für den Dispatch.
 * Zeigt Score (0–100), Tier, No-Shows, Verspätungen und Perfekt-Schichten.
 * Daten: /api/delivery/admin/driver-reliability
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, AlertTriangle, Star, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

type ReliabilityTier = 'excellent' | 'good' | 'medium' | 'critical';

type DriverEntry = {
  driver_id: string;
  driver_name: string | null;
  driver_vehicle: string | null;
  score: number;
  total_shifts: number;
  no_shows: number;
  late_starts: number;
  early_ends: number;
  perfect_shifts: number;
  reliability_tier: ReliabilityTier | null;
};

type ReliabilityStats = {
  avg_score: number;
  drivers_tracked: number;
  no_shows_this_month: number;
  perfect_shifts_this_month: number;
  critical_drivers_count: number;
};

const TIER_CONFIG: Record<ReliabilityTier, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  excellent: { label: 'Exzellent', color: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', icon: ShieldCheck },
  good:      { label: 'Gut',       color: 'text-matcha-600', bg: 'bg-matcha-50 border-matcha-100', icon: ShieldCheck },
  medium:    { label: 'Mittel',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: AlertTriangle },
  critical:  { label: 'Kritisch', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',        icon: ShieldAlert },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-matcha-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
      <span className={cn('text-[11px] font-black tabular-nums shrink-0',
        score >= 80 ? 'text-matcha-700' : score >= 60 ? 'text-amber-700' : 'text-red-700',
      )}>
        {score}
      </span>
    </div>
  );
}

export function DriverReliabilityPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DriverEntry[]>([]);
  const [stats, setStats] = useState<ReliabilityStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/driver-reliability?location_id=${locationId}&limit=15`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.leaderboard) setEntries(d.leaderboard);
        if (d?.stats) setStats(d.stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, locationId]);

  const hasCritical = stats && stats.critical_drivers_count > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
            Fahrer-Zuverlässigkeit
          </span>
          {stats && (
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              hasCritical ? 'bg-red-50 border-red-200 text-red-700' : 'bg-matcha-50 border-matcha-200 text-matcha-700',
            )}>
              Ø {Math.round(stats.avg_score)} · {stats.drivers_tracked} Fahrer
              {hasCritical ? ` · ${stats.critical_drivers_count} kritisch` : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Zuverlässigkeitsdaten…
            </div>
          )}

          {!loading && stats && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Ø Score', value: Math.round(stats.avg_score), color: stats.avg_score >= 75 ? 'text-matcha-700' : 'text-amber-700' },
                { label: 'Kritische', value: stats.critical_drivers_count, color: stats.critical_drivers_count > 0 ? 'text-red-600' : 'text-matcha-600' },
                { label: 'No-Shows/Mo.', value: stats.no_shows_this_month, color: stats.no_shows_this_month > 0 ? 'text-amber-600' : 'text-matcha-600' },
                { label: 'Perfekte/Mo.', value: stats.perfect_shifts_this_month, color: 'text-matcha-600' },
              ].map((k) => (
                <div key={k.label} className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-2 text-center">
                  <div className={`font-black text-base leading-none ${k.color}`}>{k.value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-1.5">
              {entries.map((e) => {
                const tier = e.reliability_tier ?? 'medium';
                const cfg = TIER_CONFIG[tier];
                const Icon = cfg.icon;
                return (
                  <div key={e.driver_id} className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2',
                    cfg.bg,
                  )}>
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-gray-800 truncate">
                          {e.driver_name ?? 'Unbekannt'}
                        </span>
                        <span className={cn('text-[9px] font-bold', cfg.color)}>{cfg.label}</span>
                      </div>
                      <ScoreBar score={e.score} />
                    </div>
                    <div className="flex gap-2.5 shrink-0 text-[10px] text-gray-500">
                      {e.no_shows > 0 && (
                        <span className="text-red-500 font-bold">{e.no_shows}× fehlt</span>
                      )}
                      {e.late_starts > 0 && (
                        <span className="text-amber-600 font-bold">{e.late_starts}× spät</span>
                      )}
                      {e.perfect_shifts > 0 && (
                        <span className="text-matcha-600 font-bold flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" />{e.perfect_shifts}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-3">Noch keine Zuverlässigkeitsdaten</div>
          )}
        </div>
      )}
    </div>
  );
}
