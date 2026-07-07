'use client';

import { CheckCircle2, ChefHat, Truck, PackageCheck, Clock } from 'lucide-react';

interface Props {
  status: string;
  isDelivery: boolean;
}

interface Stufe {
  key: string[];
  label: string;
  subLabel?: string;
  icon: React.ElementType;
}

export function Phase609BestellstatusTimeline({ status, isDelivery }: Props) {
  const stufen: Stufe[] = [
    {
      key: ['bestätigt', 'neu'],
      label: 'Bestätigt',
      subLabel: 'Deine Bestellung wurde angenommen',
      icon: CheckCircle2,
    },
    {
      key: ['in_zubereitung'],
      label: 'In Zubereitung',
      subLabel: 'Die Küche bereitet deine Bestellung zu',
      icon: ChefHat,
    },
    {
      key: ['fertig'],
      label: 'Fertig',
      subLabel: isDelivery ? 'Bereit zur Abholung durch den Fahrer' : 'Bereit zur Abholung',
      icon: PackageCheck,
    },
    ...(isDelivery
      ? [
          {
            key: ['unterwegs', 'in_lieferung'],
            label: 'Unterwegs',
            subLabel: 'Dein Fahrer ist auf dem Weg',
            icon: Truck,
          },
          {
            key: ['geliefert'],
            label: 'Geliefert',
            subLabel: 'Guten Appetit!',
            icon: CheckCircle2,
          },
        ]
      : [
          {
            key: ['abgeholt', 'geliefert'],
            label: 'Abgeholt',
            subLabel: 'Guten Appetit!',
            icon: CheckCircle2,
          },
        ]),
  ];

  const statusReihenfolge = [
    'neu',
    'bestätigt',
    'in_zubereitung',
    'fertig',
    'unterwegs',
    'in_lieferung',
    'abgeholt',
    'geliefert',
  ];

  const aktuellerRang = statusReihenfolge.indexOf(status);

  function stufenRang(keys: string[]): number {
    return Math.max(...keys.map((k) => statusReihenfolge.indexOf(k)));
  }

  function istErreicht(keys: string[]): boolean {
    return stufenRang(keys) <= aktuellerRang;
  }

  function istAktiv(keys: string[]): boolean {
    return keys.includes(status);
  }

  const aktiveIdx = stufen.findIndex((s) => istAktiv(s.key));
  const fertigeAnzahl = stufen.filter((s) => istErreicht(s.key)).length;
  const gesamtH = (stufen.length - 1) * 64;
  const fortschrittH =
    fertigeAnzahl > 0 ? Math.min(((fertigeAnzahl - 0.5) / (stufen.length - 1)) * 100, 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 pt-4 pb-3 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">
        Bestellverlauf
      </h3>
      <div className="relative pl-8">
        {/* Hintergrund-Linie */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        {/* Fortschritts-Linie */}
        <div
          className="absolute left-3 top-0 w-0.5 bg-matcha-500 transition-all duration-700"
          style={{ height: `${fortschrittH}%` }}
        />

        <div className="space-y-4">
          {stufen.map((stufe, idx) => {
            const erreicht = istErreicht(stufe.key);
            const aktiv = istAktiv(stufe.key);
            const Icon = stufe.icon;

            return (
              <div key={idx} className="relative flex items-start gap-0 min-h-[3rem]">
                {/* Icon-Kreis */}
                <div
                  className={`absolute -left-5 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    aktiv
                      ? 'border-matcha-500 bg-matcha-500 text-white shadow-md shadow-matcha-200 dark:shadow-matcha-900/50'
                      : erreicht
                      ? 'border-matcha-400 bg-matcha-100 dark:bg-matcha-900 text-matcha-600 dark:text-matcha-400'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-300 dark:text-gray-600'
                  }`}
                >
                  {aktiv ? (
                    <Icon className="w-3 h-3 animate-pulse" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </div>

                {/* Text */}
                <div className={idx < stufen.length - 1 ? 'pb-4' : ''}>
                  <div
                    className={`text-sm font-semibold leading-tight ${
                      aktiv
                        ? 'text-matcha-700 dark:text-matcha-300'
                        : erreicht
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {stufe.label}
                    {aktiv && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-matcha-600 dark:text-matcha-400">
                        <Clock className="w-3 h-3" />
                        Jetzt
                      </span>
                    )}
                  </div>
                  {(aktiv || erreicht) && stufe.subLabel && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {stufe.subLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
