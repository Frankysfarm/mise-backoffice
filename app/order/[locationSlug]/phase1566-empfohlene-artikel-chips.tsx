'use client';

import React, { useEffect, useState } from 'react';

interface ArtikelChip {
  id: string;
  name: string;
  bestellungen: number;
  preis?: number | null;
}

interface ApiResponse {
  artikel: ArtikelChip[];
}

interface Props {
  locationSlug: string;
  onSelect?: (artikel: ArtikelChip) => void;
}

const CACHE_KEY = 'mise_empfohlene_artikel_chips_v1';
const CACHE_TTL = 30 * 60_000;

export function StorefrontPhase1566EmpfohleneArtikelChips({ locationSlug, onSelect }: Props) {
  const [artikel, setArtikel] = useState<ArtikelChip[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setArtikel(data); return; }
      }
    } catch {}

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/storefront/empfohlene-artikel?location=${locationSlug}&limit=5`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setArtikel(json.artikel);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.artikel, ts: Date.now() }));
          return;
        }
      } catch {}
      const mock: ArtikelChip[] = [
        { id: 'm1', name: 'Margherita', bestellungen: 312, preis: 9.9 },
        { id: 'm2', name: 'Burger Classic', bestellungen: 278, preis: 12.5 },
        { id: 'm3', name: 'Caesar Salad', bestellungen: 195, preis: 8.9 },
        { id: 'm4', name: 'Pasta Bolognese', bestellungen: 167, preis: 11.5 },
        { id: 'm5', name: 'Tiramisu', bestellungen: 143, preis: 5.5 },
      ];
      setArtikel(mock);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: mock, ts: Date.now() })); } catch {}
    };
    load();
  }, [locationSlug]);

  if (!mounted || artikel.length === 0) return null;

  return (
    <div className="space-y-2 py-2">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Beliebt bei anderen</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {artikel.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect?.(a)}
            className="shrink-0 flex items-center gap-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-full px-3 py-1.5 transition-colors"
          >
            <span>🔥</span>
            <span>{a.name}</span>
            {a.preis !== null && a.preis !== undefined && (
              <span className="text-stone-500">{a.preis.toFixed(2)} €</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
