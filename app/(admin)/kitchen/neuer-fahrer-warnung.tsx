'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RampUpDashboard, RampUpProfile } from '@/lib/delivery/driver-ramp-up';

interface Props {
  locationId?: string;
}

type ApiResponse = {
  ok: boolean;
  dashboard: RampUpDashboard;
};

function needsAttention(p: RampUpProfile): boolean {
  return p.rampUpTier === 'struggling' || p.coachingFlag === true;
}

export function KitchenNeuerFahrerWarning({ locationId }: Props) {
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
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, [load]);

  if (!dashboard) return null;

  const flaggedDrivers = dashboard.profiles.filter(needsAttention);
  if (flaggedDrivers.length === 0) return null;

  const shown = flaggedDrivers.slice(0, 3);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-amber-800">Neue Fahrer mit Coaching-Bedarf</h3>
      </div>

      <ul className="space-y-2">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-amber-900 truncate">
                {p.driverName ?? 'Unbekannt'}
              </span>
              <span className="text-xs text-amber-600">Tag {p.rampUpDay}</span>
            </div>
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                p.rampUpScore < 40
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700',
              )}
            >
              Score {p.rampUpScore}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-amber-700 border-t border-amber-200 pt-2">
        Kürzere Warmhaltephasen empfohlen. Bitte 2–3 Min früher fertigstellen.
      </p>
    </div>
  );
}
