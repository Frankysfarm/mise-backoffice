'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OeffnungsZeit {
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

interface Props {
  locationId: string;
  oeffnungszeiten?: Partial<Record<number, OeffnungsZeit>>;
}

function parseHM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function toMinutes(hhmm: string): number {
  const { h, m } = parseHM(hhmm);
  return h * 60 + m;
}

function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fmtCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

// Fallback-Öffnungszeiten Mo–Sa 11:00–22:00, So geschlossen
const DEFAULT_HOURS: Partial<Record<number, OeffnungsZeit>> = {
  1: { open: '11:00', close: '22:00' },
  2: { open: '11:00', close: '22:00' },
  3: { open: '11:00', close: '22:00' },
  4: { open: '11:00', close: '22:00' },
  5: { open: '11:00', close: '22:00' },
  6: { open: '11:00', close: '22:00' },
};

export function Phase1645OeffnungszeitenStatusBanner({ locationId: _locationId, oeffnungszeiten }: Props) {
  const hours = oeffnungszeiten ?? DEFAULT_HOURS;

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const iv = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(iv);
  }, []);

  // Hydration-safe: render nothing on server
  if (!now) return null;

  const weekday = now.getDay(); // 0=So, 1=Mo, ...
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const todayHours = hours[weekday];

  const isOpen = todayHours != null
    ? currentMin >= toMinutes(todayHours.open) && currentMin < toMinutes(todayHours.close)
    : false;

  // Wie viele Sekunden bis Änderung?
  let countdownSeconds: number | null = null;
  let countdownLabel = '';

  if (todayHours) {
    if (isOpen) {
      const closeMin = toMinutes(todayHours.close);
      countdownSeconds = (closeMin - currentMin) * 60 - now.getSeconds();
      countdownLabel = 'Schließt in';
    } else if (currentMin < toMinutes(todayHours.open)) {
      const openMin = toMinutes(todayHours.open);
      countdownSeconds = (openMin - currentMin) * 60 - now.getSeconds();
      countdownLabel = 'Öffnet in';
    }
  }

  // Nächste Öffnung (morgen oder übernächster Werktag)
  let naechsteOeffnung: string | null = null;
  if (!isOpen) {
    for (let i = 1; i <= 7; i++) {
      const nextDay = (weekday + i) % 7;
      const nextHours = hours[nextDay];
      if (nextHours) {
        const tagName = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][nextDay];
        naechsteOeffnung = `${tagName} ${nextHours.open} Uhr`;
        break;
      }
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
        isOpen
          ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
          : 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900',
      )}
    >
      <Clock className={cn('h-4 w-4 shrink-0', isOpen ? 'text-emerald-600' : 'text-red-500')} />
      <div className="flex-1 min-w-0">
        <span className={cn('font-semibold', isOpen ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
          {isOpen ? 'Jetzt geöffnet' : 'Aktuell geschlossen'}
        </span>
        {todayHours && (
          <span className="ml-1.5 text-muted-foreground text-xs">
            {todayHours.open}–{todayHours.close} Uhr
          </span>
        )}
        {!isOpen && naechsteOeffnung && !countdownLabel && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            · nächste Öffnung: {naechsteOeffnung}
          </span>
        )}
      </div>
      {countdownSeconds !== null && countdownSeconds > 0 && (
        <div className={cn('shrink-0 text-right text-xs font-mono font-bold tabular-nums', isOpen ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
          <div className="text-[9px] font-normal opacity-70">{countdownLabel}</div>
          {fmtCountdown(countdownSeconds)}
        </div>
      )}
    </div>
  );
}
