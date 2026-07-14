'use client';

import React, { useEffect, useState, useRef } from 'react';

interface Props {
  neueBestellungEingegangen?: boolean;
  bestellungZeit?: Date | null;
  schwelleSeconds?: number;
  onQuittieren?: () => void;
}

export function KitchenPhase1548SofortReaktionsTimer({
  neueBestellungEingegangen = false,
  bestellungZeit = null,
  schwelleSeconds = 30,
  onQuittieren,
}: Props) {
  const [sekundenVergangen, setSekundenVergangen] = useState(0);
  const [sichtbar, setSichtbar] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!neueBestellungEingegangen || !bestellungZeit) {
      setSichtbar(false);
      setSekundenVergangen(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const updateTimer = () => {
      const vergangen = Math.floor((Date.now() - bestellungZeit.getTime()) / 1000);
      setSekundenVergangen(vergangen);
      if (vergangen >= schwelleSeconds) setSichtbar(true);
    };

    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [neueBestellungEingegangen, bestellungZeit, schwelleSeconds]);

  if (!sichtbar) return null;

  const ueberfaelligSeconds = Math.max(0, sekundenVergangen - schwelleSeconds);
  const dringlichkeit = ueberfaelligSeconds >= 60 ? 'kritisch' : ueberfaelligSeconds >= 30 ? 'hoch' : 'mittel';

  const barStyle: Record<string, string> = {
    kritisch: 'bg-red-600 dark:bg-red-700',
    hoch:     'bg-orange-500 dark:bg-orange-600',
    mittel:   'bg-yellow-500 dark:bg-yellow-600',
  };
  const textStyle: Record<string, string> = {
    kritisch: 'text-white',
    hoch:     'text-white',
    mittel:   'text-yellow-950 dark:text-white',
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${barStyle[dringlichkeit]} ${textStyle[dringlichkeit]} shadow-md transition-all duration-300`}>
      <div className="flex items-center gap-3">
        <span className="text-lg animate-pulse">
          {dringlichkeit === 'kritisch' ? '🚨' : dringlichkeit === 'hoch' ? '⚠️' : '⏰'}
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">
            Neue Bestellung unbearbeitet!
          </p>
          <p className="text-xs opacity-90">
            Wartet seit <span className="font-mono font-black">{formatTime(sekundenVergangen)}</span>
            {' '}— {dringlichkeit === 'kritisch' ? 'Sofort handeln!' : dringlichkeit === 'hoch' ? 'Dringend bearbeiten' : 'Bitte bearbeiten'}
          </p>
        </div>
      </div>
      {onQuittieren && (
        <button
          onClick={() => { setSichtbar(false); onQuittieren(); }}
          className="ml-3 rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold transition shrink-0"
        >
          Quittieren
        </button>
      )}
    </div>
  );
}
