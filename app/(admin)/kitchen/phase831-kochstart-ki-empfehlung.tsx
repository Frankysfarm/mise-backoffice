'use client';

import { useEffect, useState, useMemo } from 'react';
import { Brain, Clock, Play, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface KitchenTiming {
  order_id: string;
  ready_target: string | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

interface KiEmpfehlung {
  order_id: string;
  bestellnummer: string;
  empfehlung: 'jetzt' | 'warten' | 'dringend';
  grund: string;
  kochstart_in_min: number;
  fahrer_eta_min: number | null;
}

function scoreColor(e: KiEmpfehlung['empfehlung']) {
  switch (e) {
    case 'dringend': return { bg: 'bg-red-500', text: 'text-white', badge: 'bg-red-100 text-red-700', border: 'border-red-200 bg-red-50' };
    case 'jetzt':    return { bg: 'bg-matcha-500', text: 'text-white', badge: 'bg-matcha-100 text-matcha-700', border: 'border-matcha-200 bg-matcha-50' };
    case 'warten':   return { bg: 'bg-amber-400', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200 bg-amber-50' };
  }
}

function buildEmpfehlungen(orders: Order[], timings: KitchenTiming[]): KiEmpfehlung[] {
  const now = Date.now();
  return orders
    .filter((o) => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map((o) => {
      const t = timings.find((t) => t.order_id === o.id);
      const prepMin = o.geschaetzte_zubereitung_min ?? 15;
      const orderAgeMin = o.bestellt_am
        ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000)
        : 0;

      let empfehlung: KiEmpfehlung['empfehlung'];
      let grund: string;
      let kochstart_in_min: number;

      if (t?.ready_target) {
        const readyMs = new Date(t.ready_target).getTime();
        const minUntilReady = Math.floor((readyMs - now) / 60_000);
        if (minUntilReady < 0) {
          empfehlung = 'dringend';
          grund = `${Math.abs(minUntilReady)} Min überfällig`;
          kochstart_in_min = 0;
        } else if (minUntilReady < 5) {
          empfehlung = 'jetzt';
          grund = `Fahrer in ~${minUntilReady} Min erwartet`;
          kochstart_in_min = 0;
        } else {
          empfehlung = 'warten';
          grund = `Noch ${minUntilReady} Min bis Fahrer-ETA`;
          kochstart_in_min = Math.max(0, minUntilReady - prepMin);
        }
        return { order_id: o.id, bestellnummer: o.bestellnummer, empfehlung, grund, kochstart_in_min, fahrer_eta_min: minUntilReady };
      }

      // Keine Timing-Info: heuristisch
      if (orderAgeMin > prepMin) {
        empfehlung = 'dringend';
        grund = `Bestellung ${orderAgeMin} Min alt, Prep ${prepMin} Min`;
        kochstart_in_min = 0;
      } else if (orderAgeMin > prepMin * 0.6) {
        empfehlung = 'jetzt';
        grund = 'Idealer Kochstart für pünktliche Lieferung';
        kochstart_in_min = 0;
      } else {
        empfehlung = 'warten';
        grund = `Noch ${prepMin - orderAgeMin} Min Puffer`;
        kochstart_in_min = prepMin - orderAgeMin;
      }
      return { order_id: o.id, bestellnummer: o.bestellnummer, empfehlung, grund, kochstart_in_min, fahrer_eta_min: null };
    })
    .sort((a, b) => {
      const order = ['dringend', 'jetzt', 'warten'] as const;
      return order.indexOf(a.empfehlung) - order.indexOf(b.empfehlung);
    })
    .slice(0, 6);
}

export function KitchenPhase831KochstartKiEmpfehlung({ orders, timings }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const empfehlungen = useMemo(() => buildEmpfehlungen(orders, timings), [orders, timings, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (empfehlungen.length === 0) return null;

  const dringend = empfehlungen.filter((e) => e.empfehlung === 'dringend').length;
  const jetzt = empfehlungen.filter((e) => e.empfehlung === 'jetzt').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        dringend > 0 ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'
      )}>
        <Brain className={cn('h-4 w-4', dringend > 0 ? 'text-red-600 animate-pulse' : 'text-stone-600')} />
        <span className="text-sm font-bold text-stone-800">KI-Kochstart-Empfehlung</span>
        <div className="ml-auto flex items-center gap-1.5">
          {dringend > 0 && (
            <span className="text-[10px] bg-red-600 text-white rounded-full px-2 py-0.5 font-bold animate-pulse">
              {dringend}× dringend
            </span>
          )}
          {jetzt > 0 && (
            <span className="text-[10px] bg-matcha-600 text-white rounded-full px-2 py-0.5 font-bold">
              {jetzt}× jetzt starten
            </span>
          )}
        </div>
      </div>

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {empfehlungen.map((e) => {
          const c = scoreColor(e.empfehlung);
          const Icon = e.empfehlung === 'dringend' ? AlertTriangle : e.empfehlung === 'jetzt' ? Play : Clock;
          return (
            <div key={e.order_id} className={cn('rounded-xl border px-3 py-2.5 flex items-start gap-3', c.border)}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', c.bg)}>
                <Icon className={cn('h-4 w-4', c.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-black text-stone-800">#{e.bestellnummer}</span>
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', c.badge)}>
                    {e.empfehlung === 'dringend' ? 'DRINGEND' : e.empfehlung === 'jetzt' ? 'JETZT STARTEN' : `In ${e.kochstart_in_min} Min`}
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">{e.grund}</p>
                {e.fahrer_eta_min !== null && (
                  <div className="mt-1 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5 text-stone-400" />
                    <span className="text-[9px] text-stone-400">Fahrer-ETA: {e.fahrer_eta_min} Min</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <span className="text-[9px] text-stone-400">KI-Analyse · alle 30s aktualisiert</span>
      </div>
    </div>
  );
}
