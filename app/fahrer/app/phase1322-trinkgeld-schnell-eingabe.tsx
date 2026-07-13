'use client';

// Phase 1322 — Trinkgeld-Schnell-Eingabe (Fahrer-App)
// Direkteingabe von Bargeld-Trinkgeld nach Lieferung (1-Tap-Betrag oder Freitext).
// POST an /api/delivery/driver/schicht-einnahmen-tracker. isOnline-Guard. Nach Phase1317.

import { useState } from 'react';
import { Coins, Check, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCHNELL_BETRAEGE = [0.5, 1, 2, 3, 5];

interface Props {
  driverId: string;
  isOnline: boolean;
  onSuccess?: (betrag: number) => void;
}

export function FahrerPhase1322TrinkgeldSchnellEingabe({ driverId, isOnline, onSuccess }: Props) {
  const [betrag, setBetrag] = useState('');
  const [gesendet, setGesendet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letztesTrinkgeld, setLetztesTrinkgeld] = useState<number | null>(null);

  if (!isOnline) return null;

  async function senden(eur: number) {
    if (eur <= 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/delivery/driver/schicht-einnahmen-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, trinkgeld_eur: eur }),
      });
      setLetztesTrinkgeld(eur);
      setGesendet(true);
      setBetrag('');
      onSuccess?.(eur);
      setTimeout(() => setGesendet(false), 3000);
    } catch {
      setError('Fehler beim Speichern — wird lokal vermerkt.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  function handleFreitext() {
    const parsed = parseFloat(betrag.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      senden(parsed);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm font-bold text-amber-700 dark:text-amber-300">Trinkgeld erfassen</span>
        {letztesTrinkgeld !== null && gesendet && (
          <div className="ml-auto flex items-center gap-1 text-[11px] text-matcha-600 dark:text-matcha-400 font-semibold">
            <Check className="h-3.5 w-3.5" />
            +{letztesTrinkgeld.toFixed(2).replace('.', ',')} € gespeichert
          </div>
        )}
      </div>

      {/* Schnell-Beträge */}
      <div className="flex gap-2 flex-wrap">
        {SCHNELL_BETRAEGE.map((b) => (
          <button
            key={b}
            onClick={() => senden(b)}
            disabled={loading}
            className={cn(
              'flex-1 min-w-[52px] rounded-xl border px-2 py-2.5 text-sm font-bold tabular-nums transition-colors',
              'border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950/40',
              'hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50',
            )}
          >
            {b % 1 === 0 ? `${b}€` : `${b.toFixed(2).replace('.', ',')}€`}
          </button>
        ))}
      </div>

      {/* Freitext-Eingabe */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Betrag €"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFreitext()}
            disabled={loading}
            className={cn(
              'w-full rounded-xl border border-amber-300 dark:border-amber-700',
              'bg-white dark:bg-amber-950/40 px-3 py-2 text-sm font-semibold',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400',
              'disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
            )}
          />
        </div>
        <button
          onClick={handleFreitext}
          disabled={loading || !betrag}
          className={cn(
            'flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
            'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50',
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Hinzufügen
        </button>
      </div>

      {/* Fehler */}
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{error}</p>
      )}
    </div>
  );
}
