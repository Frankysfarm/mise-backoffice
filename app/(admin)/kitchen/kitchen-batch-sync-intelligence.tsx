'use client';

/**
 * KitchenBatchSyncIntelligence
 * Smart-Timing: Synchronisiert Küchen-Output mit Fahrer-Ankunft.
 * Zeigt optimalen Koch-Start-Zeitpunkt + Farbkodierung (grün/gelb/rot).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChefHat, Bike, Clock, Flame, CheckCircle2, AlertTriangle, Zap, Timer, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  items_count: number;
  prep_min: number;
  status: 'waiting' | 'cooking' | 'ready' | 'picked_up';
  order_time: string;
  driver_eta_min: number | null;
  cook_start_at: string | null;
  cook_recommendation: 'start_now' | 'wait' | 'urgent' | 'done';
  wait_sec: number;
}

interface BatchGroup {
  batch_id: string;
  driver_name: string;
  vehicle: 'bike' | 'car' | 'foot';
  driver_eta_min: number;
  orders: BatchOrder[];
  sync_score: number;
}

const MOCK_BATCHES: BatchGroup[] = [
  {
    batch_id: 'b1',
    driver_name: 'Ahmed K.',
    vehicle: 'bike',
    driver_eta_min: 4,
    sync_score: 92,
    orders: [
      { id: 'o1', bestellnummer: '#1042', kunde_name: 'Müller, T.', items_count: 3, prep_min: 12, status: 'cooking', order_time: new Date(Date.now() - 9 * 60_000).toISOString(), driver_eta_min: 4, cook_start_at: new Date(Date.now() - 7 * 60_000).toISOString(), cook_recommendation: 'start_now', wait_sec: 180 },
      { id: 'o2', bestellnummer: '#1043', kunde_name: 'Schmidt, A.', items_count: 2, prep_min: 8, status: 'cooking', order_time: new Date(Date.now() - 6 * 60_000).toISOString(), driver_eta_min: 4, cook_start_at: new Date(Date.now() - 5 * 60_000).toISOString(), cook_recommendation: 'wait', wait_sec: 60 },
    ],
  },
  {
    batch_id: 'b2',
    driver_name: 'Lukas M.',
    vehicle: 'car',
    driver_eta_min: 11,
    sync_score: 74,
    orders: [
      { id: 'o3', bestellnummer: '#1044', kunde_name: 'Weber, K.', items_count: 4, prep_min: 18, status: 'waiting', order_time: new Date(Date.now() - 3 * 60_000).toISOString(), driver_eta_min: 11, cook_start_at: null, cook_recommendation: 'wait', wait_sec: 420 },
      { id: 'o4', bestellnummer: '#1045', kunde_name: 'Fischer, M.', items_count: 1, prep_min: 10, status: 'waiting', order_time: new Date(Date.now() - 2 * 60_000).toISOString(), driver_eta_min: 11, cook_start_at: null, cook_recommendation: 'urgent', wait_sec: 600 },
    ],
  },
  {
    batch_id: 'b3',
    driver_name: 'Sara P.',
    vehicle: 'bike',
    driver_eta_min: 2,
    sync_score: 58,
    orders: [
      { id: 'o5', bestellnummer: '#1046', kunde_name: 'Becker, L.', items_count: 2, prep_min: 14, status: 'cooking', order_time: new Date(Date.now() - 15 * 60_000).toISOString(), driver_eta_min: 2, cook_start_at: new Date(Date.now() - 12 * 60_000).toISOString(), cook_recommendation: 'urgent', wait_sec: 0 },
    ],
  },
];

function useCountdown() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function cookElapsedSec(startAt: string | null): number {
  if (!startAt) return 0;
  return Math.floor((Date.now() - new Date(startAt).getTime()) / 1000);
}

function syncColor(score: number) {
  if (score >= 85) return { ring: 'border-matcha-400', badge: 'bg-matcha-100 text-matcha-700', dot: 'bg-matcha-500', label: 'Perfekt' };
  if (score >= 65) return { ring: 'border-amber-300', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', label: 'OK' };
  return { ring: 'border-red-300', badge: 'bg-red-100 text-red-700', dot: 'bg-red-400', label: 'Verzögert' };
}

function recColor(rec: BatchOrder['cook_recommendation']) {
  switch (rec) {
    case 'start_now': return 'bg-matcha-100 text-matcha-800 border-matcha-300';
    case 'wait':      return 'bg-stone-100 text-stone-600 border-stone-200';
    case 'urgent':    return 'bg-red-100 text-red-700 border-red-300';
    case 'done':      return 'bg-blue-100 text-blue-700 border-blue-300';
  }
}

function recLabel(rec: BatchOrder['cook_recommendation']) {
  switch (rec) {
    case 'start_now': return 'Jetzt starten';
    case 'wait':      return 'Warten';
    case 'urgent':    return '⚡ Sofort!';
    case 'done':      return '✓ Fertig';
  }
}

function VehicleIcon({ v }: { v: 'bike' | 'car' | 'foot' }) {
  if (v === 'bike') return <Bike className="w-3.5 h-3.5" />;
  if (v === 'car') return <span className="text-[11px]">🚗</span>;
  return <span className="text-[11px]">🚶</span>;
}

export function KitchenBatchSyncIntelligence({ locationId }: { locationId?: string | null }) {
  useCountdown();
  const [batches] = useState<BatchGroup[]>(MOCK_BATCHES);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['b1']));

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const urgentCount = batches.reduce((acc, b) => acc + b.orders.filter(o => o.cook_recommendation === 'urgent').length, 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-matcha-600 flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-black text-stone-900 uppercase tracking-wide">Batch-Sync Intelligence</div>
            <div className="text-[10px] text-stone-400">Smart-Timing · Küche ↔ Fahrer</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              <Zap className="w-3 h-3" /> {urgentCount} sofort
            </span>
          )}
          <span className="text-[10px] text-stone-400">{batches.length} Batches</span>
        </div>
      </div>

      {/* Batch List */}
      <div className="divide-y divide-stone-100">
        {batches.map(batch => {
          const sc = syncColor(batch.sync_score);
          const isOpen = expanded.has(batch.batch_id);
          const urgentInBatch = batch.orders.filter(o => o.cook_recommendation === 'urgent').length;

          return (
            <div key={batch.batch_id} className={cn('border-l-4 transition-colors', sc.ring)}>
              {/* Batch Header */}
              <button
                onClick={() => toggle(batch.batch_id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', sc.dot)} />
                <div className="flex items-center gap-1.5 text-stone-500">
                  <VehicleIcon v={batch.vehicle} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 truncate">{batch.driver_name}</span>
                    {urgentInBatch > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                        {urgentInBatch}x dringend
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-stone-500">
                      <Bike className="w-3 h-3" /> {batch.driver_eta_min} Min Ankunft
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', sc.badge)}>
                      Sync {batch.sync_score}%
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-stone-400">{batch.orders.length} Bestellung{batch.orders.length !== 1 ? 'en' : ''}</span>
                <span className="text-stone-300 text-xs ml-1">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Orders */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-2">
                  {batch.orders.map(order => {
                    const elapsed = cookElapsedSec(order.cook_start_at);
                    const totalSec = order.prep_min * 60;
                    const pct = order.cook_start_at ? Math.min(100, Math.round((elapsed / totalSec) * 100)) : 0;
                    const remainSec = order.cook_start_at ? Math.max(0, totalSec - elapsed) : null;

                    return (
                      <div key={order.id} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-stone-800">{order.bestellnummer}</span>
                              <span className="text-[10px] text-stone-500 truncate">{order.kunde_name}</span>
                              <span className="text-[9px] text-stone-400">{order.items_count} Artikel</span>
                            </div>

                            {/* Progress Bar */}
                            {order.cook_start_at && (
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[9px] text-stone-400 font-mono">
                                    {pct}% · {remainSec !== null ? `${Math.floor(remainSec / 60)}:${String(remainSec % 60).padStart(2, '0')} verbleibend` : '—'}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-1000',
                                      pct >= 90 ? 'bg-matcha-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-400',
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Recommendation Badge */}
                          <span className={cn('shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wide', recColor(order.cook_recommendation))}>
                            {recLabel(order.cook_recommendation)}
                          </span>
                        </div>

                        {/* Status Row */}
                        <div className="flex items-center gap-3 mt-2">
                          {order.status === 'ready' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-matcha-700">
                              <CheckCircle2 className="w-3 h-3" /> Fertig — wartet auf Fahrer
                            </span>
                          )}
                          {order.status === 'cooking' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-blue-700">
                              <Flame className="w-3 h-3" /> In Zubereitung
                            </span>
                          )}
                          {order.status === 'waiting' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700">
                              <Timer className="w-3 h-3" /> Wartet auf Kochstart
                            </span>
                          )}
                          {order.driver_eta_min !== null && (
                            <span className="text-[9px] text-stone-400 ml-auto">
                              Fahrer in {order.driver_eta_min} Min
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-stone-100 bg-stone-50">
        <div className="flex items-center gap-1 text-[10px] text-stone-400">
          <TrendingUp className="w-3 h-3" />
          Ø Sync-Score: {Math.round(batches.reduce((a, b) => a + b.sync_score, 0) / batches.length)}%
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-matcha-600"><span className="w-2 h-2 rounded-full bg-matcha-500 inline-block" /> Pünktlich</span>
          <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Knapp</span>
          <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Verspätet</span>
        </div>
      </div>
    </div>
  );
}
