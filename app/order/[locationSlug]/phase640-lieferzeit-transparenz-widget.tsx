'use client';

import { useState } from 'react';
import { Info, ChefHat, Bike, Shield, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  deliveryTimeMin?: number;
}

interface Schritt {
  icon: React.ReactNode;
  label: string;
  minuten: number;
  farbe: string;
}

export function Phase640LieferzeitTransparenzWidget({ deliveryTimeMin = 35 }: Props) {
  const [open, setOpen] = useState(false);

  const kueche = Math.round(deliveryTimeMin * 0.45);
  const fahrt = Math.round(deliveryTimeMin * 0.40);
  const puffer = deliveryTimeMin - kueche - fahrt;

  const schritte: Schritt[] = [
    {
      icon: <ChefHat className="h-4 w-4" />,
      label: 'Zubereitung in der Küche',
      minuten: kueche,
      farbe: 'bg-orange-500',
    },
    {
      icon: <Bike className="h-4 w-4" />,
      label: 'Fahrt zu dir',
      minuten: fahrt,
      farbe: 'bg-blue-500',
    },
    {
      icon: <Shield className="h-4 w-4" />,
      label: 'Sicherheitspuffer',
      minuten: puffer,
      farbe: 'bg-emerald-500',
    },
  ];

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="flex-1 text-sm font-semibold text-sky-800 dark:text-sky-200">
          Wie berechnet sich meine Lieferzeit?
        </span>
        <span className="text-xs font-black text-sky-700 dark:text-sky-300 tabular-nums">
          ~{deliveryTimeMin} Min.
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-sky-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-sky-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Balken-Visualisierung */}
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {schritte.map((s) => (
              <div
                key={s.label}
                className={`${s.farbe} rounded-full`}
                style={{ flex: s.minuten }}
                title={`${s.label}: ${s.minuten} Min.`}
              />
            ))}
          </div>

          {/* Legende */}
          <div className="flex flex-col gap-2">
            {schritte.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${s.farbe} shrink-0`} />
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 shrink-0">
                  {s.icon}
                  <span className="text-xs text-gray-700 dark:text-gray-300">{s.label}</span>
                </span>
                <span className="ml-auto text-xs font-bold text-gray-600 dark:text-gray-400 tabular-nums">
                  {s.minuten} Min.
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
            Die Lieferzeit wird in Echtzeit angepasst – je nach Auslastung der Küche, Verkehr und
            verfügbaren Fahrern. Wir halten dich auf dem Laufenden.
          </p>
        </div>
      )}
    </div>
  );
}
