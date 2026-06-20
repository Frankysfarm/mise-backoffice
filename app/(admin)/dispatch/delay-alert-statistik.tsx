'use client';

/**
 * DispatchDelayAlertStatistik — Phase 319
 *
 * Kompakte Statistik-Karte für den Dispatcher: Wie viele Delay-Alerts
 * wurden heute verschickt? Wie viele kritische Prognosen sind noch aktiv?
 * Beinhaltet Scan-Now-Button und 60s Auto-Refresh.
 *
 * Endpoint: GET  /api/delivery/admin/delay-alert-push?action=stats
 *           POST /api/delivery/admin/delay-alert-push  action=scan_now
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Loader2, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertStats {
  alertsToday: number;
  alertsTotal: number;
  suppressedTotal: number;
  criticalActiveNow: number;
  alreadyAlertedToday: number;
}

interface ScanResult {
  alerted: number;
  suppressed: number;
  errors: number;
}

export function DispatchDelayAlertStatistik({ locationId }: { locationId: string | null }) {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setScanResult(null);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'scan_now', location_id: locationId }),
      });
      if (!res.ok) { setError('Fehler beim Scan'); return; }
      const d = await res.json();
      setScanResult(d.result as ScanResult);
      await load();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hasCritical = (stats?.criticalActiveNow ?? 0) > 0;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-center gap-3',
      hasCritical ? 'bg-red-50 border-red-300' : 'bg-white border-stone-200',
    )}>
      {/* Icon */}
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        hasCritical ? 'bg-red-100 text-red-600' : 'bg-matcha-100 text-matcha-700',
      )}>
        <Bell className="h-3.5 w-3.5" />
      </div>

      {/* Stats */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold', hasCritical ? 'text-red-700' : 'text-stone-700')}>
          Delay-Alerts
          {hasCritical && (
            <span className="ml-2 inline-flex items-center gap-0.5 text-red-600">
              <Zap className="h-3 w-3" /> {stats!.criticalActiveNow} kritisch
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-stone-500">
          {stats ? (
            <>
              <span><span className="font-bold text-stone-700">{stats.alertsToday}</span> heute</span>
              {stats.suppressedTotal > 0 && (
                <span className="flex items-center gap-0.5">
                  <BellOff className="h-3 w-3" /> {stats.suppressedTotal} unterdrückt
                </span>
              )}
              {scanResult && (
                <span className="text-matcha-700 font-semibold">
                  ✓ {scanResult.alerted} gesendet
                  {scanResult.suppressed > 0 && ` · ${scanResult.suppressed} skip`}
                </span>
              )}
              {error && <span className="text-red-600">{error}</span>}
            </>
          ) : (
            <span className="text-stone-400">Lade…</span>
          )}
        </div>
      </div>

      {/* Scan-Now */}
      <button
        onClick={scanNow}
        disabled={scanning || !locationId}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50',
          hasCritical
            ? 'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
            : 'border border-matcha-300 bg-matcha-50 text-matcha-700 hover:bg-matcha-100',
        )}
      >
        {scanning
          ? <><Loader2 className="h-3 w-3 animate-spin" />Scannt…</>
          : <><RefreshCw className="h-3 w-3" />Scan Now</>
        }
      </button>
    </div>
  );
}
