'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface Order {
  created_at?: string | null;
  status?: string | null;
}

interface Props {
  orders: Order[];
  zielProStunde?: number;
}

interface SpitzenzeitSlot {
  stunde: number;
  anzahl: number;
}

// Historical average per hour (0-23), derived from typical restaurant patterns
const HISTORISCH_PROFIL: Record<number, number> = {
  11: 4, 12: 14, 13: 18, 14: 10, 15: 5,
  16: 4, 17: 6, 18: 16, 19: 22, 20: 18,
  21: 12, 22: 6,
};

function findNaechsteSpitzenzeit(jetzt: Date): { stunde: number; minBis: number } | null {
  const jetztStunde = jetzt.getUTCHours();
  const jetztMin = jetzt.getUTCMinutes();

  for (let h = jetztStunde; h <= 22; h++) {
    const erwartete = HISTORISCH_PROFIL[h] ?? 0;
    if (erwartete >= 14) {
      const minBis = (h - jetztStunde) * 60 - jetztMin;
      if (minBis > 0 && minBis <= 60) return { stunde: h, minBis };
      if (h === jetztStunde && minBis <= 0) return null; // already in peak
    }
  }
  return null;
}

export function KitchenPhase702SpitzenzeitVorbereitungAlert({ orders, zielProStunde = 10 }: Props) {
  const [jetzt, setJetzt] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Last 60 min order count
  const cutoff = new Date(jetzt.getTime() - 60 * 60_000);
  const aktuelleRate = orders.filter(
    (o) => o.created_at && new Date(o.created_at) >= cutoff,
  ).length;

  const naechste = findNaechsteSpitzenzeit(jetzt);

  if (!naechste) return null;

  const auslastungsPct = Math.min(100, Math.round((aktuelleRate / zielProStunde) * 100));
  const istBereits = auslastungsPct >= 80;

  const bg = istBereits
    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
    : naechste.minBis <= 30
    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
    : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';

  const textColor = istBereits
    ? 'text-red-700 dark:text-red-400'
    : naechste.minBis <= 30
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-blue-700 dark:text-blue-400';

  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center gap-2">
        {naechste.minBis <= 30 ? (
          <AlertTriangle className={`h-4 w-4 shrink-0 ${textColor}`} />
        ) : (
          <Clock className={`h-4 w-4 shrink-0 ${textColor}`} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${textColor}`}>
            {naechste.minBis <= 15
              ? `Spitzenzeit JETZT — ${naechste.stunde}:00 Uhr`
              : naechste.minBis <= 30
              ? `Spitzenzeit in ${naechste.minBis} Min — Vorbereitung!`
              : `Spitzenzeit in ${naechste.minBis} Min (${naechste.stunde}:00 Uhr)`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Aktuelle Rate: {aktuelleRate} / {zielProStunde} Bestell./Std
          </p>
        </div>
        <div className={`text-sm font-bold tabular-nums ${textColor}`}>
          {naechste.minBis} Min
        </div>
      </div>
    </div>
  );
}
