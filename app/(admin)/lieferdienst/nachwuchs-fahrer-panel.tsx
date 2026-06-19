'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RampUpDashboard, RampUpProfile, RampUpTier } from '@/lib/delivery/driver-ramp-up';

interface Props {
  locationId?: string;
}

type ApiResponse = {
  ok: boolean;
  dashboard: RampUpDashboard;
};

function tierBarColor(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'bg-red-400';
    case 'developing': return 'bg-amber-400';
    case 'promising': return 'bg-emerald-500';
    case 'graduated': return 'bg-indigo-500';
  }
}

function tierLabelShort(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'Schwierig';
    case 'developing': return 'Entwicklung';
    case 'promising': return 'Vielversprechend';
    case 'graduated': return 'Abgeschlossen';
  }
}

function ScoreBar({ profile }: { profile: RampUpProfile }) {
  const pct = Math.min(100, Math.max(0, profile.rampUpScore));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-gray-600 truncate w-24 flex-shrink-0">
        {profile.driverName ?? 'Unbekannt'}
      </span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', tierBarColor(profile.rampUpTier))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right flex-shrink-0">
        {profile.rampUpScore}
      </span>
    </div>
  );
}

export function NachwuchsFahrerPanel({ locationId }: Props) {
  const [dashboard, setDashboard] = useState<RampUpDashboard | null>(null);

  const load = useCallback(async () => {
    try {
      const url = new URL('/api/delivery/admin/driver-ramp-up', window.location.origin);
      url.searchParams.set('action', 'dashboard');
      if (locationId) url.searchParams.set('location_id', locationId);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const json = (await res.json()) as ApiResponse;
      if (json.ok) setDashboard(json.dashboard);
    } catch {
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const kpis = dashboard?.kpis;
  const profiles = (dashboard?.profiles ?? []).slice(0, 6);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-matcha-500 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-800">Nachwuchs-Fahrer Übersicht</h3>
        </div>
        {kpis && kpis.coachingFlagged > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            {kpis.coachingFlagged} Fahrer brauchen Coaching
          </span>
        )}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 p-3 space-y-0.5">
            <p className="text-xs text-gray-500">Neue Fahrer</p>
            <p className="text-xl font-bold text-gray-900">{kpis.activeNewHires}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 space-y-0.5">
            <p className="text-xs text-gray-500">Bald fertig</p>
            <p className="text-xl font-bold text-gray-900">{kpis.graduatingSoon}</p>
          </div>
          <div
            className={cn(
              'rounded-lg p-3 space-y-0.5',
              kpis.atRiskCount > 0 ? 'bg-red-50' : 'bg-gray-50',
            )}
          >
            <p className={cn('text-xs', kpis.atRiskCount > 0 ? 'text-red-500' : 'text-gray-500')}>
              Risiko
            </p>
            <p
              className={cn(
                'text-xl font-bold',
                kpis.atRiskCount > 0 ? 'text-red-700' : 'text-gray-900',
              )}
            >
              {kpis.atRiskCount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 space-y-0.5">
            <p className="text-xs text-gray-500">Absolventen</p>
            <p className="text-xl font-bold text-gray-900">{kpis.graduatedLast7d}</p>
          </div>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Score-Übersicht</p>
          <div className="space-y-2">
            {profiles.map((p) => (
              <ScoreBar key={p.id} profile={p} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {(['struggling', 'developing', 'promising', 'graduated'] as RampUpTier[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <span className={cn('w-2 h-2 rounded-full', tierBarColor(t))} />
                {tierLabelShort(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {profiles.length === 0 && (
        <p className="text-xs text-gray-400 py-2">Keine aktiven Neufahrer</p>
      )}
    </div>
  );
}
