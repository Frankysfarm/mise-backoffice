'use client';

import { useEffect, useRef, useState } from 'react';

interface Order {
  id: string;
  status: string;
}

interface Props {
  orders: Order[];
}

function animiereZahl(
  von: number,
  bis: number,
  dauer: number,
  setter: (n: number) => void,
  rafRef: React.MutableRefObject<number>,
) {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dauer);
    setter(Math.round(von + (bis - von) * t));
    if (t < 1) rafRef.current = requestAnimationFrame(step);
  };
  rafRef.current = requestAnimationFrame(step);
}

export function KitchenPhase752LiveBestellzaehler({ orders }: Props) {
  const [angezeigt, setAngezeigt] = useState(0);
  const rafRef = useRef<number>(0);

  const aktiv = orders.filter((o) =>
    ['neu', 'new', 'pending', 'bestätigt', 'confirmed', 'in_zubereitung', 'cooking'].includes(o.status)
  ).length;

  const gesamt = orders.length;
  const fertig = orders.filter((o) =>
    ['fertig', 'ready', 'completed', 'delivered', 'geliefert'].includes(o.status)
  ).length;

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    animiereZahl(angezeigt, aktiv, 400, setAngezeigt, rafRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv]);

  const auslastungPct = gesamt > 0 ? Math.round((aktiv / gesamt) * 100) : 0;
  const farbe = aktiv > 15 ? 'text-red-600 dark:text-red-400'
    : aktiv > 8 ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-stretch gap-4">
        <div className="flex-1 text-center">
          <div className={`text-5xl font-black tabular-nums leading-none ${farbe}`}>
            {angezeigt}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">Aktiv</p>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums">{gesamt}</div>
            <p className="text-[9px] text-muted-foreground">Gesamt</p>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fertig}</div>
            <p className="text-[9px] text-muted-foreground">Fertig</p>
          </div>
          <div className="col-span-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${aktiv > 15 ? 'bg-red-500' : aktiv > 8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${auslastungPct}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">{auslastungPct}% Last</p>
          </div>
        </div>
      </div>
    </div>
  );
}
