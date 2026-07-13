'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1325 — Live-Allergen-Warn-Banner (Kitchen)
 *
 * Erkennt neue Bestellungen mit Hochrisiko-Allergenen (Nüsse, Schalentiere, Gluten, Laktose).
 * Zeigt sofortiges Popup mit Bestätigungs-Pflicht, bevor die Küche weiterarbeiten kann.
 */

const HOCHRISIKO_ALLERGENE = ['nüsse', 'nuss', 'erdnuss', 'haselnuss', 'walnuss', 'schalentiere', 'garnelen', 'krabben', 'gluten', 'laktose', 'milch', 'ei', 'fisch', 'sesam', 'senf', 'sellerie', 'sulfit'];

interface KitchenOrder {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  created_at?: string | null;
  items?: Array<{ name?: string; allergens?: string[]; allergene?: string[] }> | null;
  positionen?: Array<{ name?: string; allergens?: string[]; allergene?: string[] }> | null;
  sonderwunsch?: string | null;
  hinweise?: string | null;
  allergen_hinweis?: string | null;
  kunde_name?: string | null;
}

interface AllergenWarnung {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  allergene: string[];
  detectedAt: number;
}

interface Props {
  orders: KitchenOrder[];
}

function extractAllergene(order: KitchenOrder): string[] {
  const found = new Set<string>();
  const allText = [
    order.sonderwunsch ?? '',
    order.hinweise ?? '',
    order.allergen_hinweis ?? '',
    ...(order.items ?? []).flatMap(i => [...(i.allergens ?? []), ...(i.allergene ?? [])]),
    ...(order.positionen ?? []).flatMap(i => [...(i.allergens ?? []), ...(i.allergene ?? [])]),
  ].join(' ').toLowerCase();

  for (const allergen of HOCHRISIKO_ALLERGENE) {
    if (allText.includes(allergen)) found.add(allergen);
  }
  return [...found];
}

export function KitchenPhase1325AllergenWarnBanner({ orders }: Props) {
  const [warnungen, setWarnungen] = useState<AllergenWarnung[]>([]);
  const [bestaetigt, setBestaetigt] = useState<Set<string>>(new Set());
  const [aktiveWarnung, setAktiveWarnung] = useState<AllergenWarnung | null>(null);
  const seenOrdersRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<boolean>(false);

  const neueBestellungenMitAllergenen = useMemo(() => {
    const aktiveOrders = (orders ?? []).filter(o =>
      o.status !== 'delivered' && o.status !== 'cancelled'
    );
    return aktiveOrders
      .map(o => ({ order: o, allergene: extractAllergene(o) }))
      .filter(({ allergene }) => allergene.length > 0);
  }, [orders]);

  useEffect(() => {
    for (const { order, allergene } of neueBestellungenMitAllergenen) {
      if (!seenOrdersRef.current.has(order.id) && !bestaetigt.has(order.id)) {
        seenOrdersRef.current.add(order.id);
        const warnung: AllergenWarnung = {
          orderId: order.id,
          bestellnummer: order.bestellnummer ?? order.id.slice(0, 8).toUpperCase(),
          kundeName: order.kunde_name ?? 'Unbekannt',
          allergene,
          detectedAt: Date.now(),
        };
        setWarnungen(prev => {
          if (prev.some(w => w.orderId === order.id)) return prev;
          return [...prev, warnung];
        });
      }
    }
  }, [neueBestellungenMitAllergenen, bestaetigt]);

  const offeneWarnungen = warnungen.filter(w => !bestaetigt.has(w.orderId));

  useEffect(() => {
    if (offeneWarnungen.length > 0 && !aktiveWarnung) {
      setAktiveWarnung(offeneWarnungen[0]);
    }
    if (offeneWarnungen.length === 0) {
      setAktiveWarnung(null);
    }
  }, [offeneWarnungen, aktiveWarnung]);

  function bestaetigen(orderId: string) {
    setBestaetigt(prev => new Set([...prev, orderId]));
    setAktiveWarnung(prev => {
      if (prev?.orderId !== orderId) return prev;
      const next = offeneWarnungen.find(w => w.orderId !== orderId);
      return next ?? null;
    });
  }

  if (offeneWarnungen.length === 0) return null;

  return (
    <>
      {/* Hintergrund-Indikator */}
      <div className="mb-2 rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40 p-2 flex items-center gap-2">
        <Bell className="h-4 w-4 text-red-600 animate-pulse flex-shrink-0" />
        <span className="text-xs font-bold text-red-700 dark:text-red-400">
          {offeneWarnungen.length} Allergen-Warnung{offeneWarnungen.length > 1 ? 'en' : ''} — Bestätigung erforderlich!
        </span>
      </div>

      {/* Modal-Popup bei aktiver Warnung */}
      {aktiveWarnung && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={cn(
              'relative w-full max-w-md rounded-xl border-2 border-red-500 bg-white dark:bg-zinc-900 shadow-2xl',
              'animate-in zoom-in-95 duration-200'
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 rounded-t-xl bg-red-500 px-4 py-3">
              <AlertTriangle className="h-6 w-6 text-white flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-white uppercase tracking-wide">
                  ⚠ Hochrisiko-Allergen erkannt
                </p>
                <p className="text-xs text-red-100">Bestellung #{aktiveWarnung.bestellnummer}</p>
              </div>
              <span className="text-xs text-red-200">{aktiveWarnung.kundeName}</span>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Diese Bestellung enthält <span className="font-bold text-red-600">Hochrisiko-Allergene</span>.
                Bitte besondere Sorgfalt walten lassen — separate Zubereitung, Werkzeuge und Verpackung!
              </p>

              <div className="flex flex-wrap gap-2">
                {aktiveWarnung.allergene.map(a => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300 uppercase border border-red-300 dark:border-red-700"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {a}
                  </span>
                ))}
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-3">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Checkliste:</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  <li>✓ Separate Pfanne / Schneidebrett verwenden</li>
                  <li>✓ Hände waschen, Handschuhe wechseln</li>
                  <li>✓ Zutaten auf Kreuzkontamination prüfen</li>
                  <li>✓ Behälter als Allergen-Bestellung markieren</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <button
                onClick={() => bestaetigen(aktiveWarnung.orderId)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 px-4 py-3 text-sm font-black text-white transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Verstanden — Allergen-Protokoll aktiviert
              </button>
            </div>

            {offeneWarnungen.length > 1 && (
              <p className="px-5 pb-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Noch {offeneWarnungen.length - 1} weitere{offeneWarnungen.length > 2 ? ' Warnungen' : ' Warnung'} ausstehend
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
