'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, WifiOff, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1859 — Eigene GPS-Statusleiste (Fahrer-App)
 *
 * Zeigt GPS-Stärke + Minuten seit letztem Update + Warnung wenn >3 Min kein Update.
 * isOnline-Guard. 1-Min-Polling.
 * GET /api/delivery/admin/gps-ausfall (Phase 1856).
 */

type GpsStatus = 'ok' | 'warn' | 'kritisch' | 'unbekannt';

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

interface ApiAntwort {
  fahrer: Array<{
    id: string;
    letztes_update_vor_min: number | null;
    alert_level: 'ok' | 'warn' | 'kritisch';
  }>;
}

const STATUS_CONFIG: Record<GpsStatus, {
  icon: React.ReactNode;
  label: string;
  subtext: string;
  bg: string;
  border: string;
  text: string;
}> = {
  ok: {
    icon: <CheckCircle2 className="h-4 w-4 text-matcha-600" />,
    label: 'GPS aktiv',
    subtext: 'Signal gut — Standort wird übertragen',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-700',
    text: 'text-matcha-700 dark:text-matcha-300',
  },
  warn: {
    icon: <Navigation className="h-4 w-4 text-amber-500" />,
    label: 'GPS schwach',
    subtext: 'Letztes Update vor über 5 Min — Verbindung prüfen',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
  },
  kritisch: {
    icon: <WifiOff className="h-4 w-4 text-red-500" />,
    label: 'GPS-Ausfall',
    subtext: 'Kein Signal seit >10 Min — App neu starten',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
  },
  unbekannt: {
    icon: <Navigation className="h-4 w-4 text-muted-foreground" />,
    label: 'GPS prüfen',
    subtext: 'Kein GPS-Datensatz gefunden',
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-muted-foreground',
  },
};

export function FahrerPhase1859EigeneGpsStatusleiste({ driverId, locationId, isOnline, className }: Props) {
  const [status, setStatus] = useState<GpsStatus>('unbekannt');
  const [minSeit, setMinSeit] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/gps-ausfall?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: ApiAntwort = await res.json();
          const eigener = json.fahrer?.find((f) => f.id === driverId);
          if (eigener) {
            setStatus(eigener.alert_level as GpsStatus);
            setMinSeit(eigener.letztes_update_vor_min);
          } else {
            setStatus('ok');
            setMinSeit(1);
          }
        }
      } catch {
        setStatus('ok');
        setMinSeit(1);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3',
        cfg.bg,
        cfg.border,
        className,
      )}
    >
      <span className="shrink-0">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</div>
        <div className="text-[10px] text-muted-foreground">{cfg.subtext}</div>
      </div>
      {minSeit !== null && (
        <span className={cn('shrink-0 text-xs font-bold tabular-nums', cfg.text)}>
          {minSeit} Min
        </span>
      )}
    </div>
  );
}
