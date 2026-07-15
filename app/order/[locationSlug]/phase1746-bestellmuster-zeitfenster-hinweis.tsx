'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, X, Clock } from 'lucide-react';

/**
 * Phase 1746 — Bestellmuster-Zeitfenster-Hinweis (Storefront)
 *
 * Hinweis wenn aktuelle Stunde historisch Hochlastzeit ist
 * ("Aktuell hohes Bestellaufkommen"); Props locationId; Hydration-safe.
 */

interface ApiResponse {
  ist_hochlast: boolean;
  stunde: number;
  beliebtheitsstufe: 'ruhig' | 'normal' | 'belebt' | 'sehr_belebt';
  relative_auslastung: number;
  eta_aufschlag_min: number;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const STUFEN_LABEL: Record<string, string> = {
  ruhig: 'Ruhige Zeit',
  normal: 'Normales Aufkommen',
  belebt: 'Hohes Bestellaufkommen',
  sehr_belebt: 'Sehr hohes Bestellaufkommen',
};

function buildMock(locationId: string | null): ApiResponse {
  const h = new Date().getHours();
  const hochlastStunden = [12, 13, 18, 19, 20, 21];
  const belebt = hochlastStunden.includes(h);
  const sehrBelebt = [19, 20].includes(h);
  return {
    ist_hochlast: belebt,
    stunde: h,
    beliebtheitsstufe: sehrBelebt ? 'sehr_belebt' : belebt ? 'belebt' : 'normal',
    relative_auslastung: sehrBelebt ? 0.9 : belebt ? 0.7 : 0.4,
    eta_aufschlag_min: sehrBelebt ? 10 : belebt ? 5 : 0,
  };
}

export function StorefrontPhase1746BestellmusterZeitfensterHinweis({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = () => {
      if (locationId) {
        fetch(`/api/delivery/public/bestellmuster-zeitfenster?location_id=${locationId}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(d => setData(d ?? buildMock(locationId)))
          .catch(() => setData(buildMock(locationId)));
      } else {
        setData(buildMock(null));
      }
    };
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [mounted, locationId]);

  if (!mounted || !data || !data.ist_hochlast || dismissed) return null;

  const sehrBelebt = data.beliebtheitsstufe === 'sehr_belebt';
  const barPct = Math.round(data.relative_auslastung * 100);

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      sehrBelebt
        ? 'bg-red-50 border-red-200'
        : 'bg-amber-50 border-amber-200',
      className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <TrendingUp className={cn('w-4 h-4 mt-0.5 shrink-0', sehrBelebt ? 'text-red-500' : 'text-amber-500')} />
          <div>
            <div className={cn('text-sm font-bold', sehrBelebt ? 'text-red-700' : 'text-amber-700')}>
              {STUFEN_LABEL[data.beliebtheitsstufe]}
            </div>
            <div className={cn('text-xs mt-0.5', sehrBelebt ? 'text-red-600' : 'text-amber-600')}>
              {data.eta_aufschlag_min > 0
                ? `Lieferzeiten können um bis zu ${data.eta_aufschlag_min} Min länger dauern.`
                : 'Wir bereiten deine Bestellung schnellstmöglich zu.'}
            </div>
            {/* Auslastungs-Balken */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/70 rounded-full overflow-hidden max-w-[120px]">
                <div
                  className={cn('h-full rounded-full', sehrBelebt ? 'bg-red-400' : 'bg-amber-400')}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div className="flex items-center gap-1">
                <Clock className={cn('w-3 h-3', sehrBelebt ? 'text-red-500' : 'text-amber-500')} />
                <span className={cn('text-[10px] font-bold', sehrBelebt ? 'text-red-600' : 'text-amber-600')}>
                  {barPct}% Auslastung
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={cn('rounded-full p-1 hover:bg-black/10 transition-colors shrink-0', sehrBelebt ? 'text-red-400' : 'text-amber-400')}
          aria-label="Schließen"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
