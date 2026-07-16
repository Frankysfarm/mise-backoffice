'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, CheckCircle2, AlertCircle, Loader2, UserCheck } from 'lucide-react';

/**
 * Phase 1838 — Freier-Fahrer-Sofort-Zuweisung (Dispatch)
 *
 * Button "Nächste Bestellung zuweisen" → wählt optimal freien Fahrer nach Zone + Auslastung.
 * POST /api/delivery/admin/auto-zuweisung. Erfolgsmeldung oder Fehlerstatus.
 */

interface Props {
  locationId: string | null;
  className?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error' | 'keine_bestellung' | 'kein_fahrer';

interface Ergebnis {
  erfolg: boolean;
  fahrer_name?: string;
  bestellung_id?: string;
  meldung: string;
}

export function DispatchPhase1838FreierFahrerSofortZuweisung({ locationId, className }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const handleZuweisung = async () => {
    if (!locationId || status === 'loading') return;
    setStatus('loading');
    setErgebnis(null);

    try {
      const res = await fetch('/api/delivery/admin/auto-zuweisung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      });
      const data: Ergebnis = await res.json();
      setErgebnis(data);

      if (data.erfolg) {
        setStatus('success');
      } else if (data.meldung?.includes('Fahrer')) {
        setStatus('kein_fahrer');
      } else if (data.meldung?.includes('Bestellung')) {
        setStatus('keine_bestellung');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
      setErgebnis({ erfolg: false, meldung: 'Netzwerkfehler — bitte erneut versuchen.' });
    }

    // Reset nach 6s
    setTimeout(() => {
      setStatus('idle');
      setErgebnis(null);
    }, 6_000);
  };

  const isDisabled = !locationId || status === 'loading';

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold">Sofort-Zuweisung</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Optimal nach Zone + Auslastung</span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Weist automatisch den am besten geeigneten freien Fahrer der nächsten wartenden Bestellung zu.
        </p>

        <button
          onClick={handleZuweisung}
          disabled={isDisabled}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-200',
            isDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-matcha-600 hover:bg-matcha-700 active:scale-95 text-white shadow-sm',
          )}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird zugewiesen…
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              Nächste Bestellung zuweisen
            </>
          )}
        </button>

        {ergebnis && (
          <div className={cn(
            'rounded-xl border px-3 py-2.5 flex items-start gap-2',
            status === 'success'
              ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800'
              : status === 'kein_fahrer' || status === 'keine_bestellung'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
          )}>
            {status === 'success'
              ? <CheckCircle2 className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0 mt-0.5" />
              : <AlertCircle className={cn('h-4 w-4 shrink-0 mt-0.5',
                  status === 'kein_fahrer' || status === 'keine_bestellung'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400',
                )} />
            }
            <div className="min-w-0">
              <p className={cn(
                'text-xs font-semibold',
                status === 'success'
                  ? 'text-matcha-700 dark:text-matcha-300'
                  : status === 'kein_fahrer' || status === 'keine_bestellung'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-300',
              )}>
                {ergebnis.meldung}
              </p>
              {status === 'success' && ergebnis.fahrer_name && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Fahrer: {ergebnis.fahrer_name}
                  {ergebnis.bestellung_id && (
                    <> · Bestellung #{ergebnis.bestellung_id.slice(-6)}</>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {!locationId && (
          <p className="text-[10px] text-muted-foreground text-center">Bitte Filiale auswählen.</p>
        )}
      </div>
    </div>
  );
}
