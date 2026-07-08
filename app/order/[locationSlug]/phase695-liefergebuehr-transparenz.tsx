'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  basisGebuehr: number;
  zonenZuschlag?: number;
  zone?: string | null;
  distanzKm?: number | null;
}

export function Phase695LiefergebuehrTransparenz({
  basisGebuehr,
  zonenZuschlag = 0,
  zone = null,
  distanzKm = null,
}: Props) {
  const [open, setOpen] = useState(false);

  const gesamt = basisGebuehr + zonenZuschlag;

  if (gesamt <= 0) return null;

  return (
    <div className="rounded-xl border bg-card p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Liefergebühr <span className="font-bold">{gesamt.toFixed(2)} €</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {open ? (
            <>weniger <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Details <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Basisgebühr</span>
              <span className="font-medium tabular-nums">{basisGebuehr.toFixed(2)} €</span>
            </div>

            {zonenZuschlag > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Zonen-Zuschlag
                  {zone && <span className="ml-1 text-[10px]">(Zone {zone})</span>}
                </span>
                <span className="font-medium tabular-nums">+{zonenZuschlag.toFixed(2)} €</span>
              </div>
            )}

            {distanzKm !== null && distanzKm > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entfernung</span>
                <span className="text-[11px] text-muted-foreground">{distanzKm.toFixed(1)} km</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-1.5 font-bold">
              <span>Gesamt</span>
              <span className="tabular-nums">{gesamt.toFixed(2)} €</span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Die Liefergebühr deckt Transport- und Betriebskosten.
            {zonenZuschlag > 0 && ' Ein Zonen-Zuschlag gilt für weiter entfernte Lieferbereiche.'}
          </p>
        </div>
      )}
    </div>
  );
}
