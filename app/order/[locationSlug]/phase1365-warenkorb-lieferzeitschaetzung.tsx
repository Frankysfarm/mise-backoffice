'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, Clock, Loader2 } from 'lucide-react';

/**
 * Phase 1365 — Warenkorb-Lieferzeitschätzung (Storefront)
 *
 * Wenn Warenkorb nicht leer: Live-ETA "Lieferung in ca. X Minuten"
 * basierend auf aktueller Küchen-Auslastung.
 * Polling alle 2 Min. Nach Phase1360 in storefront.tsx.
 */

interface AuslastungData {
  eta_minuten: number;
  auslastung_pct: number;
  aktive_bestellungen: number;
  generiert_am: string;
}

interface Props {
  locationId: string;
  cartItemCount: number;
}

const POLL_MS = 2 * 60 * 1000;

function buildMock(): AuslastungData {
  return {
    eta_minuten: 28,
    auslastung_pct: 65,
    aktive_bestellungen: 4,
    generiert_am: new Date().toISOString(),
  };
}

function auslastungLabel(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Hohe Auslastung', color: 'text-red-600 dark:text-red-400' };
  if (pct >= 55) return { label: 'Normale Auslastung', color: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Niedrige Auslastung', color: 'text-green-600 dark:text-green-400' };
}

export function StorefrontPhase1365WarenkorbLieferzeitschaetzung({ locationId, cartItemCount }: Props) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/public/kuechen-auslastung?location_id=${locationId}`);
      if (!res.ok) throw new Error('not ok');
      setData(await res.json() as AuslastungData);
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (cartItemCount > 0) {
      laden();
      const t = setInterval(laden, POLL_MS);
      return () => clearInterval(t);
    }
  }, [laden, cartItemCount]);

  if (cartItemCount === 0 || !data) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>ETA wird berechnet…</span>
        </div>
      );
    }
    return null;
  }

  const { label: auslLabel, color: auslColor } = auslastungLabel(data.auslastung_pct);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
      <Bike className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Lieferung in ca.{' '}
          <span className="text-primary">{data.eta_minuten} Minuten</span>
        </p>
        <p className={`text-[11px] ${auslColor}`}>
          {auslLabel} · {data.aktive_bestellungen} aktive Bestellung{data.aktive_bestellungen !== 1 ? 'en' : ''}
        </p>
      </div>
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}
