'use client';

import { useState, useEffect } from 'react';

/**
 * Phase 960 — Produktverfügbarkeits-Indikator (Storefront)
 *
 * Live-Badge "Wenige übrig" / "Ausverkauft" für Artikel mit niedriger Verfügbarkeit.
 * Pollt /api/delivery/storefront/artikel-verfuegbarkeit alle 5 Minuten.
 * Gibt ein Map item_id → status zurück für schnellen Zugriff in MenuItemCard.
 */

type VerfuegbarkeitsStatus = 'verfuegbar' | 'wenige_uebrig' | 'ausverkauft';

interface ArtikelVerfuegbarkeit {
  item_id: string;
  status: VerfuegbarkeitsStatus;
  anzahl_uebrig: number | null;
}

interface Props {
  locationId: string;
  itemIds: string[];
  onUpdate: (map: Map<string, VerfuegbarkeitsStatus>) => void;
}

/** Silent data-fetcher: renders nothing, calls onUpdate with the availability map. */
export function Phase960ProduktVerfuegbarkeitsLoader({ locationId, itemIds, onUpdate }: Props) {
  useEffect(() => {
    if (itemIds.length === 0) return;

    const load = async () => {
      try {
        const ids = itemIds.join(',');
        const res = await fetch(
          `/api/delivery/storefront/artikel-verfuegbarkeit?location_id=${locationId}&item_ids=${ids}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const map = new Map<string, VerfuegbarkeitsStatus>();
        (json.items as ArtikelVerfuegbarkeit[]).forEach((item) => {
          map.set(item.item_id, item.status);
        });
        onUpdate(map);
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId, itemIds.join(','), onUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** Inline badge shown on a menu item card. */
export function VerfuegbarkeitsBadge({ status }: { status: VerfuegbarkeitsStatus | undefined }) {
  if (!status || status === 'verfuegbar') return null;

  if (status === 'ausverkauft') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
        Ausverkauft
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      Wenige übrig
    </span>
  );
}
