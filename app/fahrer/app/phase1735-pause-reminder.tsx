'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, X, Clock } from 'lucide-react';

/**
 * Phase 1735 — Pause-Reminder (Fahrer-App)
 *
 * Wenn Fahrer >90 Min online ohne Pause (keine Lücke >10 Min):
 * Pause-Empfehlung anzeigen; isOnline-Guard; 1-Min-Polling.
 */

interface Props {
  driverId: string | null;
  isOnline: boolean;
  onlineSeit: string | null;
}

interface SchichtData {
  online_seit: string | null;
  letzte_pause_ende: string | null;
}

const GRENZWERT_MIN = 90;
const PAUSE_MIN = 10;
const POLL_MS = 60_000;

export function FahrerPhase1735PauseReminder({ driverId, isOnline, onlineSeit }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [onlineMinuten, setOnlineMinuten] = useState(0);
  const [letzteAktivitaet, setLetzteAktivitaet] = useState<string | null>(null);
  const dismissedRef = useRef(false);

  const berechneMinuten = (seit: string | null): number => {
    if (!seit) return 0;
    const ms = Date.now() - new Date(seit).getTime();
    return Math.floor(ms / 60_000);
  };

  const ladeDaten = async () => {
    if (!driverId || !isOnline) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/schicht-statistik?driver_id=${driverId}`);
      if (res.ok) {
        const d: SchichtData = await res.json();
        if (d.letzte_pause_ende) {
          setLetzteAktivitaet(d.letzte_pause_ende);
          setOnlineMinuten(berechneMinuten(d.letzte_pause_ende));
        } else if (d.online_seit ?? onlineSeit) {
          const seit = d.online_seit ?? onlineSeit;
          setLetzteAktivitaet(seit);
          setOnlineMinuten(berechneMinuten(seit));
        }
      } else {
        setOnlineMinuten(berechneMinuten(onlineSeit));
      }
    } catch {
      setOnlineMinuten(berechneMinuten(onlineSeit));
    }
  };

  useEffect(() => {
    if (!isOnline) { setDismissed(false); dismissedRef.current = false; return; }
    ladeDaten();
    const id = setInterval(ladeDaten, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;
  if (onlineMinuten < GRENZWERT_MIN) return null;
  if (dismissed) return null;

  const std = Math.floor(onlineMinuten / 60);
  const min = onlineMinuten % 60;
  const dauerText = std > 0 ? `${std}h ${min}min` : `${min} Min`;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/15 p-3 mb-3 mx-1">
      <div className="flex items-start gap-3">
        <Coffee className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Zeit für eine Pause!
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Du bist seit {dauerText} ununterbrochen unterwegs. Gönn dir {PAUSE_MIN} Minuten.
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-700 px-2.5 py-1">
              <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                {onlineMinuten} Min aktiv
              </span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              Empfehlung: ≥{PAUSE_MIN} Min Pause
            </span>
          </div>
        </div>

        <button
          onClick={() => { setDismissed(true); dismissedRef.current = true; }}
          className="shrink-0 rounded-full p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
          aria-label="Schließen"
        >
          <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </button>
      </div>
    </div>
  );
}
