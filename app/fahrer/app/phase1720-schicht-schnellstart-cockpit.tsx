'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, PackageCheck, Banknote } from 'lucide-react';

/**
 * Phase 1720 — Schicht-Schnellstart-Cockpit (Fahrer-App)
 *
 * 3-KPI-Kacheln (Online-Zeit / Stopps / Verdienst) + Schicht-Startzeit.
 * Stets sichtbar wenn isOnline. Kein Polling — Props-basiert.
 * Online-Zeit wird jede Minute im Client hochgezählt.
 */

interface Props {
  isOnline: boolean;
  onlineSeit: string | null;
  stoppsHeute: number;
  verdienstEur: number;
}

function useOnlineMin(onlineSeit: string | null, isOnline: boolean) {
  const [min, setMin] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOnline || !onlineSeit) { setMin(0); return; }

    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(onlineSeit).getTime()) / 60_000);
      setMin(Math.max(0, elapsed));
    };

    calc();
    intervalRef.current = setInterval(calc, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isOnline, onlineSeit]);

  return min;
}

function KpiKachel({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-1 rounded-xl border px-3 py-3 flex-1',
      accent,
    )}>
      <Icon className="h-5 w-5 opacity-70" />
      <span className="text-lg font-black tabular-nums leading-tight">{value}</span>
      <span className="text-[10px] text-muted-foreground font-medium text-center">{label}</span>
    </div>
  );
}

export function FahrerPhase1720SchichtSchnellstartCockpit({
  isOnline,
  onlineSeit,
  stoppsHeute,
  verdienstEur,
}: Props) {
  const onlineMin = useOnlineMin(onlineSeit, isOnline);

  if (!isOnline) return null;

  const stunden = Math.floor(onlineMin / 60);
  const minRest = onlineMin % 60;
  const zeitLabel = stunden > 0
    ? `${stunden}h ${minRest.toString().padStart(2, '0')}m`
    : `${onlineMin}m`;

  const startZeit = onlineSeit
    ? new Date(onlineSeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-green-700 dark:text-green-300">Schicht-Cockpit</span>
        <span className="text-[10px] text-muted-foreground">Start {startZeit}</span>
      </div>

      <div className="flex gap-2">
        <KpiKachel
          icon={Clock}
          label="Online-Zeit"
          value={zeitLabel}
          accent="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
        />
        <KpiKachel
          icon={PackageCheck}
          label="Stopps"
          value={stoppsHeute.toString()}
          accent="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
        />
        <KpiKachel
          icon={Banknote}
          label="Verdienst"
          value={verdienstEur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          accent="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
        />
      </div>
    </div>
  );
}
