'use client';

/**
 * LieferversrechenWidget — Smartes Lieferversprechen-Widget für den Storefront.
 *
 * Zeigt Kunden das Lieferversprechen mit:
 *  - Geschätzte Lieferzeit in Minuten
 *  - Vertrauensniveau (Hoch / Mittel / Niedrig) basierend auf der Bestelllast
 *  - Pulsierender Indikator, wenn ein Fahrer unterwegs ist
 *
 * Rein präsentational — keine API-Aufrufe.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bike, Clock, CheckCircle2, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  etaMin: number | null;
  status: string | null;
  orderCount: number | null;
}

type Vertrauensniveau = 'Hoch' | 'Mittel' | 'Niedrig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVertrauensniveau(orderCount: number | null): Vertrauensniveau {
  if (orderCount === null) return 'Mittel';
  if (orderCount <= 5) return 'Hoch';
  if (orderCount <= 15) return 'Mittel';
  return 'Niedrig';
}

const VERTRAUEN_STYLES: Record<
  Vertrauensniveau,
  { badge: string; label: string; beschreibung: string }
> = {
  Hoch: {
    badge: 'bg-matcha-500 text-white hover:bg-matcha-500',
    label: 'Hohes Vertrauen',
    beschreibung: 'Geringe Auslastung – pünktliche Lieferung sehr wahrscheinlich',
  },
  Mittel: {
    badge: 'bg-amber-500 text-white hover:bg-amber-500',
    label: 'Mittleres Vertrauen',
    beschreibung: 'Mäßige Auslastung – leichte Verzögerungen möglich',
  },
  Niedrig: {
    badge: 'bg-red-500 text-white hover:bg-red-500',
    label: 'Niedriges Vertrauen',
    beschreibung: 'Hohe Auslastung – Lieferzeit kann abweichen',
  },
};

const FAHRER_UNTERWEGS_STATUSES = new Set([
  'unterwegs',
  'on_route',
  'in_zustellung',
  'gesendet',
]);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PulsingDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-matcha-500" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function LieferversrechenWidget({ etaMin, status, orderCount }: Props) {
  const niveau = getVertrauensniveau(orderCount);
  const niveauStyle = VERTRAUEN_STYLES[niveau];
  const fahrerUnterwegs = status ? FAHRER_UNTERWEGS_STATUSES.has(status) : false;
  const geliefert = status === 'geliefert' || status === 'abgeschlossen';

  // Geliefert-Zustand
  if (geliefert) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-matcha-200 bg-matcha-50 px-4 py-3">
        <CheckCircle2 className="h-6 w-6 text-matcha-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-matcha-800">Zugestellt!</p>
          <p className="text-xs text-matcha-600">Ihre Bestellung wurde erfolgreich geliefert.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white px-4 py-4 shadow-sm space-y-3 transition-all duration-300',
        fahrerUnterwegs
          ? 'border-matcha-300 shadow-matcha-100 shadow-md'
          : 'border-gray-200',
      )}
    >
      {/* Haupt-ETA-Anzeige */}
      <div className="flex items-center gap-3">
        {/* Pulsierender Indikator wenn Fahrer unterwegs */}
        {fahrerUnterwegs ? (
          <PulsingDot active />
        ) : (
          <div className="h-3 w-3 rounded-full bg-gray-200 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {etaMin != null ? (
            <p className="text-base font-black text-gray-900">
              Wir liefern in{' '}
              <span
                className={cn(
                  'tabular-nums',
                  fahrerUnterwegs ? 'text-matcha-700' : 'text-gray-900',
                )}
              >
                ~{etaMin} Minuten
              </span>
            </p>
          ) : (
            <p className="text-base font-black text-gray-900">
              Bestellung wird vorbereitet…
            </p>
          )}

          {fahrerUnterwegs && (
            <p className="text-xs text-matcha-600 font-medium mt-0.5 flex items-center gap-1">
              <Bike className="h-3 w-3 shrink-0" />
              Fahrer ist unterwegs zu Ihnen
            </p>
          )}
        </div>

        {/* Vertrauens-Badge */}
        <Badge
          className={cn(
            'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full',
            niveauStyle.badge,
          )}
        >
          {niveau}
        </Badge>
      </div>

      {/* Vertrauens-Beschreibung */}
      <div
        className={cn(
          'flex items-start gap-2 rounded-xl px-3 py-2 text-xs',
          niveau === 'Hoch'
            ? 'bg-matcha-50 text-matcha-700'
            : niveau === 'Mittel'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-red-50 text-red-700',
        )}
      >
        <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{niveauStyle.beschreibung}</span>
      </div>

      {/* ETA-Balken */}
      {etaMin != null && etaMin > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Geschätzte Lieferzeit
            </span>
            <span className="font-bold tabular-nums text-gray-600">{etaMin} Min</span>
          </div>
          {/* Visueller Zeithorizont: zeige Phasen */}
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
            <div
              className={cn(
                'rounded-full transition-all',
                fahrerUnterwegs ? 'bg-matcha-500' : 'bg-gray-200',
              )}
              style={{ flex: fahrerUnterwegs ? 2 : 1 }}
            />
            <div
              className="bg-gray-100 rounded-full"
              style={{ flex: fahrerUnterwegs ? 1 : 2 }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-300 font-medium">
            <span>Jetzt</span>
            <span>Lieferung</span>
          </div>
        </div>
      )}
    </div>
  );
}
