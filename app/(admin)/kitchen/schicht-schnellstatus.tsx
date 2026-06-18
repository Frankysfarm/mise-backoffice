'use client';

/**
 * KitchenSchichtSchnellstatus — Kompaktes Sticky-Statusband für die Küche.
 *
 * Zeigt in Echtzeit den Schichtüberblick:
 *  - Aktive Bestellungen nach Phase (neu / in_zubereitung / fertig)
 *  - Heute abgeschlossene Bestellungen
 *  - Anzahl aktiver Fahrer
 *
 * Farbkodierung für "fertig"-Bestellungen (warten auf Abholung):
 *  🟢 Grün:  < 5 fertige
 *  🟡 Amber: 5–10 fertige
 *  🔴 Rot:   > 10 fertige
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Package, CheckCircle2, Bike, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
};

interface Props {
  orders: Order[];
  completedToday: number;
  activeDriverCount: number;
}

// ---------------------------------------------------------------------------
// useTick — forces re-render every second
// ---------------------------------------------------------------------------

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(isoTime: string | null): string {
  if (!isoTime) return '–';
  const elapsedSec = Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
  if (elapsedSec < 0) return '0:00';
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PhaseChipProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  colorClass: string;
  pulse?: boolean;
}

function PhaseChip({ icon, label, count, colorClass, pulse }: PhaseChipProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all',
        colorClass,
        pulse && 'animate-pulse',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="tabular-nums font-black text-sm">{count}</span>
      <span className="hidden sm:inline font-medium">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function KitchenSchichtSchnellstatus({
  orders,
  completedToday,
  activeDriverCount,
}: Props) {
  useTick();

  // Gruppiere nach Status
  const neu = orders.filter((o) => o.status === 'neu' || o.status === 'bestätigt');
  const inZubereitung = orders.filter((o) => o.status === 'in_zubereitung');
  const fertig = orders.filter((o) => o.status === 'fertig');

  const fertigCount = fertig.length;

  // Farbkodierung basierend auf wartenden "fertig"-Bestellungen
  const fertigColorClass =
    fertigCount > 10
      ? 'bg-red-100 text-red-700 border border-red-300'
      : fertigCount >= 5
      ? 'bg-amber-100 text-amber-700 border border-amber-300'
      : 'bg-matcha-100 text-matcha-700 border border-matcha-300';

  const fertigPulse = fertigCount > 10;

  // Längste wartende "fertig"-Bestellung
  const longestWaitingFertig = fertig
    .filter((o) => o.fertig_am)
    .sort(
      (a, b) =>
        new Date(a.fertig_am!).getTime() - new Date(b.fertig_am!).getTime(),
    )[0];

  const totalActive = neu.length + inZubereitung.length + fertig.length;

  return (
    <div
      className={cn(
        'sticky top-0 z-30 w-full border-b bg-white/95 backdrop-blur-sm shadow-sm transition-all duration-300',
        fertigCount > 10
          ? 'border-red-300'
          : fertigCount >= 5
          ? 'border-amber-300'
          : 'border-matcha-200',
      )}
    >
      <div className="mx-auto max-w-7xl px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Titel */}
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            <ChefHat
              className={cn(
                'h-4 w-4',
                fertigCount > 10
                  ? 'text-red-600'
                  : fertigCount >= 5
                  ? 'text-amber-600'
                  : 'text-matcha-600',
              )}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:inline">
              Schicht
            </span>
          </div>

          {/* Phasen-Chips */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {/* NEU */}
            <PhaseChip
              icon={<Zap className="h-3 w-3" />}
              label="Neu"
              count={neu.length}
              colorClass="bg-blue-100 text-blue-700 border border-blue-200"
            />

            {/* IN ZUBEREITUNG */}
            <PhaseChip
              icon={<ChefHat className="h-3 w-3" />}
              label="In Zubereitung"
              count={inZubereitung.length}
              colorClass="bg-orange-100 text-orange-700 border border-orange-200"
              pulse={inZubereitung.length > 0}
            />

            {/* FERTIG */}
            <PhaseChip
              icon={<Package className="h-3 w-3" />}
              label="Fertig"
              count={fertig.length}
              colorClass={fertigColorClass}
              pulse={fertigPulse}
            />

            {/* Trennstrich */}
            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            {/* Heute abgeschlossen */}
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
              <span className="tabular-nums font-bold text-foreground">{completedToday}</span>
              <span className="hidden sm:inline">heute</span>
            </div>

            {/* Aktive Fahrer */}
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Bike className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="tabular-nums font-bold text-foreground">{activeDriverCount}</span>
              <span className="hidden sm:inline">
                {activeDriverCount === 1 ? 'Fahrer' : 'Fahrer'}
              </span>
            </div>
          </div>

          {/* Rechts: Gesamt-Zähler + längste Wartezeit */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {longestWaitingFertig && (
              <div
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold',
                  fertigCount > 10
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span className="font-mono tabular-nums">
                  {formatElapsed(longestWaitingFertig.fertig_am)}
                </span>
                <span className="hidden sm:inline">max. Wartezeit</span>
              </div>
            )}

            {/* Gesamtanzahl aktiver Bestellungen */}
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black tabular-nums',
                totalActive === 0
                  ? 'bg-matcha-50 text-matcha-600'
                  : totalActive > 15
                  ? 'bg-red-500 text-white'
                  : 'bg-foreground text-background',
              )}
            >
              {totalActive}
              <span className="font-normal text-[10px] opacity-80 hidden sm:inline ml-0.5">aktiv</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
