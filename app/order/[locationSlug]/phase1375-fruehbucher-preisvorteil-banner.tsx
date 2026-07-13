'use client';

import { useEffect, useState } from 'react';
import { Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1375 — Frühbucher-Preisvorteil-Banner (Storefront)
 *
 * Wenn Uhrzeit < 11:00 Uhr → "Frühbucher-Rabatt 5%"
 * Wenn Uhrzeit > 20:30 Uhr → "Spätabend-Rabatt 5%"
 * + Countdown bis Aktions-Ende. Nach Phase1370 in storefront.tsx.
 */

interface Props {
  locationId: string;
}

type AktionsTyp = 'fruehbucher' | 'spaetabend' | null;

function aktionsTyp(h: number, m: number): AktionsTyp {
  const minNow = h * 60 + m;
  if (minNow < 11 * 60) return 'fruehbucher';
  if (minNow >= 20 * 60 + 30) return 'spaetabend';
  return null;
}

function aktionsEnde(typ: AktionsTyp): { h: number; m: number } | null {
  if (typ === 'fruehbucher') return { h: 11, m: 0 };
  if (typ === 'spaetabend') return { h: 23, m: 59 };
  return null;
}

function formatCountdown(remainSec: number): string {
  if (remainSec <= 0) return '0:00';
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  if (m >= 60) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${hh}h ${String(mm).padStart(2, '0')}min`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1375FruehbucherPreisvorteilBanner({ locationId: _locationId }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [remainSec, setRemainSec] = useState(0);

  useEffect(() => {
    // Hydrierungsschutz: erst client-seitig bestimmen
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (!now) return;

    function berechne() {
      const n = new Date();
      const h = n.getHours();
      const m = n.getMinutes();
      const s = n.getSeconds();
      const typ = aktionsTyp(h, m);
      const ende = aktionsEnde(typ);
      if (!ende) {
        setRemainSec(0);
        return;
      }

      let endeH = ende.h;
      let endeM = ende.m;
      // Wenn Spätabend bis 23:59
      const endeSec = endeH * 3600 + endeM * 60;
      const nowSec = h * 3600 + m * 60 + s;
      const diff = endeSec - nowSec;
      setRemainSec(diff > 0 ? diff : 0);
    }

    berechne();
    const t = setInterval(() => {
      setNow(new Date());
      berechne();
    }, 1000);
    return () => clearInterval(t);
  }, [now]);

  if (!now) return null;

  const h = now.getHours();
  const m = now.getMinutes();
  const typ = aktionsTyp(h, m);

  if (!typ) return null;

  const isFrueh = typ === 'fruehbucher';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      isFrueh
        ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800'
        : 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800',
    )}>
      <Tag className={cn('h-5 w-5 shrink-0', isFrueh ? 'text-amber-500' : 'text-indigo-500')} />

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', isFrueh ? 'text-amber-800 dark:text-amber-200' : 'text-indigo-800 dark:text-indigo-200')}>
          {isFrueh ? 'Frühbucher-Vorteil — 5% Rabatt' : 'Spätabend-Angebot — 5% Rabatt'}
        </p>
        <p className={cn('text-[11px]', isFrueh ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400')}>
          {isFrueh
            ? 'Bestelle jetzt und spare 5% auf deine gesamte Bestellung!'
            : 'Perfekt für den Abend — 5% auf die gesamte Bestellung!'}
        </p>
      </div>

      {remainSec > 0 && (
        <div className={cn(
          'flex flex-col items-center shrink-0 rounded-lg px-2.5 py-1.5 border',
          isFrueh
            ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700'
            : 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700',
        )}>
          <Clock className={cn('h-3.5 w-3.5', isFrueh ? 'text-amber-600' : 'text-indigo-600')} />
          <span className={cn('text-xs font-bold tabular-nums', isFrueh ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-300')}>
            {formatCountdown(remainSec)}
          </span>
          <span className={cn('text-[9px]', isFrueh ? 'text-amber-500' : 'text-indigo-500')}>
            verbleibend
          </span>
        </div>
      )}
    </div>
  );
}
