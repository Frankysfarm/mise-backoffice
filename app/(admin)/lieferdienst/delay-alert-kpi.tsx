'use client';

/**
 * LieferdienstDelayAlertKpi — Phase 319
 *
 * KPI-Karte für das Lieferdienst-Dashboard:
 * Tagesstatistik der Delay-Push-Alerts (Phase 318 Backend).
 * Zeigt: Alerts heute / Kritische jetzt aktiv / Unterdrückte (Spam-Schutz).
 * Auto-Refresh 120 s.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertStats {
  alertsToday: number;
  alertsTotal: number;
  suppressedTotal: number;
  criticalActiveNow: number;
  alreadyAlertedToday: number;
}

export function LieferdienstDelayAlertKpi({ locationId }: { locationId: string }) {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push?action=stats', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        if (d.stats) setStats(d.stats as AlertStats);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 120_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hasCritical = (stats?.criticalActiveNow ?? 0) > 0;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-4',
      hasCritical ? 'bg-red-50 border-red-300' : 'bg-white border-stone-200',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full',
          hasCritical ? 'bg-red-100 text-red-600' : 'bg-matcha-100 text-matcha-700',
        )}>
          {hasCritical ? <ShieldAlert className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </div>
        <span className={cn('text-sm font-bold', hasCritical ? 'text-red-700' : 'text-stone-700')}>
          Delay-Alerts (Phase 318)
        </span>
        {loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-stone-400" />}
      </div>

      {/* KPI Grid */}
      {stats ? (
        <div className="grid grid-cols-3 gap-2">
          {/* Alerts heute */}
          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5 text-center">
            <div className="text-lg font-black text-matcha-700">{stats.alertsToday}</div>
            <div className="text-[10px] text-stone-500 mt-0.5">heute gesendet</div>
          </div>

          {/* Kritisch aktiv */}
          <div className={cn(
            'rounded-lg border px-3 py-2.5 text-center',
            hasCritical ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200',
          )}>
            <div className={cn('text-lg font-black', hasCritical ? 'text-red-600' : 'text-stone-400')}>
              {stats.criticalActiveNow}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">kritisch aktiv</div>
          </div>

          {/* Unterdrückt */}
          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <BellOff className="h-3 w-3 text-stone-400" />
              <span className="text-lg font-black text-stone-400">{stats.suppressedTotal}</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5">unterdrückt</div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-stone-400 text-center py-2">Lade Statistiken…</div>
      )}

      {/* Footer */}
      {stats && stats.alreadyAlertedToday > 0 && (
        <div className="mt-2.5 text-[11px] text-stone-500 border-t border-stone-100 pt-2.5">
          {stats.alreadyAlertedToday} Kund{stats.alreadyAlertedToday > 1 ? 'en' : 'e'} wurde{stats.alreadyAlertedToday > 1 ? 'n' : ''} heute bereits benachrichtigt
        </div>
      )}
    </div>
  );
}
