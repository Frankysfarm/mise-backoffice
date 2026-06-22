'use client';

/**
 * TourStopSchnellQuittierung — Phase 406
 *
 * Quick-action Karte im Fahrer-App-Dark-Theme zum Quittieren des aktuellen Tour-Stopps.
 * Zustand: idle → arrived → delivered | problem
 * API: GET /api/delivery/driver/navigation
 *      POST /api/delivery/tours/[id]/status
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrentStop {
  sequence: number;
  address: string;
  orderNumber?: string;
  tourId?: string;
}

interface NavData {
  currentStop: CurrentStop | null;
}

type QuittierungState = 'idle' | 'arrived' | 'delivered' | 'problem';

async function postStatus(tourId: string | undefined, action: string, note?: string) {
  if (!tourId) return;
  try {
    await fetch(`/api/delivery/tours/${tourId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
  } catch {
    // ignore
  }
}

export function TourStopSchnellQuittierung() {
  const [currentStop, setCurrentStop] = useState<CurrentStop | null>(null);
  const [state, setState] = useState<QuittierungState>('idle');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/driver/navigation', { cache: 'no-store' });
      if (!res.ok) return;
      const json: NavData = await res.json();
      setCurrentStop(json.currentStop);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!currentStop) return null;

  const handleArrived = async () => {
    setState('arrived');
    await postStatus(currentStop.tourId, 'arrived');
  };

  const handleDelivered = async () => {
    setSubmitting(true);
    await postStatus(currentStop.tourId, 'delivered');
    setState('delivered');
    setSubmitting(false);
  };

  const handleProblem = () => {
    setState('problem');
  };

  const handleSubmitProblem = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    await postStatus(currentStop.tourId, 'problem', note);
    setState('idle');
    setNote('');
    setSubmitting(false);
  };

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <CheckCircle2 className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Stopp quittieren</span>
      </div>

      {/* Stop info */}
      <div className="px-4 py-3 flex items-start gap-2">
        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-xs text-slate-400 font-medium">Stopp #{currentStop.sequence}</div>
          <div className="text-sm text-white font-medium">{currentStop.address}</div>
          {currentStop.orderNumber && (
            <div className="text-[11px] text-slate-500">Bestellung {currentStop.orderNumber}</div>
          )}
        </div>
      </div>

      {/* State machine */}
      {state === 'delivered' ? (
        <div className="px-4 py-5 flex flex-col items-center gap-2">
          <CheckCircle2 className="h-10 w-10 text-matcha-400" />
          <div className="text-base font-bold text-white">Stopp erledigt!</div>
          <div className="text-xs text-slate-400">Übergabe erfolgreich quittiert</div>
        </div>
      ) : state === 'problem' ? (
        <div className="px-4 pb-4 space-y-2">
          <label className="text-xs text-slate-300 font-medium">Problem beschreiben</label>
          <textarea
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            rows={3}
            placeholder="Was ist das Problem?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setState('idle')}
              className="flex-1 rounded-lg py-2 text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSubmitProblem}
              disabled={!note.trim() || submitting}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                note.trim() && !submitting
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed',
              )}
            >
              <Send className="h-3.5 w-3.5" />
              Melden
            </button>
          </div>
        </div>
      ) : (
        <div className={cn('px-4 pb-4 grid gap-2', state === 'idle' ? 'grid-cols-3' : 'grid-cols-2')}>
          {state === 'idle' && (
            <button
              onClick={handleArrived}
              className="rounded-lg py-2.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Angekommen
            </button>
          )}
          <button
            onClick={handleDelivered}
            disabled={submitting}
            className={cn(
              'rounded-lg py-2.5 text-sm font-medium transition-colors',
              state === 'arrived'
                ? 'col-span-1 bg-matcha-600 text-white hover:bg-matcha-700'
                : 'bg-matcha-700/70 text-white hover:bg-matcha-700',
            )}
          >
            Übergabe OK
          </button>
          <button
            onClick={handleProblem}
            className="rounded-lg py-2.5 text-sm font-medium bg-red-600/80 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Problem
          </button>
        </div>
      )}
    </div>
  );
}
