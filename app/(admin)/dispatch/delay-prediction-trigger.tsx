'use client';

/**
 * DispatchDelayPredictionTrigger — Phase 317
 *
 * Ermöglicht dem Dispatcher manuell alle offenen Bestellungen
 * neu vorherzusagen (POST predict_now) und Ergebnisse zu sehen.
 * Kompakter Button + Status-Anzeige.
 */

import { useState } from 'react';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TriggerResult {
  predicted: number;
  skipped: number;
  errors: number;
}

export function DispatchDelayPredictionTrigger({ locationId }: { locationId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    if (!locationId || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/order-delay-prediction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'predict_now', location_id: locationId }),
      });
      if (!res.ok) { setError('Fehler beim Vorhersagen'); return; }
      const d = await res.json() as TriggerResult & { ok: boolean };
      setResult({ predicted: d.predicted ?? 0, skipped: d.skipped ?? 0, errors: d.errors ?? 0 });
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
        <Zap className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-stone-700">Verspätungs-KI</div>
        {result ? (
          <div className="text-[11px] text-stone-500">
            <span className="text-matcha-700 font-bold">{result.predicted} vorhergesagt</span>
            {result.skipped > 0 && ` · ${result.skipped} übersprungen`}
            {result.errors > 0 && <span className="text-red-600"> · {result.errors} Fehler</span>}
          </div>
        ) : error ? (
          <div className="text-[11px] text-red-600">{error}</div>
        ) : (
          <div className="text-[11px] text-stone-400">Prognosen für alle offenen Bestellungen</div>
        )}
      </div>
      <button
        onClick={trigger}
        disabled={loading || !locationId}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50',
          'border border-matcha-300 bg-matcha-50 text-matcha-700 hover:bg-matcha-100',
        )}
      >
        {loading
          ? <><Loader2 className="h-3 w-3 animate-spin" /> Rechne…</>
          : <><RefreshCw className="h-3 w-3" /> Jetzt vorhersagen</>
        }
      </button>
    </div>
  );
}
