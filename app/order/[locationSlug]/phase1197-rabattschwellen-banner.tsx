'use client';

import { useMemo } from 'react';
import { Tag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1197 — Bestellwert-Rabatt-Schwellen-Banner (Storefront)
// Banner wenn Warenkorb X € unter nächster Rabattschwelle (z.B. 10% ab 30€)

interface Props {
  cartTotal: number;
  locationId: string;
}

type Schwelle = {
  mindestbetrag: number;
  rabatt_pct: number;
  label: string;
};

// Configurable thresholds — could come from an API in the future
const SCHWELLEN: Schwelle[] = [
  { mindestbetrag: 20, rabatt_pct: 5,  label: '5 % Rabatt ab 20 €' },
  { mindestbetrag: 30, rabatt_pct: 10, label: '10 % Rabatt ab 30 €' },
  { mindestbetrag: 50, rabatt_pct: 15, label: '15 % Rabatt ab 50 €' },
];

type BannerInfo = {
  schwelle: Schwelle;
  fehlend: number;
};

function findNaechsteSchwelle(total: number): BannerInfo | null {
  for (const s of SCHWELLEN) {
    if (total < s.mindestbetrag) {
      return { schwelle: s, fehlend: parseFloat((s.mindestbetrag - total).toFixed(2)) };
    }
  }
  return null;
}

function formatEur(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

export function Phase1197RabattschwellenBanner({ cartTotal, locationId: _locationId }: Props) {
  const info = useMemo(() => findNaechsteSchwelle(cartTotal), [cartTotal]);

  if (!info || cartTotal <= 0) return null;

  const progressPct = Math.min(100, Math.round((cartTotal / info.schwelle.mindestbetrag) * 100));

  return (
    <div className={cn(
      'rounded-xl border shadow-sm px-4 py-3 space-y-2',
      'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              Noch {formatEur(info.fehlend)} bis {info.schwelle.label}!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Du bist fast da — leg noch etwas in den Warenkorb
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
            {info.schwelle.rabatt_pct} %
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formatEur(cartTotal)}
          </span>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formatEur(info.schwelle.mindestbetrag)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
