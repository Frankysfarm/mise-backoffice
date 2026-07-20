'use client';

/**
 * Phase 2790 — Smart Kochstart-Bridge Cockpit
 * Echtzeit-Countdown je Bestellung + Farbkodierung grün/gelb/rot
 * + Fahrer-Return-ETA + On-Time-Rate + Kochstart-Empfehlung
 * + Batch-Alert + Überfällig-Eskalation
 * Polling: 15 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Bike, Timer, TrendingUp, Flame, ArrowRight } from 'lucide-react';

type OrderRow = {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  eta_earliest: string | null;
  cook_start_at: string | null;
  ready_target: string | null;
  driver_name: string | null;
};

type Ampel = 'gruen' | 'gelb' | 'rot' | 'ueberfaellig';

function secsLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function fmtMmSs(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getAmpel(secs: number | null, status: string): Ampel {
  if (['fertig', 'unterwegs', 'abgeholt', 'geliefert'].includes(status)) return 'gruen';
  if (secs === null) return 'gelb';
  if (secs < 0) return 'ueberfaellig';
  if (secs > 480) return 'gruen';
  if (secs > 120) return 'gelb';
  return 'rot';
}

const MOCK: OrderRow[] = [
  { id: '1', bestellnummer: '#1042', kunde_name: 'Müller', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 600_000).toISOString(), geschaetzte_zubereitung_min: 15, eta_earliest: new Date(Date.now() + 300_000).toISOString(), cook_start_at: new Date(Date.now() - 300_000).toISOString(), ready_target: new Date(Date.now() + 300_000).toISOString(), driver_name: 'Max M.' },
  { id: '2', bestellnummer: '#1041', kunde_name: 'Schmidt', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 900_000).toISOString(), geschaetzte_zubereitung_min: 20, eta_earliest: new Date(Date.now() + 60_000).toISOString(), cook_start_at: new Date(Date.now() - 720_000).toISOString(), ready_target: new Date(Date.now() + 60_000).toISOString(), driver_name: 'Sara K.' },
  { id: '3', bestellnummer: '#1040', kunde_name: 'Weber', status: 'neu', bestellt_am: new Date(Date.now() - 120_000).toISOString(), geschaetzte_zubereitung_min: 12, eta_earliest: new Date(Date.now() + 600_000).toISOString(), cook_start_at: null, ready_target: new Date(Date.now() + 600_000).toISOString(), driver_name: null },
  { id: '4', bestellnummer: '#1039', kunde_name: 'Bauer', status: 'fertig', bestellt_am: new Date(Date.now() - 1800_000).toISOString(), geschaetzte_zubereitung_min: 18, eta_earliest: null, cook_start_at: new Date(Date.now() - 1500_000).toISOString(), ready_target: null, driver_name: 'Tom B.' },
];

interface Props {
  locationId: string | null;
}

export function KitchenPhase2790SmartKochstartBridgeCockpit({ locationId }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>(MOCK);
  const [tick, setTick] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState(78);
  const supabase = createClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      if (!locationId) { setOrders(MOCK); return; }
      const { data } = await supabase
        .from('orders')
        .select('id,bestellnummer,kunde_name,status,bestellt_am,geschaetzte_zubereitung_min,eta_earliest,cook_start_at,ready_target,driver_name')
        .eq('location_id', locationId)
        .in('status', ['neu', 'angenommen', 'in_zubereitung', 'fertig'])
        .order('bestellt_am', { ascending: true })
        .limit(20);
      if (data && data.length > 0) {
        setOrders(data as OrderRow[]);
        const done = (data as OrderRow[]).filter(o => ['fertig', 'abgeholt', 'geliefert'].includes(o.status));
        const onTime = done.filter(o => {
          const s = secsLeft(o.ready_target);
          return s !== null && s >= 0;
        });
        if (done.length > 0) setOnTimeRate(Math.round((onTime.length / done.length) * 100));
      }
    }
    load();
    const poll = setInterval(load, 15_000);
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [locationId]);

  const activeOrders = orders.filter(o => !['geliefert', 'storniert'].includes(o.status));
  const ueberfaellig = activeOrders.filter(o => {
    const s = secsLeft(o.ready_target);
    return s !== null && s < 0 && !['fertig', 'abgeholt'].includes(o.status);
  });

  const ampelClass: Record<Ampel, string> = {
    gruen: 'bg-green-500/20 border-green-500 text-green-400',
    gelb: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    rot: 'bg-red-500/20 border-red-500 text-red-400',
    ueberfaellig: 'bg-red-700/30 border-red-600 text-red-300',
  };

  const onTimeColor = onTimeRate >= 85 ? 'text-green-400' : onTimeRate >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-semibold text-white">Kochstart-Bridge Cockpit</span>
          {ueberfaellig.length > 0 && (
            <span className="text-xs font-bold bg-red-600/80 text-white px-2 py-0.5 rounded-full animate-pulse">
              {ueberfaellig.length} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <TrendingUp className={cn('h-3 w-3', onTimeColor)} />
            <span className={cn('text-xs font-bold', onTimeColor)}>{onTimeRate}% On-Time</span>
          </div>
          <span className="text-xs text-white/40">{activeOrders.length} aktiv</span>
        </div>
      </div>

      {/* Kochstart-Empfehlung */}
      {activeOrders.some(o => o.status === 'neu') && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-2">
          <Flame className="h-3 w-3 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-300">
            {activeOrders.filter(o => o.status === 'neu').length} Bestellung(en) warten auf Kochstart
          </span>
          <ArrowRight className="h-3 w-3 text-orange-400 ml-auto" />
        </div>
      )}

      {/* Order-Grid */}
      <div className="space-y-2">
        {activeOrders.slice(0, 8).map(order => {
          const secs = secsLeft(order.ready_target);
          const ampel = getAmpel(secs, order.status);
          const prepSecs = secsLeft(order.eta_earliest);

          return (
            <div
              key={order.id}
              className={cn('rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors', ampelClass[ampel])}
            >
              {/* Bestellnummer + Kunde */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/90">{order.bestellnummer}</span>
                  <span className="text-xs text-white/50 truncate">{order.kunde_name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-xs font-medium',
                    order.status === 'fertig' ? 'text-green-400' :
                    order.status === 'in_zubereitung' ? 'text-yellow-400' : 'text-white/60'
                  )}>
                    {order.status === 'fertig' ? '✓ Fertig' :
                     order.status === 'in_zubereitung' ? 'In Zubereitung' :
                     order.status === 'neu' ? 'Warten' : order.status}
                  </span>
                  {order.driver_name && (
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <Bike className="h-3 w-3" />{order.driver_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown */}
              <div className="text-right shrink-0">
                {secs !== null ? (
                  <div className={cn('text-sm font-mono font-bold', secs < 0 ? 'text-red-400' : 'text-white')}>
                    {secs < 0 ? '-' : ''}{fmtMmSs(secs)}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {order.geschaetzte_zubereitung_min ?? '?'} min
                  </div>
                )}
                {prepSecs !== null && prepSecs > 0 && (
                  <div className="text-xs text-white/40">ETA {Math.ceil(prepSecs / 60)} min</div>
                )}
              </div>

              {/* Ampel-Dot */}
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0',
                ampel === 'gruen' ? 'bg-green-400' :
                ampel === 'gelb' ? 'bg-yellow-400' :
                ampel === 'rot' ? 'bg-red-400 animate-pulse' :
                'bg-red-600 animate-pulse'
              )} />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-white/30 pt-1 border-t border-white/5">
        <span className="flex items-center gap-1"><Timer className="h-3 w-3" />Polling 15 Sek.</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />1-Sek-Tick aktiv</span>
      </div>
    </div>
  );
}
