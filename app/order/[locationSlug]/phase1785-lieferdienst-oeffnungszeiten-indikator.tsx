'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, X } from 'lucide-react';

/**
 * Phase 1785 — Lieferdienst-Öffnungszeiten-Indikator (Storefront)
 *
 * Zeigt ob Lieferung aktuell möglich + nächster verfügbarer Slot.
 * Hydration-safe; 1x load (statisch aus Config / Windows-API).
 */

interface OeffnungszeitenAntwort {
  ist_geoeffnet: boolean;
  naechster_slot: string | null;
  naechster_slot_label: string | null;
  nachricht: string;
  schliesst_um: string | null;
  oeffnet_naechstes_mal_um: string | null;
}

interface Props {
  locationId: string;
  className?: string;
}

async function fetchOeffnungszeiten(locationId: string): Promise<OeffnungszeitenAntwort> {
  try {
    const res = await fetch(`/api/delivery/public/oeffnungszeiten?location_id=${locationId}`);
    if (res.ok) return res.json();
  } catch {}
  // Static mock
  const now = new Date();
  const h = now.getHours();
  const istGeoeffnet = h >= 11 && h < 22;
  return {
    ist_geoeffnet: istGeoeffnet,
    naechster_slot: istGeoeffnet ? null : '11:00',
    naechster_slot_label: istGeoeffnet ? null : 'Morgen 11:00 Uhr',
    nachricht: istGeoeffnet
      ? `Lieferung möglich bis ${h < 21 ? '22:00 Uhr' : '22:30 Uhr'}`
      : 'Bestellung für später möglich',
    schliesst_um: istGeoeffnet ? '22:00' : null,
    oeffnet_naechstes_mal_um: istGeoeffnet ? null : '11:00',
  };
}

export function StorefrontPhase1785LieferdienstOeffnungszeitenIndikator({ locationId, className }: Props) {
  const [data, setData] = useState<OeffnungszeitenAntwort | null>(null);
  const [mounted, setMounted] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !locationId) return;
    fetchOeffnungszeiten(locationId).then(setData);
  }, [mounted, locationId]);

  if (!mounted || !data || geschlossen) return null;

  const offen = data.ist_geoeffnet;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 mx-4 mt-2',
      offen
        ? 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-800'
        : 'bg-muted/50 border-border',
      className,
    )}>
      {/* Statuspunkt */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {offen && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-60" />
        )}
        <span className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          offen ? 'bg-matcha-500' : 'bg-muted-foreground/50',
        )} />
      </span>

      <Clock className={cn(
        'h-3.5 w-3.5 shrink-0',
        offen ? 'text-matcha-600 dark:text-matcha-400' : 'text-muted-foreground',
      )} />

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-bold',
          offen ? 'text-matcha-800 dark:text-matcha-200' : 'text-foreground',
        )}>
          {offen ? 'Lieferung möglich' : 'Aktuell geschlossen'}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{data.nachricht}</p>
        {!offen && data.naechster_slot_label && (
          <p className="text-[10px] font-bold text-saffron">
            Nächster Slot: {data.naechster_slot_label}
          </p>
        )}
      </div>

      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded p-0.5 hover:bg-black/10 transition text-muted-foreground"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
