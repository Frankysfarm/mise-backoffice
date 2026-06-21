'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, AlertTriangle, CheckCircle2, Zap, Loader2 } from 'lucide-react';

interface QueueOrder {
  order_id: string;
  bestellnummer: string;
  status: string;
  accepted_at: string | null;
  prep_started_at: string | null;
  estimated_ready_at: string | null;
  kunde_name: string | null;
  items_count: number;
}

interface Props {
  locationId: string;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function ampel(secsLeft: number): { bg: string; text: string; label: string } {
  if (secsLeft < 0)  return { bg: 'bg-red-500/20 border-red-500/50',   text: 'text-red-400',   label: 'Überfällig'   };
  if (secsLeft < 120) return { bg: 'bg-orange-500/20 border-orange-400/50', text: 'text-orange-400', label: 'Kritisch' };
  if (secsLeft < 300) return { bg: 'bg-amber-500/20 border-amber-400/50',   text: 'text-amber-400',  label: 'Dringend'  };
  return { bg: 'bg-matcha-600/20 border-matcha-500/30', text: 'text-matcha-400', label: 'OK' };
}

export function KitchenEchtzeitAmpelBoard({ locationId }: Props) {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const now = useNow();

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const list: QueueOrder[] = Array.isArray(d?.orders) ? d.orders
            : Array.isArray(d?.queue) ? d.queue
            : Array.isArray(d) ? d : [];
          setOrders(list.filter((o: QueueOrder) => o.status !== 'geliefert' && o.status !== 'abgeholt'));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const active = orders.filter(o => ['in_zubereitung', 'preparing'].includes(o.status));
  const waiting = orders.filter(o => ['bestätigt', 'angenommen', 'neu'].includes(o.status));
  const ready   = orders.filter(o => ['fertig', 'ready'].includes(o.status));

  const criticalCount = active.filter(o => {
    if (!o.estimated_ready_at) return false;
    return (new Date(o.estimated_ready_at).getTime() - now) / 1000 < 120;
  }).length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
            Echtzeit-Ampelboard
          </span>
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {criticalCount} Kritisch
            </span>
          )}
          {!loading && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
              {active.length} aktiv · {waiting.length} wartend · {ready.length} fertig
            </span>
          )}
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-stone-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Warteschlange…
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-stone-400">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" /> Keine aktiven Bestellungen
            </div>
          )}

          {!loading && active.map(o => {
            const readyAt = o.estimated_ready_at ? new Date(o.estimated_ready_at).getTime() : null;
            const secsLeft = readyAt ? Math.floor((readyAt - now) / 1000) : null;
            const color = secsLeft != null ? ampel(secsLeft) : { bg: 'bg-stone-50 border-stone-200', text: 'text-stone-500', label: '—' };
            const mm = secsLeft != null ? Math.floor(Math.abs(secsLeft) / 60) : null;
            const ss = secsLeft != null ? Math.abs(secsLeft) % 60 : null;

            return (
              <div key={o.order_id} className={cn('flex items-center gap-3 px-4 py-3 border-l-4 transition', color.bg)}>
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display font-black text-base', color.bg, color.text)}>
                  <ChefHat size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-stone-800 truncate">{o.bestellnummer}</span>
                    {o.kunde_name && <span className="text-[10px] text-stone-400 truncate">{o.kunde_name}</span>}
                  </div>
                  <div className={cn('text-[10px] font-bold uppercase tracking-wide mt-0.5', color.text)}>
                    {color.label} · {o.items_count} Artikel
                  </div>
                </div>
                {secsLeft != null && (
                  <div className={cn('tabular-nums font-mono font-black text-sm shrink-0', color.text)}>
                    {secsLeft < 0 ? '-' : ''}{mm}:{String(ss).padStart(2, '0')}
                    <div className="text-[9px] font-normal text-center opacity-70">verbleibend</div>
                  </div>
                )}
                {secsLeft == null && (
                  <Clock className={cn('h-4 w-4 shrink-0', color.text)} />
                )}
              </div>
            );
          })}

          {!loading && waiting.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 bg-stone-50">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-bold text-stone-600">
                {waiting.length} Bestellung{waiting.length > 1 ? 'en' : ''} warten auf Start
              </span>
              <div className="flex gap-1 ml-auto">
                {waiting.slice(0, 4).map(o => (
                  <span key={o.order_id} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                    {o.bestellnummer}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!loading && ready.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 bg-matcha-50">
              <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600" />
              <span className="text-[11px] font-bold text-matcha-700">
                {ready.length} Bestellung{ready.length > 1 ? 'en' : ''} fertig — warte auf Abholung
              </span>
              {ready.some(o => {
                if (!o.estimated_ready_at) return false;
                return (now - new Date(o.estimated_ready_at).getTime()) > 5 * 60_000;
              }) && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 ml-auto animate-pulse" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
