'use client';

import { useState, useEffect, useCallback } from 'react';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RampUpDashboard, RampUpProfile, RampUpTier } from '@/lib/delivery/driver-ramp-up';

interface Props {
  locationId?: string;
}

type ApiResponse = {
  ok: boolean;
  dashboard: RampUpDashboard;
};

function getInitials(name: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tierColor(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'bg-red-500';
    case 'developing': return 'bg-amber-400';
    case 'promising': return 'bg-emerald-500';
    case 'graduated': return 'bg-indigo-500';
  }
}

function tierLabel(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'Schwierig';
    case 'developing': return 'Entwicklung';
    case 'promising': return 'Vielversprechend';
    case 'graduated': return 'Abgeschlossen';
  }
}

function tierBadgeStyle(tier: RampUpTier): string {
  switch (tier) {
    case 'struggling': return 'bg-red-100 text-red-700';
    case 'developing': return 'bg-amber-100 text-amber-700';
    case 'promising': return 'bg-emerald-100 text-emerald-700';
    case 'graduated': return 'bg-indigo-100 text-indigo-700';
  }
}

function DriverCard({ profile }: { profile: RampUpProfile }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[80px] max-w-[80px]">
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
          tierColor(profile.rampUpTier),
        )}
      >
        {getInitials(profile.driverName)}
      </div>
      <span className="text-xs font-medium text-gray-700 w-full text-center truncate">
        {profile.driverName ?? 'Unbekannt'}
      </span>
      <span
        className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
          tierBadgeStyle(profile.rampUpTier),
        )}
      >
        {tierLabel(profile.rampUpTier)}
      </span>
      <span className="text-[10px] text-gray-400">Tag {profile.rampUpDay}</span>
    </div>
  );
}

export function DispatchFahrerRampUpStrip({ locationId }: Props) {
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
  const profiles = (dashboard?.profiles ?? []).slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-matcha-500 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-gray-800">Neue Fahrer im Onboarding</h3>
      </div>

      {kpis && (
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
            Neue Fahrer
            <span className="font-bold text-gray-900">{kpis.activeNewHires}</span>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
              kpis.atRiskCount > 0
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700',
            )}
          >
            Coaching nötig
            <span className="font-bold">{kpis.atRiskCount}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-matcha-50 text-xs font-medium text-matcha-700">
            Ø Score
            <span className="font-bold">{Math.round(kpis.avgCohortScore)}</span>
          </span>
        </div>
      )}

      {profiles.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Keine Neufahrer im Onboarding</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
          {profiles.map((p) => (
            <DriverCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
