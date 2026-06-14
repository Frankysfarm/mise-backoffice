'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ShieldAlert } from 'lucide-react';

type ReliabilityTier = 'excellent' | 'good' | 'medium' | 'critical';

interface ReliabilityScore {
  driver_id: string;
  score: number;
  total_shifts: number;
  no_shows: number;
  late_starts: number;
  early_ends: number;
  perfect_shifts: number;
  no_show_rate: number;
  driver_name: string | null;
  driver_vehicle: string | null;
  reliability_tier: ReliabilityTier | null;
}

interface ReliabilityStats {
  avg_score: number;
  drivers_tracked: number;
  no_shows_this_month: number;
  perfect_shifts_this_month: number;
  reliable_drivers_count: number;
  critical_drivers_count: number;
}

const TIER_CONFIG: Record<ReliabilityTier, { label: string; badge: string }> = {
  excellent: { label: 'Sehr gut', badge: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  good:      { label: 'Gut',      badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  medium:    { label: 'Mittel',   badge: 'bg-amber-50 border-amber-200 text-amber-700' },
  critical:  { label: 'Kritisch', badge: 'bg-red-50 border-red-200 text-red-700' },
};

export function DriverReliabilityClient({ locationId }: { locationId: string }) {
  const [scores, setScores] = useState<ReliabilityScore[]>([]);
  const [stats, setStats] = useState<ReliabilityStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/delivery/admin/driver-reliability?action=leaderboard&location_id=${locationId}&limit=50`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/driver-reliability?action=stats&location_id=${locationId}`).then(r => r.ok ? r.json() : null),
    ]).then(([lb, st]) => {
      if (lb?.scores) setScores(lb.scores as ReliabilityScore[]);
      if (st?.stats) setStats(st.stats as ReliabilityStats);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Score</div>
            <div className="font-display text-2xl font-black">{stats.avg_score.toFixed(0)}</div>
            <div className="text-[11px] text-muted-foreground">{stats.drivers_tracked} Fahrer erfasst</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Zuverlässig</div>
            <div className="font-display text-2xl font-black text-matcha-700">{stats.reliable_drivers_count}</div>
            <div className="text-[11px] text-muted-foreground">{stats.perfect_shifts_this_month} perfekte Schichten (Monat)</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.critical_drivers_count > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Kritisch</div>
            <div className={cn('font-display text-2xl font-black', stats.critical_drivers_count > 0 ? 'text-red-700' : '')}>{stats.critical_drivers_count}</div>
            <div className="text-[11px] text-muted-foreground">{stats.no_shows_this_month} No-Shows (Monat)</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Zuverlässigkeitsdaten…</div>}

      {!loading && scores.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <ShieldAlert className="h-4 w-4" />
          Keine Zuverlässigkeitsdaten vorhanden.
        </div>
      )}

      {!loading && scores.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Tier</th>
                  <th className="text-left px-4 py-2">No-Shows</th>
                  <th className="text-left px-4 py-2">Spät</th>
                  <th className="text-left px-4 py-2">Früh Ende</th>
                  <th className="text-left px-4 py-2">Perfekt</th>
                  <th className="text-left px-4 py-2">Schichten</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => {
                  const tier = s.reliability_tier ?? 'medium';
                  const tc = TIER_CONFIG[tier];
                  return (
                    <tr key={s.driver_id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                            i === 0 ? 'bg-matcha-700' : i === 1 ? 'bg-blue-500' : 'bg-muted-foreground')}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-medium">{s.driver_name ?? s.driver_id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full', tier === 'excellent' ? 'bg-matcha-500' : tier === 'good' ? 'bg-blue-500' : tier === 'medium' ? 'bg-amber-500' : 'bg-red-500')}
                              style={{ width: `${Math.min(s.score, 100)}%` }} />
                          </div>
                          <span className="text-sm font-bold tabular-nums">{s.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', tc.badge)}>{tc.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-red-600">{s.no_shows > 0 ? s.no_shows : '—'}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-amber-600">{s.late_starts > 0 ? s.late_starts : '—'}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-amber-600">{s.early_ends > 0 ? s.early_ends : '—'}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-matcha-700">{s.perfect_shifts}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{s.total_shifts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
