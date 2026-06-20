'use client';

/**
 * FahrerDelayAlertHinweis — Phase 319
 *
 * Zeigt dem Fahrer, wenn für eine seiner aktuellen Lieferungen
 * ein Delay-Alert an den Kunden verschickt wurde.
 * Der Fahrer weiß damit: Kunde erwartet Verspätung — kein Ärger bei Übergabe.
 *
 * Polling alle 60 s auf /api/delivery/admin/delay-alert-push?action=stats
 * (Fahrer-seitig: nur Stats — kein Push-Trigger)
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

interface Props {
  batchHasCriticalOrder: boolean;
}

export function FahrerDelayAlertHinweis({ batchHasCriticalOrder }: Props) {
  const [alerted, setAlerted] = useState(false);
  const [alertsToday, setAlertsToday] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/delay-alert-push?action=stats', { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      if (d.stats) {
        setAlertsToday(d.stats.alertsToday ?? 0);
        setAlerted((d.stats.alertsToday ?? 0) > 0 && batchHasCriticalOrder);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchHasCriticalOrder]);

  if (!alerted || alertsToday === 0) return null;

  return (
    <div className="mx-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 mt-0.5">
        <Bell className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1">
        <div className="text-xs font-bold text-amber-800">Kunde informiert</div>
        <div className="text-[11px] text-amber-700 mt-0.5">
          Dein Kunde wurde über eine mögliche Verspätung benachrichtigt.
          Kein Stress — er weiß Bescheid.
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
          <CheckCircle2 className="h-3 w-3" />
          <span>Delay-Alert gesendet</span>
        </div>
      </div>
    </div>
  );
}
