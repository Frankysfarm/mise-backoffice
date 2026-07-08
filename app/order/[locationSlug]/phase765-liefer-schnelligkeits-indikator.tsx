'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  locationId: string;
}

interface TempoData {
  tempoHeute: number | null;
  tempoSchnitt: number | null;
  deltaPct: number;
  status: 'schneller' | 'langsamer' | 'normal' | 'keine_daten';
  lieferungenHeute: number;
}

export function Phase765LieferSchnelligkeitsIndikator({ locationId }: Props) {
  const [daten, setDaten] = useState<TempoData | null>(null);

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/admin/liefer-tempo-indikator?location_id=${locationId}`);
      const j = await r.json();
      if (j.ok) setDaten(j);
    } catch { /* silent */ }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 120_000);
    return () => clearInterval(t);
  }, [laden]);

  if (!daten || daten.status === 'keine_daten' || daten.lieferungenHeute === 0) return null;

  const { status, tempoHeute, deltaPct, lieferungenHeute } = daten;

  const config = {
    schneller: {
      icon: <TrendingDown className="h-4 w-4 text-emerald-500" />,
      label: 'Schneller als üblich',
      sub: `${Math.abs(deltaPct)}% schneller`,
      border: 'border-emerald-200 dark:border-emerald-800',
      bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    langsamer: {
      icon: <TrendingUp className="h-4 w-4 text-amber-500" />,
      label: 'Langsamer als üblich',
      sub: `${Math.abs(deltaPct)}% langsamer`,
      border: 'border-amber-200 dark:border-amber-800',
      bg: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
      text: 'text-amber-700 dark:text-amber-300',
    },
    normal: {
      icon: <Minus className="h-4 w-4 text-blue-500" />,
      label: 'Tempo wie üblich',
      sub: 'Auf Kurs',
      border: 'border-blue-200 dark:border-blue-800',
      bg: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
      text: 'text-blue-700 dark:text-blue-300',
    },
    keine_daten: {
      icon: <Zap className="h-4 w-4 text-slate-400" />,
      label: 'Keine Daten',
      sub: '',
      border: 'border-border',
      bg: 'from-muted/50 to-muted/30',
      text: 'text-muted-foreground',
    },
  }[status];

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border bg-gradient-to-r px-3 py-2.5 shadow-sm ${config.border} ${config.bg}`}>
      <div className="shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${config.text}`}>{config.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {config.sub}
          {tempoHeute !== null && ` · Ø ${tempoHeute} Min heute`}
          {` · ${lieferungenHeute} Lieferungen`}
        </p>
      </div>
    </div>
  );
}
