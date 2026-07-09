'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Euro, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1031 — Einnahmen-Prognose-Assistent (Fahrer-App)
 *
 * Prognose Tageseinnahmen basierend auf bisheriger Schicht
 * + Wochentag-Faktor + aktueller Bestelldichte.
 * 10-Minuten-Polling, isOnline-Guard.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface SchichtBilanz {
  umsatz?: number;
  trinkgeld?: number;
  bonus?: number;
  stopps?: number;
  schicht_dauer_min?: number;
}

const WOCHENTAG_FAKTOR: Record<number, number> = {
  0: 1.20, // So
  1: 0.85, // Mo
  2: 0.88, // Di
  3: 0.92, // Mi
  4: 0.98, // Do
  5: 1.30, // Fr
  6: 1.40, // Sa
};

function prognoseBerechnen(bilanz: SchichtBilanz, bestelldichte: number): {
  hoch: number; mitte: number; tief: number; konfidenz: 'hoch' | 'mittel' | 'niedrig';
} {
  const schichtMin = bilanz.schicht_dauer_min ?? 1;
  const bisherGesamt = (bilanz.umsatz ?? 0) + (bilanz.trinkgeld ?? 0) + (bilanz.bonus ?? 0);
  if (schichtMin < 5) return { hoch: 140, mitte: 110, tief: 80, konfidenz: 'niedrig' };

  const stundensatz = bisherGesamt / (schichtMin / 60);
  const verbleibendeStunden = Math.max(0, 8 - schichtMin / 60);
  const tagFaktor = WOCHENTAG_FAKTOR[new Date().getDay()] ?? 1.0;
  const dichFaktor = bestelldichte > 0 ? Math.min(1.3, 0.8 + bestelldichte / 50) : 1.0;

  const basisPrognose = bisherGesamt + stundensatz * verbleibendeStunden * tagFaktor * dichFaktor;
  const konfidenz: 'hoch' | 'mittel' | 'niedrig' = schichtMin >= 60 ? 'hoch' : schichtMin >= 20 ? 'mittel' : 'niedrig';

  return {
    hoch: Math.round(basisPrognose * 1.15),
    mitte: Math.round(basisPrognose),
    tief: Math.round(basisPrognose * 0.85),
    konfidenz,
  };
}

export function FahrerPhase1031EinnahmenPrognoseAssistent({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [bilanz, setBilanz] = useState<SchichtBilanz>({});
  const [bestelldichte, setBestelldichte] = useState(0);

  useEffect(() => {
    if (!isOnline) return;
    const load = async () => {
      try {
        const [bilanzRes, dichteRes] = await Promise.all([
          fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/delivery/admin/bestelldichte-live`).then(r => r.ok ? r.json() : null),
        ]);
        if (bilanzRes) {
          setBilanz({
            umsatz: bilanzRes.umsatz ?? 0,
            trinkgeld: bilanzRes.trinkgeld ?? 0,
            bonus: bilanzRes.bonus ?? 0,
            stopps: bilanzRes.stopps ?? 0,
            schicht_dauer_min: bilanzRes.schicht_dauer_min ?? 0,
          });
        }
        if (dichteRes?.gesamt_4h != null) setBestelldichte(dichteRes.gesamt_4h);
      } catch {}
    };
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const bisherGesamt = (bilanz.umsatz ?? 0) + (bilanz.trinkgeld ?? 0) + (bilanz.bonus ?? 0);
  const prognose = prognoseBerechnen(bilanz, bestelldichte);
  const fortschritt = Math.min(100, Math.round((bisherGesamt / 120) * 100));

  const konfidenzStyle = {
    hoch: 'text-matcha-600 dark:text-matcha-400',
    mittel: 'text-amber-600 dark:text-amber-400',
    niedrig: 'text-zinc-500',
  }[prognose.konfidenz];

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden mx-4 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Einnahmen-Prognose</span>
          <span className={cn('text-xs font-semibold', konfidenzStyle)}>
            ~{prognose.mitte}€ heute
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Bisheriger Stand */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bisher verdient</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{bisherGesamt.toFixed(2)} €</span>
          </div>

          {/* Fortschrittsbalken vs. 120€-Tagesziel */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Tagesziel: 120 €</span>
              <span>{fortschritt} %</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  fortschritt >= 100 ? 'bg-matcha-500' : fortschritt >= 50 ? 'bg-blue-500' : 'bg-amber-500',
                )}
                style={{ width: `${fortschritt}%` }}
              />
            </div>
          </div>

          {/* Prognose-Range */}
          <div className="rounded-lg bg-matcha-50 dark:bg-matcha-900/10 border border-matcha-200 dark:border-matcha-800 p-3">
            <div className="flex items-center gap-1 mb-2">
              <Euro className="h-3.5 w-3.5 text-matcha-600" />
              <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">Tagesprognose</span>
              <span className={cn('ml-auto text-[10px] font-semibold', konfidenzStyle)}>
                Konfidenz: {prognose.konfidenz}
              </span>
            </div>
            <div className="flex items-end gap-2 justify-between">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Tief</p>
                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{prognose.tief} €</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Mitte</p>
                <p className="text-2xl font-bold text-matcha-600">{prognose.mitte} €</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Hoch</p>
                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{prognose.hoch} €</p>
              </div>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Umsatz', value: `${(bilanz.umsatz ?? 0).toFixed(0)} €` },
              { label: 'Trinkgeld', value: `${(bilanz.trinkgeld ?? 0).toFixed(0)} €` },
              { label: 'Stopps', value: `${bilanz.stopps ?? 0}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-right">
            Wochentag-Faktor + Bestelldichte · 10-Min-Aktualisierung
          </p>
        </div>
      )}
    </div>
  );
}
