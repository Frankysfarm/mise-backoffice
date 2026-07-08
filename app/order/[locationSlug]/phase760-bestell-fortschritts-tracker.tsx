'use client';

import { CheckCircle, Circle, Clock, Package, Truck, Star } from 'lucide-react';

interface Props {
  status?: string;
  createdAt?: string;
  estimatedMinutes?: number;
}

interface Schritt {
  key: string;
  label: string;
  statuses: string[];
  icon: React.ElementType;
}

const SCHRITTE: Schritt[] = [
  { key: 'bestaetigt', label: 'Bestätigt', statuses: ['confirmed', 'pending', 'new', 'accepted'], icon: CheckCircle },
  { key: 'zubereitung', label: 'Zubereitung', statuses: ['preparing', 'in_kitchen', 'cooking'], icon: Package },
  { key: 'unterwegs', label: 'Unterwegs', statuses: ['in_delivery', 'in_lieferung', 'picked_up', 'on_the_way'], icon: Truck },
  { key: 'geliefert', label: 'Geliefert', statuses: ['delivered', 'completed', 'abgeschlossen', 'geliefert'], icon: Star },
];

function statusIndex(status?: string): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  for (let i = SCHRITTE.length - 1; i >= 0; i--) {
    if (SCHRITTE[i].statuses.some((st) => s.includes(st))) return i;
  }
  return 0;
}

function minutenSeit(iso?: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function Phase760BestellFortschrittsTracker({ status, createdAt, estimatedMinutes }: Props) {
  const aktuell = statusIndex(status);
  const vergangen = minutenSeit(createdAt);
  const verbleibend = estimatedMinutes !== undefined ? Math.max(0, estimatedMinutes - vergangen) : null;

  if (!status) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Bestellstatus</p>
        {verbleibend !== null && verbleibend > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>noch ca. <span className="font-bold text-foreground">{verbleibend} Min</span></span>
          </div>
        )}
      </div>

      {/* Schritte */}
      <div className="flex items-center">
        {SCHRITTE.map((schritt, i) => {
          const erledigt = i <= aktuell;
          const aktuellStep = i === aktuell;
          const Icon = schritt.icon;
          return (
            <div key={schritt.key} className="flex items-center flex-1 last:flex-none">
              {/* Icon + Label */}
              <div className="flex flex-col items-center gap-1">
                <div className={`
                  h-8 w-8 rounded-full flex items-center justify-center transition-all duration-500
                  ${aktuellStep
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200 dark:shadow-blue-900 scale-110'
                    : erledigt
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'}
                `}>
                  {erledigt && !aktuellStep
                    ? <CheckCircle className="h-4 w-4" />
                    : aktuellStep
                    ? <Icon className="h-4 w-4 animate-pulse" />
                    : <Circle className="h-4 w-4" />}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight max-w-[48px] ${erledigt ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {schritt.label}
                </span>
              </div>

              {/* Verbindungslinie */}
              {i < SCHRITTE.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: i < aktuell ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Verstrichene Zeit */}
      {vergangen > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Bestellung aufgegeben vor {vergangen} Min
        </p>
      )}
    </div>
  );
}
