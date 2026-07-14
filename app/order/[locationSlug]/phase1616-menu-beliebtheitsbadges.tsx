'use client';

import React, { useEffect, useState } from 'react';

const CACHE_KEY_PREFIX = 'mise_beliebte_artikel_ids_';
const CACHE_TTL_MS = 30 * 60 * 1000;
const TOP_N = 3;

interface CacheEntry {
  names: string[];
  ts: number;
}

function loadCache(locationId: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${locationId}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.names;
  } catch {
    return null;
  }
}

function saveCache(locationId: string, names: string[]) {
  try {
    const entry: CacheEntry = { names, ts: Date.now() };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${locationId}`, JSON.stringify(entry));
  } catch {
    // storage full — ignore
  }
}

const MOCK_TOP_NAMES = ['Margherita', 'Burger Classic', 'Caesar Salad'];

interface Props {
  locationId: string;
  itemName: string;
}

export function StorefrontPhase1616MenuBeliebtheitsBadge({ locationId, itemName }: Props) {
  const [topNames, setTopNames] = useState<string[] | null>(null);

  useEffect(() => {
    const cached = loadCache(locationId);
    if (cached) {
      setTopNames(cached);
      return;
    }
    fetch(`/api/delivery/storefront/empfohlene-artikel?location=${encodeURIComponent(locationId)}&limit=${TOP_N}`)
      .then((r) => r.json())
      .then((data: { artikel?: { name: string }[] }) => {
        const names = (data.artikel ?? MOCK_TOP_NAMES.map((n) => ({ name: n }))).slice(0, TOP_N).map((a) => a.name);
        saveCache(locationId, names);
        setTopNames(names);
      })
      .catch(() => {
        saveCache(locationId, MOCK_TOP_NAMES);
        setTopNames(MOCK_TOP_NAMES);
      });
  }, [locationId]);

  if (topNames === null) return null;

  const isBeliebter = topNames.some(
    (n) => n.toLowerCase().trim() === (itemName ?? '').toLowerCase().trim(),
  );

  if (!isBeliebter) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 select-none"
      aria-label="Beliebter Artikel"
    >
      <span aria-hidden="true">🔥</span>
      Beliebt
    </span>
  );
}
