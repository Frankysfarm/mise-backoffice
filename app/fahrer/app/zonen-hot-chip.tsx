'use client';

import { useEffect, useState, useCallback } from 'react';
import { Flame, MapPin } from 'lucide-react';

// ── Typen ──────────────────────────────────────────────────────────────────────

type TrendRichtung = 'up' | 'stable' | 'down';
type ZoneName = 'A' | 'B' | 'C' | 'D';

interface ZoneUebersichtEntry {
  zone:             ZoneName;
  morgenRevenueEur: number;
  morgenOrders:     number;
  trend7d:          TrendRichtung;
  confidence:       number;
}

interface ZonenPrognoseUebersicht {
  locationId:     string;
  zonen:          ZoneUebersichtEntry[];
  gesamt7TageEur: number;
  topZone:        ZoneName | null;
  berechnetAm:    string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

const ZONE_DOT: Record<ZoneName, string> = {
  A: 'bg-matcha-400',
  B: 'bg-sky-400',
  C: 'bg-amber-400',
  D: 'bg-rose-400',
};

// ── Komponente ────────────────────────────────────────────────────────────────

/**
 * ZonenHotChip — Fahrer-App: Zeigt welche Zonen morgen besonders viele Bestellungen
 * erwarten, damit Fahrer Schichten optimal einteilen können (Phase 423).
 */
export function ZonenHotChip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ZonenPrognoseUebersicht | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-prognose?location_id=${locationId}&action=uebersicht`,
      );
      if (res.ok) setData(await res.json() as ZonenPrognoseUebersicht);
    } catch {
      // Stille Fehler
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  if (!data || !data.topZone) return null;

  const topEntry = data.zonen.find(z => z.zone === data.topZone);
  const hotZones = data.zonen
    .filter(z => z.morgenOrders > 0)
    .sort((a, b) => b.morgenOrders - a.morgenOrders)
    .slice(0, 3);

  if (hotZones.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Flame className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-bold text-amber-800">Morgen: Heiße Zonen</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {hotZones.map((z, i) => (
          <div
            key={z.zone}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5
              ${i === 0 ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-stone-200'}`}
          >
            <div className={`h-2.5 w-2.5 rounded-full ${ZONE_DOT[z.zone]}`} />
            <span className={`text-xs font-bold ${i === 0 ? 'text-amber-800' : 'text-stone-600'}`}>
              Zone {z.zone}
            </span>
            <span className={`text-[10px] ${i === 0 ? 'text-amber-600' : 'text-stone-400'}`}>
              ~{Math.round(z.morgenOrders)} Best.
            </span>
            {i === 0 && <Flame className="h-3 w-3 text-amber-500" />}
          </div>
        ))}
      </div>

      {topEntry && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
          <MapPin className="h-3 w-3" />
          <span>Zone {data.topZone} ist morgen die stärkste Zone</span>
        </div>
      )}
    </div>
  );
}
