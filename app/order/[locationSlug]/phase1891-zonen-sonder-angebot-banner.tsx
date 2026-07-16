'use client';

/**
 * Phase 1891 — Zonen-Sonder-Angebot-Banner (Storefront)
 *
 * "Kostenlose Lieferung in Zone X bis HH:MM" — Aktions-Banner mit Countdown.
 * Daten aus /api/delivery/admin/zonen-umsatz-prognose (Phase 1883):
 *   Zone mit niedrigstem Volumen → Sonderangebot generiert.
 * Hydration-safe (mounted-Guard). Schließbar. 10-Min-Polling.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tag, X, Clock } from 'lucide-react';

interface ZonePrognose {
  zone: string;
  volumen_heute?: number;
  bestellungen_prognose: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

interface SonderAngebot {
  zone: string;
  bis_uhrzeit: string; // HH:MM
  bis_ts: number;
  rabatt_text: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const ZONE_LABEL: Record<string, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

function naechsteVolleStunde(offsetMin: number): { ts: number; label: string } {
  const now = new Date();
  const target = new Date(now.getTime() + offsetMin * 60 * 1000);
  target.setSeconds(0, 0);
  return {
    ts: target.getTime(),
    label: target.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return '00:00';
  const totalSec = Math.floor(msLeft / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1891ZonenSonderAngebotBanner({ locationId, className }: Props) {
  const [mounted, setMounted]       = useState(false);
  const [angebot, setAngebot]       = useState<SonderAngebot | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [countdown, setCountdown]   = useState('');

  // hydration-safe
  useEffect(() => { setMounted(true); }, []);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-umsatz-prognose?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = await res.json();
      const raw: ZonePrognose[] = json.zonen ?? [];
      if (raw.length === 0) return;

      // Zone mit niedrigstem prognostiziertem Volumen → Förderungszone
      const schwach = raw.reduce((min, z) =>
        z.bestellungen_prognose < min.bestellungen_prognose ? z : min,
        raw[0],
      );

      // Gültig bis: nächste 45–90 Min
      const offsetMin = 45 + Math.floor(schwach.bestellungen_prognose * 3);
      const { ts, label } = naechsteVolleStunde(Math.min(offsetMin, 90));

      setAngebot({
        zone: schwach.zone,
        bis_uhrzeit: label,
        bis_ts: ts,
        rabatt_text: 'Kostenlose Lieferung',
      });
    } catch {
      /* Silently ignore */
    }
  }, [locationId]);

  useEffect(() => {
    if (!mounted) return;
    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, laden]);

  // Countdown-Ticker
  useEffect(() => {
    if (!angebot) return;
    const tick = () => setCountdown(formatCountdown(angebot.bis_ts - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [angebot]);

  if (!mounted || !angebot || geschlossen) return null;

  const msLeft = angebot.bis_ts - Date.now();
  if (msLeft <= 0) return null;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-xl border border-matcha-300 dark:border-matcha-700',
        'bg-matcha-50 dark:bg-matcha-950/30 px-3 py-2.5',
        className,
      )}
    >
      <Tag className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-matcha-800 dark:text-matcha-200 leading-tight">
          {angebot.rabatt_text} in Zone {angebot.zone}{' '}
          <span className="font-normal text-matcha-700 dark:text-matcha-300">
            ({ZONE_LABEL[angebot.zone]})
          </span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-3 w-3 text-matcha-500" />
          <p className="text-xs text-matcha-700 dark:text-matcha-300">
            Noch{' '}
            <span className="font-mono font-bold">{countdown}</span>{' '}
            · bis {angebot.bis_uhrzeit} Uhr
          </p>
        </div>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="rounded-full p-0.5 hover:bg-matcha-200 dark:hover:bg-matcha-800 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-matcha-600 dark:text-matcha-400" />
      </button>
    </div>
  );
}
