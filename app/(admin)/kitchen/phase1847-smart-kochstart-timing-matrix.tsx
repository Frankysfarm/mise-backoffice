'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Flame, Clock, Target, Zap, AlertTriangle } from 'lucide-react';

/**
 * Phase 1847 — Smart-Kochstart-Timing-Matrix (Kitchen)
 *
 * Stellt alle aktiven Bestellungen in einer 2D-Matrix aus:
 * X-Achse: Verbleibende Zeit bis ETA (Fahrer-Ankunft)
 * Y-Achse: Komplexität (Anzahl Positionen × Ø-Zubereitungszeit)
 * Farbkodierung: grün >15 Min / gelb 8–15 Min / rot <8 Min / pulsierend rot <5 Min
 * Empfiehlt die optimale Kochstart-Reihenfolge.
 */

interface BestellPosition {
  name: string;
  prep_min?: number | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  created_at: string;
  estimated_prep_minutes?: number | null;
  items?: BestellPosition[] | null;
  driver_eta_minutes?: number | null;
}

interface MatrixEintrag {
  id: string;
  nummer: string;
  verbleibend_min: number;
  komplexitaet: number;
  ampel: 'gruen' | 'gelb' | 'rot' | 'kritisch';
  empfohlener_start_in: number;
  positionen: number;
}

function berechneMatrixEintraege(orders: Order[]): MatrixEintrag[] {
  const aktiv = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
  );

  return aktiv
    .map((o) => {
      const etaMin = o.driver_eta_minutes ?? 18;
      const prepMin = o.estimated_prep_minutes ?? 12;
      const positionen = o.items?.length ?? 1;
      const komplexitaet = Math.min(10, Math.round((positionen * (prepMin / 8)) * 2));
      const verbleibend = Math.max(0, etaMin - prepMin);
      const empfStart = Math.max(0, verbleibend - 2);

      let ampel: MatrixEintrag['ampel'];
      if (verbleibend < 5) ampel = 'kritisch';
      else if (verbleibend < 8) ampel = 'rot';
      else if (verbleibend < 15) ampel = 'gelb';
      else ampel = 'gruen';

      return {
        id: o.id,
        nummer: o.bestellnummer ?? o.id.slice(-4).toUpperCase(),
        verbleibend_min: verbleibend,
        komplexitaet,
        ampel,
        empfohlener_start_in: empfStart,
        positionen,
      };
    })
    .sort((a, b) => a.verbleibend_min - b.verbleibend_min);
}

const AMPEL_STYLE: Record<MatrixEintrag['ampel'], { bg: string; border: string; text: string; dot: string; label: string }> = {
  kritisch: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    border: 'border-red-400',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500 animate-pulse',
    label: 'KRITISCH',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-300',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Dringend',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-300',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-400',
    label: 'Bald starten',
  },
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    border: 'border-matcha-300',
    text: 'text-matcha-700 dark:text-matcha-400',
    dot: 'bg-matcha-500',
    label: 'Zeit vorhanden',
  },
};

interface Props {
  orders: Order[];
  className?: string;
}

export function KitchenPhase1847SmartKochstartTimingMatrix({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);
  const [jetzt, setJetzt] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setJetzt(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const eintraege = useMemo(() => berechneMatrixEintraege(orders), [orders, jetzt]);

  const zusammenfassung = useMemo(() => ({
    kritisch: eintraege.filter((e) => e.ampel === 'kritisch').length,
    rot: eintraege.filter((e) => e.ampel === 'rot').length,
    gelb: eintraege.filter((e) => e.ampel === 'gelb').length,
    gruen: eintraege.filter((e) => e.ampel === 'gruen').length,
  }), [eintraege]);

  const hasDringend = zusammenfassung.kritisch > 0 || zusammenfassung.rot > 0;

  if (eintraege.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors',
          hasDringend && 'bg-red-50/50 dark:bg-red-950/10',
        )}
      >
        <Target className={cn('h-4 w-4 shrink-0', hasDringend ? 'text-red-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">Kochstart-Timing-Matrix</span>
        {hasDringend && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            <AlertTriangle className="h-2.5 w-2.5" />
            {zusammenfassung.kritisch + zusammenfassung.rot} Dringend
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {(['kritisch', 'rot', 'gelb', 'gruen'] as const).map((ampel) =>
            zusammenfassung[ampel] > 0 ? (
              <span
                key={ampel}
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-black',
                  AMPEL_STYLE[ampel].bg,
                  AMPEL_STYLE[ampel].text,
                )}
              >
                {zusammenfassung[ampel]}
              </span>
            ) : null,
          )}
          {offen ? (
            <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-2">
          {/* Empfehlung */}
          {eintraege[0] && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                Nächster Kochstart: <span className="font-black">#{eintraege[0].nummer}</span>
                {eintraege[0].empfohlener_start_in > 0
                  ? ` in ${eintraege[0].empfohlener_start_in} Min`
                  : ' — JETZT STARTEN'}
              </p>
            </div>
          )}

          {/* Matrix-Einträge */}
          <div className="space-y-1.5">
            {eintraege.map((e, idx) => {
              const cfg = AMPEL_STYLE[e.ampel];
              return (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2',
                    cfg.bg,
                    cfg.border,
                  )}
                >
                  {/* Rang */}
                  <span className="w-5 shrink-0 text-center text-[10px] font-black text-muted-foreground">
                    {idx + 1}.
                  </span>

                  {/* Ampel-Dot */}
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />

                  {/* Bestellnummer + Positionen */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black">#{e.nummer}</span>
                      <span className={cn('text-[9px] font-bold', cfg.text)}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted-foreground">
                      <span>{e.positionen} {e.positionen === 1 ? 'Position' : 'Positionen'}</span>
                      <span>Kompl. {e.komplexitaet}/10</span>
                    </div>
                  </div>

                  {/* Verbleibend */}
                  <div className="shrink-0 text-right">
                    <div className={cn('text-sm font-black tabular-nums', cfg.text)}>
                      {e.verbleibend_min} Min
                    </div>
                    <div className="text-[9px] text-muted-foreground">bis ETA</div>
                  </div>

                  {/* Kochstart-Empfehlung */}
                  <div className="shrink-0 text-right min-w-[52px]">
                    {e.empfohlener_start_in <= 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
                        <Flame className="h-2.5 w-2.5" /> JETZT
                      </span>
                    ) : (
                      <span className={cn('text-[9px] font-bold', cfg.text)}>
                        <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                        in {e.empfohlener_start_in} Min
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground text-right">
            Aktualisiert alle 30 Sek · ETA-Daten aus Fahrer-GPS
          </p>
        </div>
      )}
    </div>
  );
}
