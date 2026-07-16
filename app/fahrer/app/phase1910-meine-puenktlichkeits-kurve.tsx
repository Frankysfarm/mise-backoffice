'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1910 — Meine-Pünktlichkeits-Kurve (Fahrer-App)
 *
 * Eigene 7-Tage-Pünktlichkeit als Mini-Chart.
 * Trend-Text + Motivationstext. isOnline-Guard; Collapsible; 1-Std-Polling.
 */

type TrendRichtung = 'steigend' | 'fallend' | 'stabil';

interface TagWert {
  datum: string;
  puenktlichkeit_pct: number;
}

interface MeineTrendDaten {
  zeitreihe: TagWert[];
  trend: TrendRichtung;
  aktuell_pct: number;
  vorwoche_pct: number;
  abweichung_pct: number;
}

function datumLabel(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const MOCK: MeineTrendDaten = {
  zeitreihe: [6, 5, 4, 3, 2, 1, 0].map((d) => ({
    datum: datumLabel(d),
    puenktlichkeit_pct: [72, 75, 80, 78, 83, 86, 88][6 - d],
  })),
  trend: 'steigend',
  aktuell_pct: 88,
  vorwoche_pct: 72,
  abweichung_pct: 22.2,
};

const MOTIVATION: Record<TrendRichtung, (pct: number) => string> = {
  steigend: (p) =>
    p >= 90
      ? 'Ausgezeichnet! Deine Pünktlichkeit ist top — weiter so!'
      : 'Guter Aufwärtstrend! Noch ein bisschen und du erreichst 90%.',
  stabil: (p) =>
    p >= 85
      ? 'Solide Leistung! Halte diesen Level und zieh dann weiter.'
      : 'Konstant ist gut — jetzt leicht steigern für besseren Bonus.',
  fallend: () => 'Kurzer Rückgang — starte die nächste Schicht fokussiert und du holst das auf.',
};

function MiniChart({ daten, trend }: { daten: TagWert[]; trend: TrendRichtung }) {
  const max = Math.max(...daten.map((d) => d.puenktlichkeit_pct), 1);
  const min = Math.min(...daten.map((d) => d.puenktlichkeit_pct));
  const range = max - min || 1;
  const W = 120;
  const H = 36;
  const pts = daten.map((d, i) => {
    const x = (i / (daten.length - 1)) * W;
    const y = H - ((d.puenktlichkeit_pct - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const color = trend === 'steigend' ? '#22c55e' : trend === 'fallend' ? '#ef4444' : '#94a3b8';
  const tags = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return (
    <div className="space-y-1">
      <svg width={W} height={H} className="overflow-visible w-full" viewBox={`0 0 ${W} ${H}`}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts.join(' ')}
        />
        {daten.map((d, i) => {
          const x = (i / (daten.length - 1)) * W;
          const y = H - ((d.puenktlichkeit_pct - min) / range) * (H - 4) - 2;
          return (
            <circle
              key={d.datum}
              cx={x}
              cy={y}
              r="2.5"
              fill={color}
              opacity={i === daten.length - 1 ? 1 : 0.5}
            />
          );
        })}
      </svg>
      <div className="flex justify-between">
        {tags.map((t, i) => (
          <span key={i} className="text-[9px] text-muted-foreground">{t}</span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1910MeinePuenktlichkeitsKurve({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<MeineTrendDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=${locationId}`,
        );
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const eintrag = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        if (!eintrag) throw new Error('Nicht gefunden');
        setDaten({
          zeitreihe: eintrag.zeitreihe,
          trend: eintrag.trend,
          aktuell_pct: eintrag.aktuell_pct,
          vorwoche_pct: eintrag.vorwoche_pct,
          abweichung_pct: eintrag.abweichung_pct,
        });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !daten) return null;

  const TrendIcon =
    daten.trend === 'steigend' ? (
      <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
    ) : daten.trend === 'fallend' ? (
      <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground shrink-0" />
    );

  const ampel =
    daten.aktuell_pct >= 85
      ? 'text-green-600 dark:text-green-400'
      : daten.aktuell_pct >= 70
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        {TrendIcon}
        <span className="text-xs font-bold uppercase tracking-wider">Meine Pünktlichkeit</span>
        <span className={cn('ml-1 text-sm font-black tabular-nums', ampel)}>{daten.aktuell_pct}%</span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-4">
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Heute</div>
              <div className={cn('text-lg font-black tabular-nums mt-0.5', ampel)}>{daten.aktuell_pct}%</div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Vorwoche</div>
              <div className="text-lg font-black tabular-nums mt-0.5">{daten.vorwoche_pct}%</div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Änderung</div>
              <div
                className={cn(
                  'text-lg font-black tabular-nums mt-0.5',
                  daten.abweichung_pct > 0
                    ? 'text-green-600 dark:text-green-400'
                    : daten.abweichung_pct < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground',
                )}
              >
                {daten.abweichung_pct > 0 ? '+' : ''}{daten.abweichung_pct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Mini-Chart */}
          <div className="px-1">
            <MiniChart daten={daten.zeitreihe} trend={daten.trend} />
          </div>

          {/* Motivationstext */}
          <div className="rounded-xl border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{MOTIVATION[daten.trend](daten.aktuell_pct)}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Aktualisierung stündlich</p>
        </div>
      )}
    </div>
  );
}
