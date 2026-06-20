'use client';

/**
 * KitchenStornoAlertStrip — Phase 345
 *
 * Zeigt aktuelle Stornierungsrisiken die die Küche betreffen.
 * Erscheint als dismissbarer Alert-Strip wenn high/blocked Events in letzter Stunde.
 */

import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface GuardEvent {
  id: string;
  event_type: string;
  risk_level: string;
  cancellation_count_24h: number;
  created_at: string;
}

interface Dashboard {
  todayAttempts: number;
  todayBlocked: number;
  recentEvents: GuardEvent[];
}

export function KitchenStornoAlertStrip({ locationId }: { locationId: string | null }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      const url = `/api/delivery/admin/cancellation-guard?action=dashboard&location_id=${locationId}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (res?.ok) setDashboard(await res.json() as Dashboard);
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [locationId]);

  if (!dashboard || dismissed) return null;

  // Nur zeigen wenn high/blocked Events in letzter Stunde
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const urgentEvents = dashboard.recentEvents.filter(
    (e) => ['high', 'blocked'].includes(e.risk_level) && e.created_at >= since1h,
  );

  if (urgentEvents.length === 0) return null;

  const hasBlocked = urgentEvents.some((e) => e.risk_level === 'blocked');

  return (
    <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-3 text-sm ${
      hasBlocked ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
    }`}>
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong>{urgentEvents.length} Stornierungsrisiko-Alert{urgentEvents.length > 1 ? 's' : ''}</strong>
        {' '}in der letzten Stunde
        {hasBlocked ? ' — 1 Kunde gesperrt' : ''}.
        {' '}Heute insgesamt: {dashboard.todayAttempts} Versuche, {dashboard.todayBlocked} gesperrt.
      </span>
      <button onClick={() => setDismissed(true)} className="ml-1 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
