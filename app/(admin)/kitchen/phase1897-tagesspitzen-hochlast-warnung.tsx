'use client';

/**
 * Phase 1897 — Tagesspitzen-Hochlast-Warnung (Kitchen)
 *
 * Echtzeitvergleich aktuelle Bestellrate vs. historischer Stoßzeit-Schwellwert.
 * Ampel grün/gelb/rot. Countdown zur nächsten Stoßzeit (12–13 Uhr, 18–20 Uhr).
 * useMemo für Performance. Collapsible (default offen). Props-basiert (kein Polling).
 */

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Flame, Clock } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  schwellwert_hoch?: number;
  schwellwert_warn?: number;
  className?: string;
}

// Stoßzeiten: 12–13 Uhr, 18–20 Uhr (lokale Zeit)
const STOSSZEITEN: { label: string; start: number; end: number }[] = [
  { label: 'Mittagsspitze', start: 12, end: 13 },
  { label: 'Abendspitze',   start: 18, end: 20 },
];

function naechsteStoßzeit(nowH: number): { label: string; minBis: number } | null {
  const today = new Date();
  for (const st of STOSSZEITEN) {
    if (nowH < st.start) {
      const target = new Date(today);
      target.setHours(st.start, 0, 0, 0);
      const minBis = Math.round((target.getTime() - today.getTime()) / 60_000);
      return { label: st.label, minBis };
    }
  }
  // morgen erste Stoßzeit
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(STOSSZEITEN[0].start, 0, 0, 0);
  const minBis = Math.round((tomorrow.getTime() - today.getTime()) / 60_000);
  return { label: STOSSZEITEN[0].label, minBis };
}

function ampelFarbe(rate: number, hoch: number, warn: number) {
  if (rate >= hoch) return 'rot';
  if (rate >= warn) return 'gelb';
  return 'gruen';
}

function countdownLabel(min: number): string {
  if (min <= 0) return 'Jetzt';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} Min`;
}

export function KitchenPhase1897TagesspitzenHochlastWarnung({
  orders,
  schwellwert_hoch = 8,
  schwellwert_warn = 5,
  className,
}: Props) {
  const [offen, setOffen]   = useState(true);
  const [now, setNow]       = useState<Date>(() => new Date());

  // 1-Min-Tick für Countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const cutoff = now.getTime() - 30 * 60_000;
    const recent = orders.filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= cutoff;
    });
    const rate30min = recent.length;
    const rateProStunde = rate30min * 2;

    const nowH = now.getHours();
    const istStoßzeit = STOSSZEITEN.some((st) => nowH >= st.start && nowH < st.end);
    const naechste = naechsteStoßzeit(nowH);
    const farbe = ampelFarbe(rate30min, schwellwert_hoch, schwellwert_warn);

    return { rate30min, rateProStunde, istStoßzeit, naechste, farbe };
  }, [orders, now, schwellwert_hoch, schwellwert_warn]);

  const AMPEL_BG: Record<string, string> = {
    gruen: 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800',
    gelb:  'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    rot:   'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  };
  const AMPEL_TEXT: Record<string, string> = {
    gruen: 'text-matcha-700 dark:text-matcha-300',
    gelb:  'text-amber-700 dark:text-amber-300',
    rot:   'text-red-700 dark:text-red-300',
  };
  const AMPEL_LABEL: Record<string, string> = {
    gruen: 'Normalbetrieb',
    gelb:  'Erhöhte Auslastung',
    rot:   'Hochlast — sofort reagieren',
  };
  const FLAMMEN: Record<string, number> = { gruen: 1, gelb: 2, rot: 3 };

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Flame className={cn('h-4 w-4 shrink-0', stats.farbe === 'rot' ? 'text-red-500' : stats.farbe === 'gelb' ? 'text-amber-500' : 'text-matcha-500')} />
        <span className="text-xs font-bold uppercase tracking-wider">Tagesspitzen-Hochlast</span>
        {stats.farbe !== 'gruen' && (
          <span className={cn(
            'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
            stats.farbe === 'rot'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
          )}>
            {stats.farbe === 'rot' ? '🔥 Hochlast' : '⚠ Erhöht'}
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-3 space-y-3">
          {/* Ampel-Banner */}
          <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', AMPEL_BG[stats.farbe])}>
            <div className="flex gap-0.5">
              {Array.from({ length: FLAMMEN[stats.farbe] }).map((_, i) => (
                <Flame key={i} className={cn('h-4 w-4', AMPEL_TEXT[stats.farbe])} />
              ))}
            </div>
            <div className="flex-1">
              <p className={cn('text-xs font-bold', AMPEL_TEXT[stats.farbe])}>
                {AMPEL_LABEL[stats.farbe]}
              </p>
              <p className={cn('text-[10px] mt-0.5', AMPEL_TEXT[stats.farbe])}>
                {stats.rate30min} Bestellungen in den letzten 30 Min
                {stats.istStoßzeit ? ' (Stoßzeit aktiv)' : ''}
              </p>
            </div>
            {stats.farbe === 'rot' && (
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Letzte 30 Min</p>
              <p className={cn('text-xl font-black tabular-nums mt-0.5', AMPEL_TEXT[stats.farbe])}>
                {stats.rate30min}
              </p>
              <p className="text-[9px] text-muted-foreground">Bestellungen</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Hochrechnung / h</p>
              <p className="text-xl font-black tabular-nums mt-0.5 text-foreground">
                {stats.rateProStunde}
              </p>
              <p className="text-[9px] text-muted-foreground">Bestellungen</p>
            </div>
          </div>

          {/* Schwellwerte */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-1">
            <span>
              <span className="font-semibold text-amber-600">Warnung:</span> ≥ {schwellwert_warn}
            </span>
            <span>
              <span className="font-semibold text-red-600">Hochlast:</span> ≥ {schwellwert_hoch}
            </span>
          </div>

          {/* Countdown nächste Stoßzeit */}
          {stats.naechste && !stats.istStoßzeit && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Nächste Stoßzeit ({stats.naechste.label}) in{' '}
                <strong className="text-foreground">{countdownLabel(stats.naechste.minBis)}</strong>
              </p>
            </div>
          )}
          {stats.istStoßzeit && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <Flame className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Stoßzeit aktiv — erhöhte Bestellrate erwartet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
