'use client';

/**
 * VerzoegerungsInfoBanner — Phase 319
 *
 * Kunden-seitiges Banner, das angezeigt wird wenn die Bestellung
 * als verspätet markiert ist. Wird von der Storefront eingebunden
 * wenn `isDelayed` true ist (z.B. aus dem Order-Status-Tracker).
 *
 * Kein API-Call — Props-basiert, damit keine Admin-Auth nötig.
 * Die übergeordnete Komponente bestimmt ob die Bestellung verspätet ist
 * (z.B. eta_earliest überschritten + Status noch "unterwegs").
 */

import { Bell, Clock } from 'lucide-react';

interface Props {
  estimatedExtraMin?: number | null;
  onDismiss?: () => void;
}

export function VerzoegerungsInfoBanner({ estimatedExtraMin, onDismiss }: Props) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 mt-0.5">
          <Bell className="h-4.5 w-4.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-amber-900 text-sm">Kleine Verzögerung</div>
          <div className="text-sm text-amber-800 mt-0.5">
            Deine Bestellung ist etwas später als geplant.
            {estimatedExtraMin && estimatedExtraMin > 0
              ? ` Wir erwarten ca. ${estimatedExtraMin} min Verzögerung.`
              : ' Wir beeilen uns!'}
          </div>

          {/* ETA hint */}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <Clock className="h-3.5 w-3.5" />
            <span>Wir halten dich auf dem Laufenden</span>
          </div>
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 text-amber-400 hover:text-amber-600 transition text-xs font-bold mt-0.5"
            aria-label="Schließen"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
