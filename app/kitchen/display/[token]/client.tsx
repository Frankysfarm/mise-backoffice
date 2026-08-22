'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, BellOff, Check, ChefHat, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Station = {
  id: string;
  name: string;
  icon: string | null;
  farbe: string | null;
  sound_enabled: boolean;
};

type Item = {
  id: string;
  order_id: string;
  name: string;
  menge: number;
  notiz: string | null;
  station_status: string;
  extras: unknown;
  order: {
    id: string;
    bestellnummer: string;
    status: string;
    typ: string;
    bestellt_am: string | null;
    kunde_name: string;
    tisch_id: string | null;
    gedeckt_personen: number | null;
  };
};

type TableInfo = { nummer: string; name: string | null; bereich: string | null };

export function StationDisplay({
  station, initialItems, initialTableMap,
}: {
  station: Station;
  initialItems: Item[];
  initialTableMap: Record<string, TableInfo>;
}) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [tableMap] = useState(initialTableMap);
  const [audio, setAudio] = useState(station.sound_enabled);
  const prevCount = useRef(initialItems.length);
  const [tick, setTick] = useState(0);

  // Ticker für Wartezeit-Anzeige
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`station-${station.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'order_items',
        filter: `station_id=eq.${station.id}`,
      }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const { data } = await supabase.from('order_items')
      .select(`id, order_id, name, menge, notiz, station_status, extras,
        order:customer_orders!inner(id, bestellnummer, status, typ, bestellt_am, kunde_name, tisch_id, gedeckt_personen)`)
      .eq('station_id', station.id).in('station_status', ['offen', 'in_arbeit']);
    setItems((data as any[]) ?? []);
  }

  // Audio-Ping bei neuem Item
  useEffect(() => {
    if (!audio) return;
    if (items.length > prevCount.current) ding();
    prevCount.current = items.length;
  }, [items.length, audio]);

  async function advance(itemId: string, to: 'in_arbeit' | 'fertig') {
    await supabase.from('order_items').update({ station_status: to }).eq('id', itemId);
    if (to === 'fertig') setItems((arr) => arr.filter((i) => i.id !== itemId));
  }

  // Gruppiert nach Order
  const byOrder = new Map<string, Item[]>();
  for (const it of items) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push(it);
    byOrder.set(it.order_id, arr);
  }
  const orderBlocks = Array.from(byOrder.entries()).map(([orderId, its]) => ({
    orderId,
    order: its[0].order,
    items: its,
  })).sort((a, b) => {
    const at = a.order.bestellt_am ? new Date(a.order.bestellt_am).getTime() : 0;
    const bt = b.order.bestellt_am ? new Date(b.order.bestellt_am).getTime() : 0;
    return at - bt;
  });

  const bg = station.farbe ?? '#14532d';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-4 p-4 border-b border-white/10" style={{ background: bg }}>
        <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl">
          {station.icon ?? '👨‍🍳'}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">Station</div>
          <div className="font-display text-2xl font-bold">{station.name}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] opacity-70">Offen</div>
          <div className="font-display text-3xl font-bold">{items.length}</div>
        </div>
        <button
          onClick={() => setAudio((v) => !v)}
          className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          {audio ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </button>
      </header>

      {/* Items */}
      <main className="p-4">
        {orderBlocks.length === 0 ? (
          <div className="min-h-[60vh] grid place-items-center text-white/40">
            <div className="text-center">
              <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <div className="text-2xl font-display">Alles erledigt.</div>
              <div className="text-sm mt-2">Warten auf neue Bestellungen.</div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {orderBlocks.map(({ orderId, order, items }) => (
              <OrderBlock
                key={orderId}
                order={order}
                items={items}
                stationColor={bg}
                onAdvance={advance}
                tick={tick}
                tableInfo={order.tisch_id ? tableMap[order.tisch_id] : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrderBlock({
  order, items, stationColor, onAdvance, tick, tableInfo,
}: {
  order: Item['order'];
  items: Item[];
  stationColor: string;
  onAdvance: (id: string, to: 'in_arbeit' | 'fertig') => void;
  tick: number;
  tableInfo?: TableInfo;
}) {
  void tick;
  const waitMin = order.bestellt_am ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60000) : 0;
  const urgent = waitMin >= 15;
  const critical = waitMin >= 25;

  const allDone = items.every((i) => i.station_status === 'fertig');

  const isTable = Boolean(order.tisch_id);
  const typLabel = isTable ? 'Tisch' : order.typ === 'lieferung' ? '🛵 Liefern' : order.typ === 'abholung' ? '🥡 Abholung' : order.kunde_name;

  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4 transition overflow-hidden',
        critical ? 'border-red-500 bg-red-950/30 animate-pulse' :
        urgent ? 'border-amber-500 bg-amber-950/20' :
        'border-white/15 bg-white/5',
      )}
    >
      {/* GROSSE TISCH-NUMMER oben wenn Tisch-Order */}
      {isTable && tableInfo && (
        <div className="flex items-center gap-3 mb-3 -mx-4 -mt-4 px-4 py-3 border-b-2 border-white/10" style={{ background: `${stationColor}80` }}>
          <div className="h-16 w-16 rounded-2xl bg-white text-black flex items-center justify-center font-display font-black text-4xl shrink-0 shadow-lg">
            {tableInfo.nummer}
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">Tisch</div>
            <div className="font-display text-xl font-black leading-tight">{tableInfo.nummer}</div>
            {(tableInfo.name || tableInfo.bereich) && (
              <div className="text-xs opacity-70 mt-0.5">
                {tableInfo.name}{tableInfo.name && tableInfo.bereich ? ' · ' : ''}{tableInfo.bereich}
              </div>
            )}
          </div>
          {order.gedeckt_personen && (
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Pers.</div>
              <div className="font-display text-2xl font-black">{order.gedeckt_personen}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <div className="font-mono text-xs font-bold text-white/60">
            #{order.bestellnummer.replace('FF-', '')}
          </div>
          {!isTable && <div className="text-sm font-display font-bold">{typLabel}</div>}
        </div>
        <div className={cn(
          'rounded-full px-3 py-1 text-sm font-bold inline-flex items-center gap-1',
          critical ? 'bg-red-500' : urgent ? 'bg-amber-500 text-black' : 'bg-white/15',
        )}>
          <Clock className="h-3 w-3" /> {waitMin}′
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className={cn(
            'rounded-xl p-3 transition',
            it.station_status === 'in_arbeit' ? 'bg-yellow-500/20 border border-yellow-500/50' :
            it.station_status === 'fertig' ? 'bg-matcha-700/30 line-through opacity-60' :
            'bg-white/10',
          )}>
            <div className="flex items-start gap-2">
              <span
                className="h-8 w-8 rounded-lg flex items-center justify-center font-bold shrink-0"
                style={{ background: stationColor, color: 'white' }}
              >
                {it.menge}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{it.name}</div>
                {it.notiz && (
                  <div className="text-sm italic text-yellow-300 mt-1">„{it.notiz}"</div>
                )}
              </div>
              <div className="flex gap-1">
                {it.station_status === 'offen' && (
                  <button
                    onClick={() => onAdvance(it.id, 'in_arbeit')}
                    className="h-8 px-2 rounded-md bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400"
                  >
                    Start
                  </button>
                )}
                {(it.station_status === 'offen' || it.station_status === 'in_arbeit') && (
                  <button
                    onClick={() => onAdvance(it.id, 'fertig')}
                    className="h-8 w-8 rounded-md bg-matcha-600 hover:bg-matcha-500 flex items-center justify-center"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="mt-3 rounded-xl bg-matcha-700/50 border border-matcha-400 p-3 text-center text-sm font-bold">
          ✅ Alles fertig — zur Abholung bereit
        </div>
      )}
    </div>
  );
}

function ding() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const now = ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(880, now);
    o.frequency.setValueAtTime(1320, now + 0.1);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start(now); o.stop(now + 0.4);
  } catch {}
}
