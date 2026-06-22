'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown } from 'lucide-react';

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
 * ZonenAuslastungsChip — Kitchen-Seitenleiste: morgige Bestellmenge je Zone
 * Hilft Köchen, Kapazitäten für Zonen-Hotspots frühzeitig zu planen (Phase 423).
 */
export function ZonenAuslastungsChip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ZonenPrognoseUebersicht | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-prognose?location_id=${locationId}&action=uebersicht`,
      );
      if (res.ok) setData(await res.json() as ZonenPrognoseUebersicht);
    } catch {
      // Stille Fehler — Kitchen nicht blockieren
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  if (!data || data.zonen.length === 0) return null;

  const topZone = data.topZone;
  const topEntry = data.zonen.find(z => z.zone === topZone);

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin className="h-3 w-3 text-violet-500" />
        <span className="text-[10px] font-bold text-violet-700">Zonen Morgen</span>
      </div>

      <div className="space-y-1">
        {data.zonen.map(z => {
          if (z.morgenOrders === 0) return null;
          const pct = data.zonen.length > 0
            ? Math.round((z.morgenOrders / data.zonen.reduce((s, x) => s + x.morgenOrders, 0)) * 100)
            : 0;
          return (
            <div key={z.zone} className="flex items-center gap-2">
              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${ZONE_DOT[z.zone]}`} />
              <span className="text-[10px] font-semibold text-stone-600 w-10">Zone {z.zone}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                <div
                  className={`h-full rounded-full ${ZONE_DOT[z.zone]} opacity-70`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-stone-500 w-14 text-right">
                ~{Math.round(z.morgenOrders)} Best.
              </span>
              {z.trend7d === 'up' && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
              {z.trend7d === 'down' && <TrendingDown className="h-2.5 w-2.5 text-rose-500" />}
            </div>
          );
        })}
      </div>

      {topEntry && (
        <div className="mt-2 text-[9px] text-violet-500">
          Hot Zone: {topZone} · {Math.round(topEntry.morgenOrders)} Best. erwartet
        </div>
      )}
    </div>
  );
}
