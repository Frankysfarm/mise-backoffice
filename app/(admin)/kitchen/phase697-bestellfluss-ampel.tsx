'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  status: string;
}

interface Props {
  orders: Order[];
  zielProStunde?: number;
}

type Ampel = 'grün' | 'gelb' | 'rot';

function berechneAmpel(orders: Order[], ziel: number): { rate: number; ampel: Ampel; label: string } {
  const jetzt = new Date();
  const vonMs = jetzt.getTime() - 60 * 60_000;
  const letzteStunde = orders.filter(
    (o) => new Date(o.created_at).getTime() >= vonMs,
  ).length;

  const ampel: Ampel =
    letzteStunde >= ziel * 0.85 ? 'grün' : letzteStunde >= ziel * 0.5 ? 'gelb' : 'rot';

  const label =
    ampel === 'grün' ? 'Hohe Nachfrage' : ampel === 'gelb' ? 'Moderate Nachfrage' : 'Geringe Nachfrage';

  return { rate: letzteStunde, ampel, label };
}

const AMPEL_STYLE: Record<Ampel, { bg: string; dot: string; text: string }> = {
  grün: {
    bg: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  gelb: {
    bg: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  rot: {
    bg: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

export function KitchenPhase697BestellflussAmpel({ orders, zielProStunde = 10 }: Props) {
  const [zustand, setZustand] = useState<ReturnType<typeof berechneAmpel>>({
    rate: 0,
    ampel: 'rot',
    label: 'Geringe Nachfrage',
  });

  const refresh = useCallback(() => {
    setZustand(berechneAmpel(orders, zielProStunde));
  }, [orders, zielProStunde]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const style = AMPEL_STYLE[zustand.ampel];

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${style.bg}`}>
      <span className={`inline-flex h-3 w-3 shrink-0 rounded-full ${style.dot} animate-pulse`} />
      <Activity className={`h-4 w-4 shrink-0 ${style.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${style.text}`}>{zustand.label}</p>
        <p className={`text-[10px] ${style.text} opacity-75`}>
          {zustand.rate} Bestellungen / Stunde · Ziel: {zielProStunde}/h
        </p>
      </div>
      <div className={`flex flex-col items-end ${style.text}`}>
        <span className="text-xl font-bold tabular-nums leading-none">{zustand.rate}</span>
        <span className="text-[9px] uppercase tracking-wide opacity-70">/ Std</span>
      </div>
    </div>
  );
}
