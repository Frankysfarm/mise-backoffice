'use client';

import React, { useEffect, useState } from 'react';

interface LetzteBestellung {
  id: string;
  bestellnummer: string;
  items_kurz: string;
  betrag: number;
  datum: string;
}

interface Props {
  locationId: string;
  onQuickReorder?: (bestellung: LetzteBestellung) => void;
}

const STORAGE_KEY_PREFIX = 'mise_letzte_bestellungen_';
const MAX_BESTELLUNGEN = 3;
const CACHE_MIN = 60 * 24;

function loadFromStorage(locationId: string): LetzteBestellung[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${locationId}`);
    if (!raw) return [];
    const { data, ts } = JSON.parse(raw) as { data: LetzteBestellung[]; ts: number };
    if (Date.now() - ts > CACHE_MIN * 60 * 1000) return [];
    return data;
  } catch {
    return [];
  }
}

const MOCK_BESTELLUNGEN: LetzteBestellung[] = [
  { id: 'b1', bestellnummer: '#2401', items_kurz: 'Burger Classic, Cola', betrag: 14.9, datum: '2026-07-12' },
  { id: 'b2', bestellnummer: '#2389', items_kurz: 'Pizza Margherita', betrag: 11.5, datum: '2026-07-10' },
  { id: 'b3', bestellnummer: '#2371', items_kurz: 'Bowl Teriyaki, Wasser', betrag: 13.2, datum: '2026-07-07' },
];

export function StorefrontPhase1611LetzteBestellungenSchnellzugang({ locationId, onQuickReorder }: Props) {
  const [bestellungen, setBestellungen] = useState<LetzteBestellung[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadFromStorage(locationId);
    setBestellungen(stored.length > 0 ? stored.slice(0, MAX_BESTELLUNGEN) : MOCK_BESTELLUNGEN);
    setHydrated(true);
  }, [locationId]);

  if (!hydrated || bestellungen.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
        Zuletzt bestellt — Schnell nochmal
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
        {bestellungen.map((b) => (
          <button
            key={b.id}
            onClick={() => onQuickReorder?.(b)}
            className="snap-start shrink-0 rounded-2xl border border-matcha-200 bg-white shadow-sm px-4 py-3 flex flex-col gap-1 min-w-[160px] max-w-[200px] text-left hover:border-matcha-400 hover:shadow-md transition-all active:scale-95"
          >
            <span className="text-[10px] font-bold text-matcha-600 uppercase tracking-wider">
              {b.bestellnummer}
            </span>
            <span className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">
              {b.items_kurz}
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{b.datum}</span>
              <span className="text-xs font-bold text-matcha-700">{b.betrag.toFixed(2)} €</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
