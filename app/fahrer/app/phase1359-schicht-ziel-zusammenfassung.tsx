'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Euro, MapPin, Star, Target, Timer, TrendingUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1359 — Schicht-Ziel-Zusammenfassung (Fahrer-App)
 *
 * Schicht-Ende-Panel: Stopps, Einnahmen, Trinkgeld, Pünktlichkeit vs. Ziele.
 * localStorage-basiert + isOnline-Guard.
 * Nach Phase1354 in fahrer/app/client.tsx.
 */

interface SchichtDaten {
  stopps_abgeschlossen: number;
  stopps_ziel: number;
  einnahmen_eur: number;
  einnahmen_ziel_eur: number;
  trinkgeld_eur: number;
  trinkgeld_ziel_eur: number;
  puenktlich_pct: number;
  puenktlich_ziel_pct: number;
  schicht_dauer_min: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
  onClose?: () => void;
}

const STORAGE_PREFIX = 'mise_schicht_daten_';

function loadSchichtDaten(driverId: string): SchichtDaten {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${driverId}`);
    if (raw) return JSON.parse(raw) as SchichtDaten;
  } catch {
    // ignore
  }
  // Platzhalter-Demo-Daten
  return {
    stopps_abgeschlossen: 9,
    stopps_ziel: 12,
    einnahmen_eur: 87.50,
    einnahmen_ziel_eur: 100,
    trinkgeld_eur: 14.20,
    trinkgeld_ziel_eur: 10,
    puenktlich_pct: 78,
    puenktlich_ziel_pct: 85,
    schicht_dauer_min: 360,
  };
}

interface ZielKachel {
  label: string;
  ist: string;
  ziel: string;
  pct: number;
  erreicht: boolean;
  icon: React.ReactNode;
}

export function FahrerPhase1359SchichtZielZusammenfassung({ driverId, isOnline, onClose }: Props) {
  const [daten, setDaten] = useState<SchichtDaten | null>(null);
  const [sichtbar, setSichtbar] = useState(true);

  useEffect(() => {
    setDaten(loadSchichtDaten(driverId));
  }, [driverId]);

  const kacheln = useMemo<ZielKachel[]>(() => {
    if (!daten) return [];
    return [
      {
        label: 'Stopps',
        ist: String(daten.stopps_abgeschlossen),
        ziel: String(daten.stopps_ziel),
        pct: Math.round((daten.stopps_abgeschlossen / Math.max(1, daten.stopps_ziel)) * 100),
        erreicht: daten.stopps_abgeschlossen >= daten.stopps_ziel,
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        label: 'Einnahmen',
        ist: `${daten.einnahmen_eur.toFixed(0)} €`,
        ziel: `${daten.einnahmen_ziel_eur.toFixed(0)} €`,
        pct: Math.round((daten.einnahmen_eur / Math.max(1, daten.einnahmen_ziel_eur)) * 100),
        erreicht: daten.einnahmen_eur >= daten.einnahmen_ziel_eur,
        icon: <Euro className="h-4 w-4" />,
      },
      {
        label: 'Trinkgeld',
        ist: `${daten.trinkgeld_eur.toFixed(0)} €`,
        ziel: `${daten.trinkgeld_ziel_eur.toFixed(0)} €`,
        pct: Math.round((daten.trinkgeld_eur / Math.max(1, daten.trinkgeld_ziel_eur)) * 100),
        erreicht: daten.trinkgeld_eur >= daten.trinkgeld_ziel_eur,
        icon: <Star className="h-4 w-4" />,
      },
      {
        label: 'Pünktlichkeit',
        ist: `${daten.puenktlich_pct} %`,
        ziel: `${daten.puenktlich_ziel_pct} %`,
        pct: Math.round((daten.puenktlich_pct / Math.max(1, daten.puenktlich_ziel_pct)) * 100),
        erreicht: daten.puenktlich_pct >= daten.puenktlich_ziel_pct,
        icon: <Timer className="h-4 w-4" />,
      },
    ];
  }, [daten]);

  const gesamtErreicht = kacheln.filter(k => k.erreicht).length;
  const schichtStunden = daten ? Math.floor(daten.schicht_dauer_min / 60) : 0;
  const schichtMin = daten ? daten.schicht_dauer_min % 60 : 0;

  const handleSchliessen = () => {
    setSichtbar(false);
    onClose?.();
  };

  if (!sichtbar || !daten) return null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-card p-5 space-y-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2.5">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold">Schicht abgeschlossen!</p>
          <p className="text-[11px] text-muted-foreground">
            Dauer: {schichtStunden}h {schichtMin}min
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-primary">{gesamtErreicht}/4</p>
          <p className="text-[10px] text-muted-foreground">Ziele erreicht</p>
        </div>
      </div>

      {/* Gesamt-Score */}
      <div className="rounded-xl bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground">Gesamt-Fortschritt</span>
          <span className="text-sm font-bold text-foreground">{Math.round(kacheln.reduce((s, k) => s + Math.min(100, k.pct), 0) / 4)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.round(kacheln.reduce((s, k) => s + Math.min(100, k.pct), 0) / 4))}%` }}
          />
        </div>
      </div>

      {/* Ziel-Kacheln */}
      <div className="grid grid-cols-2 gap-2">
        {kacheln.map(k => (
          <div key={k.label} className={cn(
            'rounded-xl border px-3 py-2.5 space-y-1.5',
            k.erreicht
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
              : 'border-border bg-muted/20'
          )}>
            <div className="flex items-center gap-1.5">
              <span className={cn(k.erreicht ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                {k.icon}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{k.label}</span>
              {k.erreicht
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                : <XCircle className="h-3.5 w-3.5 text-red-400 ml-auto" />}
            </div>
            <div>
              <p className="text-lg font-black tabular-nums leading-none text-foreground">{k.ist}</p>
              <p className="text-[10px] text-muted-foreground">Ziel: {k.ziel}</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', k.erreicht ? 'bg-green-500' : 'bg-primary/50')}
                style={{ width: `${Math.min(100, k.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Motivation */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[11px] text-foreground">
          {gesamtErreicht === 4
            ? 'Perfekte Schicht! Alle Ziele erreicht 🎉'
            : gesamtErreicht >= 3
            ? 'Starke Schicht! Fast alle Ziele geschafft 💪'
            : gesamtErreicht >= 2
            ? 'Gute Leistung! Weiter so 👍'
            : 'Morgen wieder — jeder Tag ist ein neuer Start!'}
        </p>
      </div>

      {/* Schließen */}
      <button
        onClick={handleSchliessen}
        className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold hover:opacity-90 transition"
      >
        Schicht beenden
      </button>

      {!isOnline && (
        <p className="text-center text-[10px] text-amber-600 dark:text-amber-400">
          Offline — Daten werden bei Verbindung synchronisiert
        </p>
      )}
    </div>
  );
}
