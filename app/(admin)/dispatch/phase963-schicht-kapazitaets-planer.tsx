'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, Plus, Minus, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 963 — Schicht-Kapazitäts-Planer (Dispatch)
 *
 * Interaktives Board: Fahrer hinzufügen/entfernen + Kapazitätsprognose für nächste 2 Stunden.
 * Prognose: Bestellvolumen (historisch) vs. Fahrer-Kapazität.
 */

interface Props {
  locationId: string | null;
}

interface FahrerSlot {
  id: string;
  name: string;
  typ: 'aktiv' | 'geplant' | 'frei';
  stoppsProStunde: number;
}

interface StundenPrognose {
  stunde: string;
  prognoseBestellungen: number;
  kapazitaetStopps: number;
  auslastungPct: number;
  status: 'ok' | 'eng' | 'ueberlastet';
}

const MOCK_FAHRER: FahrerSlot[] = [
  { id: 'f1', name: 'Max K.', typ: 'aktiv', stoppsProStunde: 4 },
  { id: 'f2', name: 'Anna S.', typ: 'aktiv', stoppsProStunde: 5 },
  { id: 'f3', name: 'Tom W.', typ: 'geplant', stoppsProStunde: 4 },
];

const NEUE_FAHRER_NAMEN = ['Leon B.', 'Sara M.', 'Felix H.', 'Julia R.', 'Kai P.'];

function berechnePrognose(fahrer: FahrerSlot[]): StundenPrognose[] {
  const now = new Date();
  const prognosen: StundenPrognose[] = [];
  const aktiveFahrer = fahrer.filter(f => f.typ !== 'frei');
  const gesamtKapazitaet = aktiveFahrer.reduce((s, f) => s + f.stoppsProStunde, 0);

  // Simuliertes Bestellvolumen je Stunde (Peak-Muster)
  const stundeBasis = now.getHours();
  const prognoseVolumen: Record<number, number> = {
    11: 12, 12: 18, 13: 20, 14: 15, 17: 14, 18: 22, 19: 25, 20: 18, 21: 10,
  };

  for (let i = 0; i < 2; i++) {
    const stunde = (stundeBasis + i) % 24;
    const prognoseBestellungen = prognoseVolumen[stunde] ?? Math.round(8 + Math.random() * 8);
    const auslastungPct = gesamtKapazitaet > 0
      ? Math.round((prognoseBestellungen / gesamtKapazitaet) * 100)
      : 100;

    prognosen.push({
      stunde: `${String(stunde).padStart(2, '0')}:00–${String((stunde + 1) % 24).padStart(2, '0')}:00`,
      prognoseBestellungen,
      kapazitaetStopps: gesamtKapazitaet,
      auslastungPct,
      status: auslastungPct >= 90 ? 'ueberlastet' : auslastungPct >= 70 ? 'eng' : 'ok',
    });
  }

  return prognosen;
}

export function DispatchPhase963SchichtKapazitaetsPlaner({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [fahrer, setFahrer] = useState<FahrerSlot[]>(MOCK_FAHRER);
  const [neuerFahrerIdx, setNeuerFahrerIdx] = useState(0);

  const prognose = berechnePrognose(fahrer);
  const aktivCount = fahrer.filter(f => f.typ !== 'frei').length;

  const fahrerHinzufuegen = useCallback(() => {
    const name = NEUE_FAHRER_NAMEN[neuerFahrerIdx % NEUE_FAHRER_NAMEN.length];
    setNeuerFahrerIdx(i => i + 1);
    setFahrer(prev => [
      ...prev,
      { id: `neu-${Date.now()}`, name, typ: 'geplant', stoppsProStunde: 4 },
    ]);
  }, [neuerFahrerIdx]);

  const fahrerEntfernen = useCallback((id: string) => {
    setFahrer(prev => prev.filter(f => f.id !== id));
  }, []);

  const typFarbe = (typ: FahrerSlot['typ']) => {
    if (typ === 'aktiv') return 'bg-matcha-100 border-matcha-300 dark:bg-matcha-900/30 dark:border-matcha-700';
    if (typ === 'geplant') return 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700';
    return 'bg-zinc-100 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700';
  };

  const statusFarbe = (status: StundenPrognose['status']) => {
    if (status === 'ueberlastet') return 'text-red-600 dark:text-red-400';
    if (status === 'eng') return 'text-amber-600 dark:text-amber-400';
    return 'text-matcha-700 dark:text-matcha-300';
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-4">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            Schicht-Kapazitäts-Planer
          </span>
          <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
            {aktivCount} Fahrer aktiv
          </span>
          {prognose.some(p => p.status === 'ueberlastet') && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
              Überlast erwartet
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Fahrer-Liste */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fahrer</span>
              <button
                onClick={fahrerHinzufuegen}
                className="flex items-center gap-1 rounded-lg border border-matcha-300 bg-matcha-50 px-2 py-1 text-xs font-medium text-matcha-700 hover:bg-matcha-100 transition"
              >
                <Plus className="h-3 w-3" /> Fahrer planen
              </button>
            </div>
            <div className="space-y-1.5">
              {fahrer.map(f => (
                <div
                  key={f.id}
                  className={cn('flex items-center justify-between rounded-lg border px-3 py-2 text-sm', typFarbe(f.typ))}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs',
                      f.typ === 'aktiv' && 'bg-matcha-200 text-matcha-800',
                      f.typ === 'geplant' && 'bg-blue-200 text-blue-800',
                    )}>
                      {f.typ === 'aktiv' ? 'Aktiv' : 'Geplant'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{f.stoppsProStunde} Stopps/h</span>
                    <button
                      onClick={() => fahrerEntfernen(f.id)}
                      className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 transition"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {fahrer.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Keine Fahrer eingeplant</p>
              )}
            </div>
          </div>

          {/* Kapazitätsprognose */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prognose nächste 2h</span>
            </div>
            <div className="space-y-2">
              {prognose.map(p => (
                <div key={p.stunde} className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{p.stunde}</span>
                    <span className={cn('text-xs font-bold', statusFarbe(p.status))}>
                      {p.auslastungPct}% {p.status === 'ueberlastet' ? '⚠ Überlast' : p.status === 'eng' ? '⚡ Eng' : '✓ OK'}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        p.status === 'ueberlastet' ? 'bg-red-500' : p.status === 'eng' ? 'bg-amber-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${Math.min(p.auslastungPct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>{p.prognoseBestellungen} Bestellungen erwartet</span>
                    <span>Kapazität: {p.kapazitaetStopps} Stopps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {prognose.some(p => p.status !== 'ok') && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Empfehlung: Zusätzlichen Fahrer einplanen um Auslastungsspitzen abzufangen.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
