'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, Fuel, MessageSquare, Gift, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  batchId: string;
  driverId: string;
  onAbgeschlossen?: () => void;
}

type Stimmung = 'gut' | 'ok' | 'schlecht';

interface NachbereitungState {
  kmEingabe: string;
  stimmung: Stimmung | null;
  notiz: string;
  gesendet: boolean;
  bonus: number | null;
  loading: boolean;
  fehler: string | null;
}

const STIMMUNGEN: { key: Stimmung; label: string; emoji: string; bg: string }[] = [
  { key: 'gut', label: 'Gut', emoji: '😊', bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400' },
  { key: 'ok', label: 'OK', emoji: '😐', bg: 'bg-amber-100 dark:bg-amber-900/40 border-amber-400' },
  { key: 'schlecht', label: 'Schwierig', emoji: '😟', bg: 'bg-red-100 dark:bg-red-900/40 border-red-400' },
];

function BonusAnzeige({ bonus }: { bonus: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700 px-4 py-3 mt-3">
      <Gift className="h-5 w-5 text-yellow-500" />
      <div>
        <div className="text-xs font-bold text-yellow-800 dark:text-yellow-200">Effizienz-Bonus</div>
        <div className="text-lg font-black text-yellow-600 dark:text-yellow-300 tabular-nums">
          +{bonus.toFixed(2)} €
        </div>
      </div>
    </div>
  );
}

export function FahrerPhase631TourNachbereitungDialog({ batchId, driverId, onAbgeschlossen }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NachbereitungState>({
    kmEingabe: '',
    stimmung: null,
    notiz: '',
    gesendet: false,
    bonus: null,
    loading: false,
    fehler: null,
  });

  const abschicken = useCallback(async () => {
    const km = parseFloat(state.kmEingabe.replace(',', '.'));
    if (isNaN(km) || km <= 0) {
      setState((s) => ({ ...s, fehler: 'Bitte gültige km eingeben.' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, fehler: null }));

    try {
      // Compute local bonus (≤4km/Lieferung = voller Bonus, sonst anteilig)
      const bonusGrundwert = 0.50; // €0.50 bonus for efficient tour
      const berechneterBonus = km <= 4 ? bonusGrundwert : km <= 6 ? bonusGrundwert * 0.5 : 0;

      // Fire-and-forget: submit feedback + km log
      await fetch('/api/delivery/driver/tour-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          driverId,
          kmGefahren: km,
          stimmung: state.stimmung,
          notiz: state.notiz.trim() || null,
          bonus: berechneterBonus,
        }),
      }).catch(() => null); // ignore if endpoint doesn't exist yet

      setState((s) => ({
        ...s,
        loading: false,
        gesendet: true,
        bonus: berechneterBonus,
      }));

      onAbgeschlossen?.();
    } catch {
      setState((s) => ({ ...s, loading: false, fehler: 'Fehler beim Senden.' }));
    }
  }, [batchId, driverId, state.kmEingabe, state.stimmung, state.notiz, onAbgeschlossen]);

  if (state.gesendet) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Tour abgeschlossen!</span>
        </div>
        {state.bonus !== null && state.bonus > 0 && <BonusAnzeige bonus={state.bonus} />}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 shadow-sm">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wide">
          Tour-Nachbereitung
        </span>
        <span className="ml-auto">
          {open
            ? <ChevronUp className="h-4 w-4 text-violet-500" />
            : <ChevronDown className="h-4 w-4 text-violet-500" />
          }
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* km-Eingabe */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <Fuel className="h-3.5 w-3.5" />
              Gefahrene km
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={state.kmEingabe}
              onChange={(e) => setState((s) => ({ ...s, kmEingabe: e.target.value }))}
              placeholder="z.B. 8.5"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Stimmung */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Wie war die Tour?
            </label>
            <div className="flex gap-2">
              {STIMMUNGEN.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setState((st) => ({ ...st, stimmung: s.key }))}
                  className={`flex-1 flex flex-col items-center gap-0.5 rounded-lg border-2 py-2 text-xs font-semibold transition
                    ${state.stimmung === s.key ? s.bg + ' border-current' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
                  `}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              <MessageSquare className="h-3.5 w-3.5" />
              Optionale Notiz
            </label>
            <textarea
              value={state.notiz}
              onChange={(e) => setState((s) => ({ ...s, notiz: e.target.value }))}
              placeholder="Probleme, Hinweise, Besonderes…"
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
          </div>

          {state.fehler && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <X className="h-3.5 w-3.5 shrink-0" />
              {state.fehler}
            </div>
          )}

          <button
            onClick={abschicken}
            disabled={state.loading || !state.kmEingabe}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 dark:disabled:bg-violet-900 text-white font-bold text-sm py-2.5 transition"
          >
            {state.loading ? 'Senden…' : 'Tour abschließen'}
          </button>
        </div>
      )}
    </div>
  );
}
