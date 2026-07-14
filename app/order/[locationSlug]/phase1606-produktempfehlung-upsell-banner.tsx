'use client';

import React, { useEffect, useState } from 'react';

interface Artikel {
  id: string;
  name: string;
  preis: number;
  bild_url?: string | null;
  kategorie?: string | null;
}

interface Props {
  locationId: string;
  cartTotal: number;
  onAddItem?: (artikel: Artikel) => void;
}

const CACHE_KEY = 'mise_empfohlene_artikel_v1';
const CACHE_TTL_MS = 10 * 60_000;
const MIN_CART_TOTAL = 15;

const MOCK_ARTIKEL: Artikel[] = [
  { id: 'mock1', name: 'Pommes Frites', preis: 3.9, kategorie: 'Beilage' },
  { id: 'mock2', name: 'Cola 0,5l', preis: 2.5, kategorie: 'Getränk' },
  { id: 'mock3', name: 'Soße nach Wahl', preis: 1.0, kategorie: 'Extra' },
  { id: 'mock4', name: 'Dessert des Tages', preis: 4.5, kategorie: 'Dessert' },
];

function readCache(locationId: string): Artikel[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, loc, data } = JSON.parse(raw) as { ts: number; loc: string; data: Artikel[] };
    if (Date.now() - ts > CACHE_TTL_MS || loc !== locationId) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(locationId: string, data: Artikel[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), loc: locationId, data }));
  } catch {
    // storage unavailable
  }
}

export function StorefrontPhase1606ProduktempfehlungUpsellBanner({ locationId, cartTotal, onAddItem }: Props) {
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || cartTotal >= MIN_CART_TOTAL) return;

    const cached = readCache(locationId);
    if (cached) {
      setArtikel(cached);
      return;
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/storefront/empfohlene-artikel?location_id=${locationId}&limit=4`,
        );
        if (res.ok) {
          const json = await res.json() as Artikel[];
          if (Array.isArray(json) && json.length > 0) {
            setArtikel(json);
            writeCache(locationId, json);
            return;
          }
        }
      } catch {
        // fallback
      }
      setArtikel(MOCK_ARTIKEL);
      writeCache(locationId, MOCK_ARTIKEL);
    }

    load();
  }, [mounted, locationId, cartTotal]);

  if (!mounted || dismissed || cartTotal >= MIN_CART_TOTAL || artikel.length === 0) return null;

  const missing = (MIN_CART_TOTAL - cartTotal).toFixed(2);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-white">
        <span className="text-sm font-bold flex-1">
          Noch {missing} € bis Gratis-Lieferung!
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/70 hover:text-white text-lg leading-none"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs text-amber-700 mb-3">
          Diese Artikel passen gut zu deiner Bestellung:
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {artikel.map((a) => (
            <div
              key={a.id}
              className="shrink-0 w-32 bg-white border border-amber-100 rounded-xl p-3 flex flex-col gap-1"
            >
              <span className="text-xs text-gray-400 truncate">{a.kategorie ?? 'Artikel'}</span>
              <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">{a.name}</span>
              <span className="text-sm font-bold text-amber-700 mt-auto">{a.preis.toFixed(2)} €</span>
              {onAddItem && (
                <button
                  onClick={() => onAddItem(a)}
                  className="mt-1 w-full text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1 font-semibold transition-colors"
                >
                  + Hinzufügen
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
