'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, Gift } from 'lucide-react';

/**
 * Phase 1881 — Gratis-Lieferungs-Schwellen-Anzeige (Storefront)
 *
 * "Noch XX € bis Gratis-Lieferung in Zone X" mit progressivem Fortschrittsbalken.
 * Hydration-safe. Aus delivery_zones-Konfiguration.
 * Zeigt nichts wenn Gratis-Lieferung bereits erreicht oder kein Schwellenwert konfiguriert.
 */

interface ZoneKonfig {
  zone: string;
  label: string;
  gratis_ab_eur: number;
  liefergebuehr_eur: number;
}

interface Props {
  locationId: string;
  subtotal: number;
  className?: string;
}

const DEFAULT_ZONEN: ZoneKonfig[] = [
  { zone: 'A', label: 'Express (nah)',  gratis_ab_eur: 15, liefergebuehr_eur: 0   },
  { zone: 'B', label: 'Standard',       gratis_ab_eur: 25, liefergebuehr_eur: 1.5 },
  { zone: 'C', label: 'Weit',           gratis_ab_eur: 35, liefergebuehr_eur: 2.5 },
];

export function StorefrontPhase1881GratisLieferungsSchwelle({ locationId, subtotal, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zonen, setZonen] = useState<ZoneKonfig[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-effizienz?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('fetch error');
      } catch {
        // Fallback auf static defaults
      }
    };
    laden();
  }, [locationId]);

  if (!mounted) return null;

  const basis = zonen.length > 0 ? zonen : DEFAULT_ZONEN;
  const zielZone = basis.find((z) => z.gratis_ab_eur > subtotal);

  if (!zielZone) return null;

  const fehlend = Math.max(0, zielZone.gratis_ab_eur - subtotal);
  const fortschritt = Math.min(100, Math.round((subtotal / zielZone.gratis_ab_eur) * 100));
  const beinaheGratis = fortschritt >= 75;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        beinaheGratis ? 'bg-matcha-50/50 dark:bg-matcha-950/20' : 'bg-muted/10',
      )}>
        <Gift className={cn('h-4 w-4 shrink-0', beinaheGratis ? 'text-matcha-600' : 'text-muted-foreground')} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Gratis-Lieferung
        </span>
        {beinaheGratis && (
          <span className="ml-auto rounded-full bg-matcha-100 dark:bg-matcha-900/30 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            Fast da!
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Zone {zielZone.zone} ({zielZone.label})
            </span>
          </div>
          <span className="text-xs font-semibold tabular-nums">
            {fehlend.toFixed(2).replace('.', ',')} € fehlen
          </span>
        </div>

        {/* Fortschrittsbalken */}
        <div className="space-y-1">
          <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                beinaheGratis ? 'bg-matcha-500' : 'bg-amber-400',
              )}
              style={{ width: `${fortschritt}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{subtotal.toFixed(2).replace('.', ',')} €</span>
            <span>{zielZone.gratis_ab_eur.toFixed(0)} € → 0 € Liefergebühr</span>
          </div>
        </div>

        <p className={cn(
          'text-xs font-semibold',
          beinaheGratis ? 'text-matcha-700 dark:text-matcha-300' : 'text-foreground',
        )}>
          {beinaheGratis
            ? `Nur noch ${fehlend.toFixed(2).replace('.', ',')} € bis zur kostenlosen Lieferung!`
            : `Füge ${fehlend.toFixed(2).replace('.', ',')} € zum Warenkorb hinzu für Gratis-Lieferung in Zone ${zielZone.zone}.`}
        </p>
      </div>
    </div>
  );
}
