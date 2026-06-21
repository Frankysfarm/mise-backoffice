'use client';

/**
 * TourStartFeedbackReminder — Phase 356
 *
 * Zeigt am Tourstart eine kompakte Erinnerung, die Tour nach Abschluss
 * zu bewerten. Verschwindet sobald die Tour abgeschlossen ist oder
 * der Fahrer es dismisst.
 *
 * Wird im Driver-App nach Tour-Zuweisung angezeigt (batchState = 'assigned').
 */

import { useState } from 'react';
import { Star, X } from 'lucide-react';

interface TourStartFeedbackReminderProps {
  batchId: string | null;
  batchState: string | null;
}

export function TourStartFeedbackReminder({ batchId, batchState }: TourStartFeedbackReminderProps) {
  const [dismissed, setDismissed] = useState(false);

  // Nur bei zugewiesener, noch laufender Tour anzeigen
  const isActive = batchState && ['assigned', 'at_restaurant', 'on_route', 'en_route'].includes(batchState);
  if (!isActive || !batchId || dismissed) return null;

  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-blue-900/40 border border-blue-700/30 px-3 py-2">
      <Star className="h-4 w-4 text-amber-400 shrink-0" />
      <p className="flex-1 text-xs text-blue-100">
        Nach Abschluss deiner Tour kurz Feedback geben — hilft uns Touren zu verbessern.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-0.5 text-blue-400 hover:text-white transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default TourStartFeedbackReminder;
