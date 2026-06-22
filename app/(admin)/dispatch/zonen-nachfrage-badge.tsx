'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  locationId:    string;
  zonen:         ZoneUebersichtEntry[];
  gesamt7TageEur: number;
  topZone:       ZoneName | null;
  berechnetAm:   string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

const ZONE_STYLES: Record<ZoneName, { bg: string; text: string; dot: string }> = {
  A: { bg: 'bg-matcha-50',  text: 'text-matcha-700',  dot: 'bg-matcha-400'  },
  B: { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400'     },
  C: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  D: { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400'    },
};

function TrendIcon({ richtung }: { richtung: TrendRichtung }) {
  if (richtung === 'up')   return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (richtung === 'down') return <TrendingDown className="h-3 w-3 text-rose-500" />;
  return <Minus className="h-3 w-3 text-stone-300" />;
}

// ── Komponente ────────────────────────────────────────────────────────────────

/**
 * ZonenNachfrageBadge — kompakte Zonen-Nachfrage-Übersicht für Dispatch
 * Zeigt morgige Prognose je Zone als Badge-Reihe (Phase 423).
 */
export function ZonenNachfrageBadge({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ZonenPrognoseUebersicht | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-prognose?location_id=${locationId}&action=uebersicht`,
      );
      if (res.ok) setData(await res.json() as ZonenPrognoseUebersicht);
    } catch {
      // Stille Fehler — Dispatch nicht blockieren
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || data.zonen.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[11px] font-bold text-stone-600">Zonen-Prognose Morgen</span>
        {data.topZone && (
          <span className="ml-auto text-[10px] text-stone-400">Top: Zone {data.topZone}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.zonen.map(z => {
          const styles = ZONE_STYLES[z.zone];
          if (z.morgenOrders === 0 && z.morgenRevenueEur === 0) return null;
          return (
            <div
              key={z.zone}
              className={`flex items-center gap-1.5 rounded-lg border border-stone-100 ${styles.bg} px-2.5 py-1.5`}
            >
              <div className={`h-2 w-2 rounded-full ${styles.dot}`} />
              <span className={`text-[11px] font-bold ${styles.text}`}>Zone {z.zone}</span>
              <span className="text-[10px] text-stone-500">{fmtEur(z.morgenRevenueEur)}</span>
              <span className="text-[10px] text-stone-400">~{Math.round(z.morgenOrders)} Best.</span>
              <TrendIcon richtung={z.trend7d} />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 text-[10px] text-stone-400">
        7-Tage Gesamt: {fmtEur(data.gesamt7TageEur)} · Prognose-Basis: zone_revenue_snapshots
      </div>
    </div>
  );
}
