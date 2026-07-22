'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Flame, Play, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Phase 3200 — Smart-Kochstart-Kommando
// Zeigt je aktive Bestellung: Countdown bis Fahrer eintrifft, optimalen Kochstart-Zeitpunkt
// und Farbkodierung grün/gelb/rot/kritisch. 1-Sek-Tick, 20-Sek-Polling.

type OrderRow = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type TimingRow = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type BatchStop = {
  order_id: string;
  batch: { fahrer_id: string | null; startzeit: string | null; total_eta_min: number | null };
};

type CommandEntry = {
  orderId: string;
  bestellnummer: string;
  kunde: string;
  prepMin: number;
  cookStartAt: Date | null;
  readyTarget: Date | null;
  driverEtaSec: number | null;
  cookStartInSec: number | null;
  urgency: 'green' | 'yellow' | 'red' | 'critical';
  cookingNow: boolean;
};

function secToLabel(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function calcUrgency(cookStartInSec: number | null, driverEtaSec: number | null): CommandEntry['urgency'] {
  if (cookStartInSec === null) return 'green';
  if (cookStartInSec <= 0) return 'critical';
  if (cookStartInSec < 60) return 'red';
  if (cookStartInSec < 180) return 'yellow';
  return 'green';
}

const URGENCY_STYLE: Record<CommandEntry['urgency'], string> = {
  green:    'border-green-400 bg-green-50',
  yellow:   'border-yellow-400 bg-yellow-50',
  red:      'border-red-400 bg-red-50',
  critical: 'border-red-600 bg-red-100 animate-pulse',
};

const URGENCY_BADGE: Record<CommandEntry['urgency'], string> = {
  green:    'bg-green-100 text-green-800',
  yellow:   'bg-yellow-100 text-yellow-800',
  red:      'bg-red-100 text-red-800',
  critical: 'bg-red-600 text-white',
};

const URGENCY_LABEL: Record<CommandEntry['urgency'], string> = {
  green:    'Bereit',
  yellow:   'Bald starten',
  red:      'Jetzt starten!',
  critical: 'ÜBERFÄLLIG',
};

export function KitchenPhase3200SmartKochstartKommando() {
  const supabase = createClient();
  const [entries, setEntries] = useState<CommandEntry[]>([]);
  const [tick, setTick] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState<number | null>(null);
  const dataRef = useRef<CommandEntry[]>([]);

  async function loadData() {
    const now = new Date();

    const { data: orders } = await supabase
      .from('orders')
      .select('id,bestellnummer,kunde_name,status,bestellt_am,geschaetzte_zubereitung_min')
      .in('status', ['neu', 'bestaetigt', 'in_zubereitung'])
      .order('bestellt_am', { ascending: true })
      .limit(20);

    if (!orders?.length) { setEntries([]); return; }

    const orderIds = orders.map((o: OrderRow) => o.id);

    const { data: timings } = await supabase
      .from('kitchen_timings')
      .select('order_id,cook_start_at,ready_target,prep_min,status')
      .in('order_id', orderIds);

    const { data: stops } = await supabase
      .from('batch_stops')
      .select('order_id,batch:batches(fahrer_id,startzeit,total_eta_min)')
      .in('order_id', orderIds);

    const timingMap = new Map<string, TimingRow>((timings ?? []).map((t: TimingRow) => [t.order_id, t]));
    const stopMap = new Map<string, BatchStop>((stops ?? []).map((s: BatchStop) => [s.order_id, s]));

    const built: CommandEntry[] = orders.map((o: OrderRow) => {
      const t = timingMap.get(o.id);
      const s = stopMap.get(o.id);
      const prepMin = t?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;

      const cookStartAt = t?.cook_start_at ? new Date(t.cook_start_at) : null;
      const readyTarget = t?.ready_target ? new Date(t.ready_target) : null;

      // Driver ETA: if batch started, estimate arrival as startzeit + total_eta_min/2 (heading to restaurant)
      let driverEtaSec: number | null = null;
      const batch = (s?.batch as { startzeit?: string | null; total_eta_min?: number | null } | null);
      if (batch?.startzeit && batch?.total_eta_min) {
        const batchStart = new Date(batch.startzeit);
        const halfEta = (batch.total_eta_min * 60) / 2;
        const driverArrival = new Date(batchStart.getTime() + halfEta * 1000);
        driverEtaSec = Math.max(0, Math.round((driverArrival.getTime() - now.getTime()) / 1000));
      }

      // When should we start cooking to be ready when driver arrives?
      const cookStartInSec = driverEtaSec !== null
        ? Math.round(driverEtaSec - prepMin * 60)
        : (readyTarget
            ? Math.round((readyTarget.getTime() - prepMin * 60_000 - now.getTime()) / 1000)
            : null);

      const cookingNow = t?.status === 'cooking' || o.status === 'in_zubereitung';
      const urgency = cookingNow ? 'green' : calcUrgency(cookStartInSec, driverEtaSec);

      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        kunde: o.kunde_name,
        prepMin,
        cookStartAt,
        readyTarget,
        driverEtaSec,
        cookStartInSec,
        urgency,
        cookingNow,
      };
    });

    // Sort: critical → red → yellow → green
    const urgencyOrder = { critical: 0, red: 1, yellow: 2, green: 3 };
    built.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    dataRef.current = built;
    setEntries([...built]);

    // On-time rate: fraction where urgency is green or cooking
    const onTime = built.filter(e => e.urgency === 'green' || e.cookingNow).length;
    setOnTimeRate(built.length > 0 ? Math.round((onTime / built.length) * 100) : null);
  }

  // 1-second countdown tick
  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Update urgency/countdowns each tick without re-fetching
  useEffect(() => {
    const now = new Date();
    const updated = dataRef.current.map(e => {
      if (e.cookingNow) return e;
      const elapsed = 1; // 1 second passed since last render
      const newDriverEta = e.driverEtaSec !== null ? Math.max(0, e.driverEtaSec - elapsed) : null;
      const newCookStart = e.cookStartInSec !== null ? e.cookStartInSec - elapsed : null;
      const urgency = calcUrgency(newCookStart, newDriverEta);
      return { ...e, driverEtaSec: newDriverEta, cookStartInSec: newCookStart, urgency };
    });
    dataRef.current = updated;
    setEntries([...updated]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // 20-second polling
  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!entries.length) return null;

  const critical = entries.filter(e => e.urgency === 'critical').length;
  const red = entries.filter(e => e.urgency === 'red').length;

  return (
    <div className="rounded-xl border border-orange-200 bg-white p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-gray-800">Kochstart-Kommando</span>
          {(critical > 0 || red > 0) && (
            <span className="text-xs font-bold bg-red-600 text-white rounded px-1.5 py-0.5 animate-pulse">
              {critical + red} DRINGEND
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onTimeRate !== null && (
            <span className={cn(
              'text-xs font-bold rounded px-1.5 py-0.5',
              onTimeRate >= 80 ? 'bg-green-100 text-green-800' :
              onTimeRate >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800',
            )}>
              {onTimeRate}% on time
            </span>
          )}
          <span className="text-xs text-gray-400">{entries.length} aktiv</span>
        </div>
      </div>

      {/* Order cards */}
      <div className="flex flex-col gap-2">
        {entries.map(e => (
          <div
            key={e.orderId}
            className={cn(
              'rounded-lg border-2 p-2.5 flex items-center gap-3 transition-all',
              URGENCY_STYLE[e.urgency],
            )}
          >
            {/* Icon */}
            <div className="shrink-0">
              {e.cookingNow
                ? <ChefHat className="w-5 h-5 text-green-600" />
                : e.urgency === 'critical'
                  ? <AlertTriangle className="w-5 h-5 text-red-600" />
                  : e.urgency === 'red'
                    ? <Play className="w-5 h-5 text-red-500" />
                    : e.urgency === 'yellow'
                      ? <Clock className="w-5 h-5 text-yellow-600" />
                      : <CheckCircle2 className="w-5 h-5 text-green-500" />}
            </div>

            {/* Order info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-700">#{e.bestellnummer}</span>
                <span className={cn('text-xs font-bold rounded px-1 py-0.5', URGENCY_BADGE[e.urgency])}>
                  {URGENCY_LABEL[e.urgency]}
                </span>
              </div>
              <div className="text-xs text-gray-500 truncate">{e.kunde}</div>
            </div>

            {/* Countdowns */}
            <div className="shrink-0 text-right">
              {e.cookingNow ? (
                <div className="text-xs font-bold text-green-700 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Kocht
                </div>
              ) : (
                <>
                  {e.cookStartInSec !== null && (
                    <div className={cn(
                      'text-sm font-bold tabular-nums',
                      e.urgency === 'critical' ? 'text-red-600' :
                      e.urgency === 'red' ? 'text-red-500' :
                      e.urgency === 'yellow' ? 'text-yellow-700' : 'text-green-700',
                    )}>
                      {e.cookStartInSec <= 0 ? 'JETZT!' : `in ${secToLabel(e.cookStartInSec)}`}
                    </div>
                  )}
                  {e.driverEtaSec !== null && (
                    <div className="text-xs text-blue-600 font-medium">
                      🚴 {secToLabel(e.driverEtaSec)}
                    </div>
                  )}
                </>
              )}
              <div className="text-xs text-gray-400">{e.prepMin} min</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
