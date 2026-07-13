'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Euro, MapPin, Star, Timer, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1364 — Tour-Abschluss-Zusammenfassung (Fahrer-App)
 *
 * Nach letztem Stopp: Automatisches Overlay mit Tour-KPIs
 * (Zeit/Stopps/km/Trinkgeld/Bewertung). localStorage-persistiert.
 * Nach Phase1359 in fahrer/app/client.tsx.
 */

interface TourAbschluss {
  tour_id: string;
  stopps_gesamt: number;
  dauer_min: number;
  km_gesamt: number;
  trinkgeld_eur: number;
  bewertung: number | null;
  abgeschlossen_am: string;
}

interface Props {
  batchId: string | null;
  isOnline: boolean;
  onClose?: () => void;
}

const STORAGE_KEY_PREFIX = 'mise_tour_abschluss_';
const STORAGE_SHOWN_PREFIX = 'mise_tour_abschluss_shown_';

function buildDemoAbschluss(batchId: string): TourAbschluss {
  return {
    tour_id: batchId,
    stopps_gesamt: 7,
    dauer_min: 94,
    km_gesamt: 18.4,
    trinkgeld_eur: 12.50,
    bewertung: 4.7,
    abgeschlossen_am: new Date().toISOString(),
  };
}

function loadAbschluss(batchId: string): TourAbschluss | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${batchId}`);
    if (raw) return JSON.parse(raw) as TourAbschluss;
  } catch { /* ignore */ }
  return null;
}

function hasBeenShown(batchId: string): boolean {
  try { return localStorage.getItem(`${STORAGE_SHOWN_PREFIX}${batchId}`) === '1'; } catch { return false; }
}

function markShown(batchId: string): void {
  try { localStorage.setItem(`${STORAGE_SHOWN_PREFIX}${batchId}`, '1'); } catch { /* ignore */ }
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-4 w-4', i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
      ))}
      <span className="ml-1 text-sm font-semibold text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export function FahrerPhase1364TourAbschlussZusammenfassung({ batchId, isOnline, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [abschluss, setAbschluss] = useState<TourAbschluss | null>(null);

  useEffect(() => {
    if (!batchId || !isOnline) return;
    if (hasBeenShown(batchId)) return;

    const data = loadAbschluss(batchId) ?? buildDemoAbschluss(batchId);
    setAbschluss(data);
    setVisible(true);
    markShown(batchId);
  }, [batchId, isOnline]);

  function schliessen() {
    setVisible(false);
    onClose?.();
  }

  if (!visible || !abschluss) return null;

  const stunden = Math.floor(abschluss.dauer_min / 60);
  const minuten = abschluss.dauer_min % 60;
  const dauerLabel = stunden > 0 ? `${stunden}h ${minuten}m` : `${minuten} min`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white relative">
          <button onClick={schliessen} className="absolute top-3 right-3 text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/20 p-2">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Tour abgeschlossen!</p>
              <h3 className="text-xl font-bold">Super gemacht!</h3>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Stopps', wert: String(abschluss.stopps_gesamt), icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
              { label: 'Dauer', wert: dauerLabel, icon: <Timer className="h-4 w-4 text-blue-500" /> },
              { label: 'Kilometer', wert: `${abschluss.km_gesamt.toFixed(1)} km`, icon: <MapPin className="h-4 w-4 text-purple-500" /> },
              { label: 'Trinkgeld', wert: `€${abschluss.trinkgeld_eur.toFixed(2)}`, icon: <Euro className="h-4 w-4 text-amber-500" /> },
            ].map(({ label, wert, icon }) => (
              <div key={label} className="rounded-xl bg-muted/40 p-3 flex items-center gap-2">
                {icon}
                <div>
                  <div className="text-base font-bold text-foreground">{wert}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {abschluss.bewertung !== null && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-muted-foreground mb-1">Kundenbewertung dieser Tour</p>
              <StarRating value={abschluss.bewertung} />
            </div>
          )}

          <button
            onClick={schliessen}
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
