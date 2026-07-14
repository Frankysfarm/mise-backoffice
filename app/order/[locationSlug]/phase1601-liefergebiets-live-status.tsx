'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  userPlz?: string | null;
}

interface ZoneStatus {
  plz: string;
  zone: string;
  status: 'frei' | 'normal' | 'überlastet';
  eta_anpassung_min: number;
  alternatives_zeitfenster?: string | null;
}

const CACHE_KEY = 'mise_zone_status_v1';
const CACHE_TTL_MS = 5 * 60_000;

function readCache(plz: string): ZoneStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, plz: cachedPlz, data } = JSON.parse(raw) as { ts: number; plz: string; data: ZoneStatus };
    if (Date.now() - ts > CACHE_TTL_MS || cachedPlz !== plz) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(plz: string, data: ZoneStatus): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), plz, data }));
  } catch {
    // storage unavailable
  }
}

export function StorefrontPhase1601LiefergebietLiveStatus({ locationId, userPlz }: Props) {
  const [zoneData, setZoneData] = useState<ZoneStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !userPlz) return;

    const cached = readCache(userPlz);
    if (cached) {
      setZoneData(cached);
      return;
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/storefront/zone-status?location_id=${locationId}&plz=${encodeURIComponent(userPlz!)}`,
        );
        if (res.ok) {
          const json = await res.json() as ZoneStatus;
          writeCache(userPlz!, json);
          setZoneData(json);
        }
      } catch {
        // kein Banner bei Fehler
      }
    }

    load();
  }, [locationId, userPlz, mounted]);

  if (!mounted || !zoneData || zoneData.status !== 'überlastet' || dismissed) return null;

  return (
    <div className="w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5 animate-bounce">⚡</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-amber-800 text-sm">Hohes Lieferaufkommen in {zoneData.zone}</div>
          <div className="text-xs text-amber-700 mt-0.5">
            Aktuelle ETA verlängert sich um ca.{' '}
            <span className="font-bold">{zoneData.eta_anpassung_min} Min.</span>
          </div>
          {zoneData.alternatives_zeitfenster && (
            <div className="mt-2 inline-flex items-center gap-1 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-800">
              Alternatives Zeitfenster: {zoneData.alternatives_zeitfenster}
            </div>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 text-xl leading-none shrink-0"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}
