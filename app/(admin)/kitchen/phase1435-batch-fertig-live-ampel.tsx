'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Clock, Flame, AlertTriangle, Package } from 'lucide-react';

interface Batch {
  id: string;
  status: string;
  created_at?: string | null;
  zone?: string | null;
  driver_id?: string | null;
}

interface Order {
  id: string;
  batch_id?: string | null;
  status: string;
  geschaetzte_zubereitung_min?: number | null;
  zubereitung_start?: string | null;
  bestellt_am?: string | null;
}

type Phase = 'warten' | 'kochen' | 'bereit' | 'unterwegs' | 'done';

const PHASE_COLOR: Record<Phase, string> = {
  warten:    'bg-stone-200 text-stone-600',
  kochen:    'bg-amber-400 text-amber-950',
  bereit:    'bg-matcha-500 text-white',
  unterwegs: 'bg-blue-500 text-white',
  done:      'bg-stone-100 text-stone-400',
};

const PHASE_LABEL: Record<Phase, string> = {
  warten:    'Wartet',
  kochen:    'Wird gekocht',
  bereit:    'Bereit',
  unterwegs: 'Unterwegs',
  done:      'Fertig',
};

function orderPhase(o: Order): Phase {
  if (o.status === 'geliefert' || o.status === 'abgeschlossen') return 'done';
  if (o.status === 'fertig') return 'bereit';
  if (o.status === 'unterwegs') return 'unterwegs';
  if (o.status === 'in_zubereitung' || o.zubereitung_start) return 'kochen';
  return 'warten';
}

function remainSec(o: Order, now: number): number | null {
  const prepMin = o.geschaetzte_zubereitung_min;
  const startMs = o.zubereitung_start
    ? new Date(o.zubereitung_start).getTime()
    : o.bestellt_am
    ? new Date(o.bestellt_am).getTime()
    : null;
  if (!prepMin || !startMs) return null;
  return Math.round((startMs + prepMin * 60_000 - now) / 1000);
}

function fmtSec(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const fmt = m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
  return s < 0 ? `+${fmt}` : fmt;
}

const MOCK_BATCHES: Batch[] = [
  { id: 'b1', status: 'aktiv', zone: 'Nord', created_at: new Date(Date.now() - 8 * 60_000).toISOString() },
  { id: 'b2', status: 'aktiv', zone: 'Mitte', created_at: new Date(Date.now() - 3 * 60_000).toISOString() },
  { id: 'b3', status: 'fertig', zone: 'Süd', created_at: new Date(Date.now() - 15 * 60_000).toISOString() },
];
const MOCK_ORDERS: Order[] = [
  { id: 'o1', batch_id: 'b1', status: 'in_zubereitung', geschaetzte_zubereitung_min: 12, zubereitung_start: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 'o2', batch_id: 'b1', status: 'in_zubereitung', geschaetzte_zubereitung_min: 15, zubereitung_start: new Date(Date.now() - 3 * 60_000).toISOString() },
  { id: 'o3', batch_id: 'b2', status: 'pending', geschaetzte_zubereitung_min: 10, bestellt_am: new Date(Date.now() - 1 * 60_000).toISOString() },
  { id: 'o4', batch_id: 'b3', status: 'fertig', geschaetzte_zubereitung_min: 8, zubereitung_start: new Date(Date.now() - 20 * 60_000).toISOString() },
];

export function KitchenBatchFertigLiveAmpel() {
  const [batches, setBatches] = useState<Batch[]>(MOCK_BATCHES);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const sb = createClient();
    sb.from('delivery_batches')
      .select('id,status,created_at,zone,driver_id')
      .in('status', ['aktiv', 'fertig', 'offen'])
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }: { data: Batch[] | null }) => { if (data?.length) setBatches(data); });
    sb.from('orders')
      .select('id,batch_id,status,geschaetzte_zubereitung_min,zubereitung_start,bestellt_am')
      .not('batch_id', 'is', null)
      .in('status', ['pending', 'in_zubereitung', 'fertig', 'unterwegs'])
      .then(({ data }: { data: Order[] | null }) => { if (data?.length) setOrders(data); });
  }, []);

  const activeBatches = batches.filter(b => b.status !== 'abgeschlossen').slice(0, 5);

  if (!activeBatches.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Package className="w-4 h-4 text-matcha-600" />
        <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Batch-Fertigstellungs-Ampel</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {activeBatches.map(batch => {
          const batchOrders = orders.filter(o => o.batch_id === batch.id);
          const phases = batchOrders.map(o => orderPhase(o));
          const allReady = phases.every(p => p === 'bereit' || p === 'done' || p === 'unterwegs');
          const anyCritical = batchOrders.some(o => {
            const rem = remainSec(o, now);
            return rem !== null && rem < 0;
          });
          const batchPhase: Phase = batch.status === 'fertig' ? 'done'
            : allReady ? 'bereit'
            : phases.some(p => p === 'kochen') ? 'kochen'
            : 'warten';

          return (
            <div
              key={batch.id}
              className={cn(
                'rounded-xl border p-3 transition-all',
                anyCritical ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-700">
                  {batch.zone ?? 'Zone ?'} · {batchOrders.length} Bestellung{batchOrders.length !== 1 ? 'en' : ''}
                </span>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', PHASE_COLOR[batchPhase])}>
                  {PHASE_LABEL[batchPhase]}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {batchOrders.map(o => {
                  const ph = orderPhase(o);
                  const rem = ph === 'kochen' ? remainSec(o, now) : null;
                  const isOverdue = rem !== null && rem < 0;
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium',
                        isOverdue ? 'bg-red-500 text-white' : PHASE_COLOR[ph],
                      )}
                    >
                      {ph === 'kochen' && (isOverdue
                        ? <AlertTriangle className="w-3 h-3" />
                        : <Flame className="w-3 h-3" />)}
                      {ph === 'bereit' && <CheckCircle2 className="w-3 h-3" />}
                      {ph === 'warten' && <Clock className="w-3 h-3" />}
                      {rem !== null ? fmtSec(rem) : PHASE_LABEL[ph]}
                    </div>
                  );
                })}
                {batchOrders.length === 0 && (
                  <span className="text-xs text-stone-400 italic">Keine Bestellungen</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
