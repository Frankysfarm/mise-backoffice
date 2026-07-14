'use client';

import React, { useMemo } from 'react';

interface BestellungInput {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  delivery_zone: string | null;
}

interface Props {
  orders: BestellungInput[];
  fahrerEtaMin?: number;
  pufferMin?: number;
}

interface KochstartEmpfehlung {
  id: string;
  bestellnummer: string;
  prepMin: number;
  kochstartIn: number;
  empfehlung: 'jetzt' | 'bald' | 'warten';
  zone: string | null;
  alter_min: number;
}

export function KitchenPhase1553KochstartPriorisierungsBoard({
  orders,
  fahrerEtaMin = 15,
  pufferMin = 3,
}: Props) {
  const now = useMemo(() => Date.now(), []);

  const empfehlungen: KochstartEmpfehlung[] = useMemo(() => {
    return orders
      .filter(o => ['accepted', 'preparing', 'pending'].includes(o.status))
      .map(o => {
        const prepMin = o.geschaetzte_zubereitung_min ?? 12;
        const alter_min = o.bestellt_am
          ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
          : 0;
        // Kochstart sollte so sein: fertig_am = jetzt + prepMin <= fahrerEtaMin + puffer
        // => kochstartIn = fahrerEtaMin - prepMin - pufferMin (Min bis Kochstart)
        const kochstartIn = fahrerEtaMin - prepMin - pufferMin;
        let empfehlung: KochstartEmpfehlung['empfehlung'];
        if (kochstartIn <= 0) empfehlung = 'jetzt';
        else if (kochstartIn <= 5) empfehlung = 'bald';
        else empfehlung = 'warten';

        return { id: o.id, bestellnummer: o.bestellnummer, prepMin, kochstartIn, empfehlung, zone: o.delivery_zone, alter_min };
      })
      .sort((a, b) => a.kochstartIn - b.kochstartIn);
  }, [orders, fahrerEtaMin, pufferMin, now]);

  if (empfehlungen.length === 0) return null;

  const empColor: Record<KochstartEmpfehlung['empfehlung'], string> = {
    jetzt: 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700',
    bald:  'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700',
    warten:'bg-muted/40 border-border',
  };
  const empLabel: Record<KochstartEmpfehlung['empfehlung'], string> = {
    jetzt: '🔴 JETZT starten',
    bald:  '🟡 Bald starten',
    warten:'🟢 Warten',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base">🍳</span>
        <h3 className="text-sm font-bold text-foreground">Kochstart-Priorisierung</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Fahrer-ETA: {fahrerEtaMin} Min · Puffer: {pufferMin} Min
        </span>
      </div>

      <div className="space-y-2">
        {empfehlungen.map(e => (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${empColor[e.empfehlung]}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                #{e.bestellnummer}
                {e.zone ? <span className="ml-1 text-muted-foreground font-normal">({e.zone})</span> : null}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Prep {e.prepMin} Min · Alter {e.alter_min} Min
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold">{empLabel[e.empfehlung]}</p>
              {e.kochstartIn > 0 && (
                <p className="text-[10px] text-muted-foreground">in {e.kochstartIn} Min</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
