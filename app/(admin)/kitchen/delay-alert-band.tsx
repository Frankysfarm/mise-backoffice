'use client';

/**
 * KitchenDelayAlertBand — Phase 319
 *
 * Zeigt der Küche welche Bestellungen heute Delay-Alerts erhalten haben
 * und wie viele kritische Prognosen gerade aktiv sind.
 * Scan-Now-Button: direkt auslösen (POST scan_now) wenn Küche Druck hat.
 * Polling alle 90 s auf /api/delivery/admin/delay-alert-push?action=stats
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertStats {
  alertsToday: number;
  alertsTotal: number;
  suppressedTotal: number;
  criticalActiveNow: number;
  alreadyAlertedToday: number;
}

export function KitchenDelayAlertBand({ locationId }: { locationId: string | null }) {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{ alerted: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push?action=stats', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      if (d.stats) setStats(d.stats as AlertStats);
    } catch {}
  };

  const scanNow = async () => {
    if (!locationId || scanning) return;
    setScanning(true);
    setLastScan(null);
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'scan_now', location_id: locationId }),
      });
      if (res.ok) {
        const d = await res.json();
        setLastScan({ alerted: d.result?.alerted ?? 0 });
        await load();
      }
    } catch {} finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 90_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!stats) return null;

  const hasCritical = stats.criticalActiveNow > 0;
  const urgent = hasCritical && stats.criticalActiveNow > 2;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3',
        urgent   ? 'bg-red-50 border-red-300'    :
        hasCritical ? 'bg-amber-50 border-amber-300' :
                    'bg-matcha-50 border-matcha-200',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          urgent      ? 'bg-red-100 text-red-600'     :
          hasCritical ? 'bg-amber-100 text-amber-700' :
                        'bg-matcha-100 text-matcha-700',
        )}
      >
        {hasCritical ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-xs font-bold',
          urgent      ? 'text-red-700'     :
          hasCritical ? 'text-amber-800'   :
                        'text-matcha-800',
        )}>
          {hasCritical
            ? `${stats.criticalActiveNow} kritische Prognose${stats.criticalActiveNow > 1 ? 'n' : ''} aktiv`
            : 'Keine kritischen Verspätungen'}
        </div>
        <div className="text-[11px] text-stone-500 mt-0.5 flex flex-wrap gap-x-3">
          <span>
            <Bell className="inline h-3 w-3 mr-0.5 text-stone-400" />
            {stats.alertsToday} Alert{stats.alertsToday !== 1 ? 's' : ''} heute
          </span>
          {stats.alreadyAlertedToday > 0 && (
            <span>{stats.alreadyAlertedToday} bereits benachrichtigt</span>
          )}
          {lastScan !== null && (
            <span className="text-matcha-700 font-semibold">
              ✓ {lastScan.alerted} gesendet
            </span>
          )}
        </div>
      </div>

      {/* Scan-Now Button */}
      <button
        onClick={scanNow}
        disabled={scanning || !locationId}
        title="Jetzt alle kritischen Prognosen scannen und Alerts senden"
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50',
          hasCritical
            ? 'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
            : 'border border-matcha-300 bg-matcha-100 text-matcha-700 hover:bg-matcha-200',
        )}
      >
        {scanning
          ? <><Loader2 className="h-3 w-3 animate-spin" />Scannt…</>
          : <><RefreshCw className="h-3 w-3" />Scan</>
        }
      </button>
    </div>
  );
}
