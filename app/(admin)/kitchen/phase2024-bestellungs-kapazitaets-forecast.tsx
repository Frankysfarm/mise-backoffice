'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Users, Coffee, CheckCircle } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
  scheduled_for?: string | null;
}

interface Props {
  orders: Order[];
}

interface Forecast {
  bestellungen_naechste_2h: number;
  ampel: 'gruen' | 'amber' | 'rot';
  empfehlung: string;
  empfehlung_icon: 'personal' | 'normal' | 'entspannen';
}

function computeForecast(orders: Order[]): Forecast {
  const now = Date.now();
  const window2h = now + 2 * 60 * 60 * 1000;
  const window1h = now - 60 * 60 * 1000;

  const scheduled = orders.filter(o => {
    if (!o.scheduled_for) return false;
    const t = new Date(o.scheduled_for).getTime();
    return t >= now && t <= window2h;
  }).length;

  const recent = orders.filter(o => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= window1h && t <= now;
  }).length;

  const forecast = scheduled + Math.round(recent * 1.5);

  const ampel: Forecast['ampel'] = forecast >= 20 ? 'rot' : forecast >= 10 ? 'amber' : 'gruen';
  const empfehlung_icon: Forecast['empfehlung_icon'] =
    ampel === 'rot' ? 'personal' : ampel === 'amber' ? 'normal' : 'entspannen';
  const empfehlung =
    ampel === 'rot'
      ? 'Mehr Personal einplanen — hohe Auslastung erwartet.'
      : ampel === 'amber'
        ? 'Normaler Betrieb — Team bereit halten.'
        : 'Ruhige Phase — Team kann rotieren.';

  return { bestellungen_naechste_2h: forecast, ampel, empfehlung, empfehlung_icon };
}

const ICON_MAP = {
  personal: <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
  normal: <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
  entspannen: <Coffee className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
};

const AMPEL_STYLES = {
  rot: {
    ring: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    value: 'text-red-600',
  },
  amber: {
    ring: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    value: 'text-amber-600',
  },
  gruen: {
    ring: 'border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-900/20',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300',
    value: 'text-matcha-600',
  },
};

export function KitchenPhase2024BestellungsKapazitaetsForecast({ orders }: Props) {
  const forecast = useMemo(() => computeForecast(orders), [orders]);
  const styles = AMPEL_STYLES[forecast.ampel];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <TrendingUp className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Kapazitäts-Forecast (2h)</span>
        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', styles.badge)}>
          {forecast.ampel === 'rot' ? 'Hoch' : forecast.ampel === 'amber' ? 'Mittel' : 'Niedrig'}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Forecast number */}
        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-black', styles.value)}>
            {forecast.bestellungen_naechste_2h}
          </span>
          <span className="text-xs text-muted-foreground">Bestellungen in den nächsten 2h erwartet</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              forecast.ampel === 'rot' ? 'bg-red-500' : forecast.ampel === 'amber' ? 'bg-amber-400' : 'bg-matcha-500',
            )}
            style={{ width: `${Math.min(100, (forecast.bestellungen_naechste_2h / 25) * 100)}%` }}
          />
        </div>

        {/* Recommendation */}
        <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', styles.ring)}>
          <span className={styles.text}>{ICON_MAP[forecast.empfehlung_icon]}</span>
          <span className={cn('text-xs font-medium', styles.text)}>{forecast.empfehlung}</span>
        </div>
      </div>
    </div>
  );
}
