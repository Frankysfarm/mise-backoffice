'use client';

import { useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1404 — Angebots-Countdown-Banner (Storefront)
 *
 * Zeigt ein zeitlich begrenztes Angebot mit Live-Countdown:
 *   • Lunchzeit (11:00–14:00): "Lunch-Special –10%"
 *   • Abend (18:00–21:00): "Abend-Deal –8%"
 *   • Countdown bis Aktions-Ende (Sekunden-Ticker)
 *   • Schließbar; Hydration-Safe (kein window beim SSR)
 *
 * Nach Phase1399 in storefront.tsx einbinden.
 */

interface Angebot {
  label: string;
  rabatt: string;
  code: string;
  endeStunde: number;
  endeMinute: number;
  bg: string;
  text: string;
  border: string;
}

function getAktuellesAngebot(now: Date): Angebot | null {
  const h = now.getHours();
  const m = now.getMinutes();

  if (h >= 11 && (h < 14 || (h === 14 && m === 0))) {
    return {
      label: 'Lunch-Special',
      rabatt: '10%',
      code: 'LUNCH10',
      endeStunde: 14,
      endeMinute: 0,
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      text: 'text-amber-800 dark:text-amber-200',
      border: 'border-amber-300 dark:border-amber-700',
    };
  }
  if (h >= 18 && (h < 21 || (h === 21 && m === 0))) {
    return {
      label: 'Abend-Deal',
      rabatt: '8%',
      code: 'ABEND8',
      endeStunde: 21,
      endeMinute: 0,
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      text: 'text-indigo-800 dark:text-indigo-200',
      border: 'border-indigo-300 dark:border-indigo-700',
    };
  }
  return null;
}

function sekundenBisEnde(now: Date, endeH: number, endeM: number): number {
  const ende = new Date(now);
  ende.setHours(endeH, endeM, 0, 0);
  return Math.max(0, Math.round((ende.getTime() - now.getTime()) / 1000));
}

function formatCountdown(sek: number): string {
  const h = Math.floor(sek / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1404AngebotsCountdownBanner() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted || dismissed) return null;

  const angebot = getAktuellesAngebot(now);
  if (!angebot) return null;

  const sek = sekundenBisEnde(now, angebot.endeStunde, angebot.endeMinute);
  if (sek <= 0) return null;

  const handleCopy = () => {
    try { navigator.clipboard.writeText(angebot.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', angebot.bg, angebot.border)}>
      <Tag className={cn('h-5 w-5 shrink-0', angebot.text)} />
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-bold', angebot.text)}>
          {angebot.label} — {angebot.rabatt} Rabatt
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <button
            onClick={handleCopy}
            className={cn(
              'font-mono text-xs font-bold px-2 py-0.5 rounded border transition-colors',
              copied
                ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                : cn(angebot.bg, angebot.border, angebot.text, 'hover:opacity-80')
            )}
          >
            {copied ? '✓ Kopiert!' : angebot.code}
          </button>
          <span className={cn('text-xs', angebot.text)}>
            Noch <span className="font-bold font-mono">{formatCountdown(sek)}</span>
          </span>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={cn('shrink-0 hover:opacity-60 transition-opacity', angebot.text)}
        aria-label="Schließen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
