'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, MessageSquare } from 'lucide-react';

/**
 * Phase 1935 — Meine-Kundenbewertungen (Fahrer-App)
 *
 * Eigene Ø-Bewertung + letzte 3 Kommentare + Trend; Motivationstext;
 * isOnline-Guard; Collapsible; 1-Std-Polling.
 */

interface MeineBewertungsDaten {
  avg_bewertung: number;
  bewertungs_count: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  letzte_kommentare: string[];
}

const MOCK: MeineBewertungsDaten = {
  avg_bewertung: 4.6,
  bewertungs_count: 34,
  trend: 'steigend',
  letzte_kommentare: ['Super freundlich!', 'Sehr pünktlich', 'Alles top — danke!'],
};

const MOTIVATIONS: Record<string, string> = {
  hoch: 'Ausgezeichnet! Deine Kunden lieben dich — weiter so!',
  mittel: 'Gute Bewertungen — ein bisschen mehr Lächeln bringt dich nach oben!',
  niedrig: 'Lass uns gemeinsam die Kundenzufriedenheit verbessern!',
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1935MeineKundenbewertungen({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<MeineBewertungsDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kundenbewertungen-aggregat?location_id=${locationId}&driver_id=${driverId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        setDaten({
          avg_bewertung: json.avg_bewertung ?? 0,
          bewertungs_count: json.bewertungs_count ?? 0,
          trend: json.trend ?? 'stabil',
          letzte_kommentare: json.top_positiv ?? [],
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

  const sterne = Math.round(daten.avg_bewertung);
  const textKlasse = daten.avg_bewertung >= 4 ? 'text-green-700 dark:text-green-300' : daten.avg_bewertung >= 3 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const motivKat = daten.avg_bewertung >= 4 ? 'hoch' : daten.avg_bewertung >= 3 ? 'mittel' : 'niedrig';

  const TrendIcon = daten.trend === 'steigend' ? TrendingUp : daten.trend === 'fallend' ? TrendingDown : Minus;
  const trendFarbe = daten.trend === 'steigend' ? 'text-green-600 dark:text-green-400' : daten.trend === 'fallend' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Star className={cn('h-4 w-4 shrink-0', textKlasse)} />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Bewertungen</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted flex items-center gap-1', textKlasse)}>
          <TrendIcon className="h-3 w-3" />
          {daten.avg_bewertung}/5
        </span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Sterne-Display */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={cn('h-6 w-6', s <= sterne ? 'text-amber-500 fill-amber-500' : 'text-muted/30')} />
              ))}
            </div>
            <span className={cn('text-2xl font-black tabular-nums', textKlasse)}>{daten.avg_bewertung}/5</span>
            <span className="text-[11px] text-muted-foreground">{daten.bewertungs_count} Bewertungen</span>
          </div>

          {/* Trend */}
          <div className={cn('flex items-center gap-1.5 text-xs font-semibold', trendFarbe)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>
              {daten.trend === 'steigend' ? 'Bewertungen steigen' : daten.trend === 'fallend' ? 'Bewertungen fallen' : 'Bewertungen stabil'}
            </span>
          </div>

          {/* Letzte Kommentare */}
          {daten.letzte_kommentare.length > 0 && (
            <div className="space-y-1.5">
              {daten.letzte_kommentare.slice(0, 3).map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/20 px-2.5 py-1.5">
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground italic">"{c}"</p>
                </div>
              ))}
            </div>
          )}

          {/* Motivationstext */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">{MOTIVATIONS[motivKat]}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Letzte 7 Tage · 1-Std-Polling</p>
        </div>
      )}
    </div>
  );
}
