'use client';

import { useState, useEffect } from 'react';
import { Clock, Flame, ChefHat, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type KitchenOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'neu' | 'bestätigt' | 'in_zubereitung';
  bestellt_am: string;
  geschaetzte_zubereitung_min: number;
  items_count: number;
};

interface Props {
  orders?: KitchenOrder[];
}

const MOCK_ORDERS: KitchenOrder[] = [
  { id: '1', bestellnummer: '#1042', kunde_name: 'Max Müller', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 22 * 60000).toISOString(), geschaetzte_zubereitung_min: 20, items_count: 3 },
  { id: '2', bestellnummer: '#1043', kunde_name: 'Anna Schmidt', status: 'neu', bestellt_am: new Date(Date.now() - 3 * 60000).toISOString(), geschaetzte_zubereitung_min: 15, items_count: 2 },
  { id: '3', bestellnummer: '#1044', kunde_name: 'Tom Becker', status: 'bestätigt', bestellt_am: new Date(Date.now() - 8 * 60000).toISOString(), geschaetzte_zubereitung_min: 25, items_count: 5 },
  { id: '4', bestellnummer: '#1045', kunde_name: 'Lisa Weber', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 18 * 60000).toISOString(), geschaetzte_zubereitung_min: 15, items_count: 1 },
];

function getRemainingMin(order: KitchenOrder): number {
  const elapsedMs = Date.now() - new Date(order.bestellt_am).getTime();
  const elapsedMin = elapsedMs / 60000;
  return order.geschaetzte_zubereitung_min - elapsedMin;
}

type Urgency = 'kritisch' | 'dringend' | 'normal' | 'ok';

function getUrgency(remaining: number): Urgency {
  if (remaining < 0) return 'kritisch';
  if (remaining <= 5) return 'dringend';
  if (remaining <= 15) return 'normal';
  return 'ok';
}

const urgencyConfig: Record<Urgency, { border: string; bg: string; badge: string; text: string }> = {
  kritisch: { border: 'border-red-500', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', text: 'text-red-600' },
  dringend: { border: 'border-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
  normal:   { border: 'border-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-600' },
  ok:       { border: 'border-green-400', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', text: 'text-green-600' },
};

const phaseConfig: Record<KitchenOrder['status'], { label: string; icon: React.ReactNode }> = {
  neu:             { label: 'Neu', icon: <Zap className="w-3 h-3" /> },
  bestätigt:       { label: 'Bestätigt', icon: <CheckCircle2 className="w-3 h-3" /> },
  in_zubereitung:  { label: 'In Zubereitung', icon: <ChefHat className="w-3 h-3" /> },
};

function formatRemaining(min: number): string {
  if (min < 0) return `+${Math.abs(Math.ceil(min))} Min überfällig`;
  const m = Math.floor(min);
  const s = Math.floor((min - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')} Min`;
}

export function KitchenOrderTimingProAnzeige({ orders }: Props) {
  const data = orders && orders.length > 0 ? orders : MOCK_ORDERS;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...data].sort((a, b) => getRemainingMin(a) - getRemainingMin(b));

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="font-bold text-gray-800 text-sm">Küchen-Timing</h2>
        <span className="ml-auto text-xs text-gray-400">{sorted.length} aktiv</span>
      </div>

      {sorted.map(order => {
        const remaining = getRemainingMin(order);
        const urgency = getUrgency(remaining);
        const cfg = urgencyConfig[urgency];
        const phase = phaseConfig[order.status];
        const shouldStart = urgency === 'dringend' && order.status === 'neu';

        return (
          <div key={order.id} className={cn('rounded-lg border-2 p-3', cfg.border, cfg.bg)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{order.bestellnummer}</span>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.badge)}>
                    {phase.icon}{phase.label}
                  </span>
                  {shouldStart && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                      <Zap className="w-3 h-3" />Jetzt starten!
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{order.kunde_name} · {order.items_count} Artikel</p>
              </div>
              <div className="text-right shrink-0">
                <div className={cn('flex items-center gap-1 font-mono text-sm font-bold', cfg.text)}>
                  {urgency === 'kritisch' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {formatRemaining(remaining)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Ziel: {order.geschaetzte_zubereitung_min} Min</p>
              </div>
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-sm">Keine aktiven Bestellungen</p>
        </div>
      )}
    </div>
  );
}
