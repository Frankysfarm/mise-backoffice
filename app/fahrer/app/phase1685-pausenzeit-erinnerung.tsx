'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, X } from 'lucide-react';

/**
 * Phase 1685 — Pausenzeit-Erinnerung (Fahrer-App)
 *
 * Wenn Fahrer >5.5h aktiv: In-App-Karte mit Pausenempfehlung.
 * isOnline-Guard; 15-Min-Polling; schließbar.
 */

interface Props {
  driverId?: string | null;
  isOnline: boolean;
  onlineSeit?: string | null;
}

interface ApiResponse {
  status: 'ok' | 'pause_faellig' | 'ueberzeit';
  schicht_dauer_min: number;
  pause_genommen_min: number;
  pause_pflicht_min: number;
  pause_faellig_seit_min: number | null;
}

const WARN_MIN = 330; // 5.5h

function schichtMinutenLokal(onlineSeit: string | null | undefined): number {
  if (!onlineSeit) return 0;
  return Math.round((Date.now() - new Date(onlineSeit).getTime()) / 60000);
}

export function FahrerPhase1685PausenzeitErinnerung({ driverId, isOnline, onlineSeit }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    let active = true;

    async function load() {
      // Zuerst lokale Schätzung: falls <5.5h keine API-Last
      const localMin = schichtMinutenLokal(onlineSeit);
      if (localMin < WARN_MIN && !driverId) return;

      try {
        const params = driverId ? `?location_id=all&driver_id=${driverId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-pausen-compliance${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (!active) return;

        // Fahrer-spezifischen Eintrag aus Liste holen
        const fahrerList = json.fahrer as ApiResponse[] & { fahrer_id?: string }[];
        const eintrag = driverId
          ? (json.fahrer as (ApiResponse & { fahrer_id: string })[]).find(
              (f: { fahrer_id: string }) => f.fahrer_id === driverId,
            )
          : null;

        if (eintrag) {
          setData(eintrag as unknown as ApiResponse);
        } else if (localMin >= WARN_MIN) {
          // Lokaler Fallback
          setData({
            status: 'pause_faellig',
            schicht_dauer_min: localMin,
            pause_genommen_min: 0,
            pause_pflicht_min: 30,
            pause_faellig_seit_min: localMin - WARN_MIN,
          });
        }
      } catch {
        if (!active) return;
        const localMin = schichtMinutenLokal(onlineSeit);
        if (localMin >= WARN_MIN) {
          setData({
            status: 'pause_faellig',
            schicht_dauer_min: localMin,
            pause_genommen_min: 0,
            pause_pflicht_min: 30,
            pause_faellig_seit_min: localMin - WARN_MIN,
          });
        }
      }
    }

    load();
    const id = setInterval(() => { setDismissed(false); load(); }, 15 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [isOnline, driverId, onlineSeit]);

  if (!mounted || !isOnline || !data) return null;
  if (data.status === 'ok') return null;
  if (dismissed) return null;

  const isUeberzeit = data.status === 'ueberzeit';
  const stunden = Math.floor(data.schicht_dauer_min / 60);
  const restMin = data.schicht_dauer_min % 60;
  const fehlend = Math.max(0, data.pause_pflicht_min - data.pause_genommen_min);

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-xl border p-3 flex items-start gap-3',
      isUeberzeit
        ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    )}>
      <Coffee className={cn(
        'h-5 w-5 mt-0.5 shrink-0',
        isUeberzeit ? 'text-red-500' : 'text-amber-500',
      )} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold',
          isUeberzeit ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
        )}>
          {isUeberzeit ? 'Pause überfällig!' : 'Pause empfohlen'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {stunden}h {restMin}m Schicht aktiv
          {fehlend > 0 && ` · noch ${fehlend} Min Pause nötig`}
        </p>
        {isUeberzeit && (
          <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-medium">
            Gesetzliche Pflichtpause seit {data.pause_faellig_seit_min ?? 0} Min überschritten
          </p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
