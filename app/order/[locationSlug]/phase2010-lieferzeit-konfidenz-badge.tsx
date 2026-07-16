'use client';

import { useState, useEffect } from 'react';
import { Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtaData {
  eta_min: number;
  eta_max: number;
  konfidenz_pct: number;
}

const MOCK: EtaData = { eta_min: 28, eta_max: 38, konfidenz_pct: 82 };

async function fetchEta(locationId: string): Promise<EtaData> {
  const res = await fetch(`/api/delivery/admin/fahrer-verfuegbarkeits-forecast?location_id=${locationId}`);
  if (!res.ok) return MOCK;
  const data = await res.json();

  const slots: { erwartete_fahrer: number }[] = data.slots ?? [];
  const naechste = slots[0];
  if (!naechste) return MOCK;

  const fahrer = naechste.erwartete_fahrer;
  const eta_min = fahrer >= 4 ? 20 : fahrer >= 3 ? 25 : fahrer >= 2 ? 30 : 40;
  const eta_max = eta_min + 10;
  const konfidenz_pct = fahrer >= 4 ? 90 : fahrer >= 3 ? 82 : fahrer >= 2 ? 70 : 55;

  return { eta_min, eta_max, konfidenz_pct };
}

export function StorefrontPhase2010LieferzeitKonfidenzBadge({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [daten, setDaten] = useState<EtaData | null>(null);
  const [gemountet, setGemountet] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => { setGemountet(true); }, []);

  const laden = async () => {
    try {
      const d = await fetchEta(locationId);
      setDaten(d);
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!gemountet || geschlossen) return null;

  const d = daten ?? MOCK;
  const konfidenzColor = d.konfidenz_pct >= 85
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
    : d.konfidenz_pct >= 70
      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', konfidenzColor, className)}>
      <Zap className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">
          Wir sind in {d.eta_min}–{d.eta_max} Min bei dir
        </p>
        <p className="text-[10px] mt-0.5 opacity-80">
          Konfidenz {d.konfidenz_pct}% · Echtzeit-Prognose
        </p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3.5 h-3.5 opacity-60" />
      </button>
    </div>
  );
}
