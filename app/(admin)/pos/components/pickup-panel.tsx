'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Package, X, ChevronRight, Truck, Store } from 'lucide-react';

export type PickupOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_telefon: string | null;
  typ: string;
  gesamtbetrag: number;
  zwischensumme: number;
  liefergebuehr: number;
  zahlungsart: string;
  bezahlt: boolean;
  fertig_am: string | null;
  external_source: string | null;
  items: { id: string; name: string; menge: number; einzelpreis: number; menu_item_id: string | null }[];
};

type Props = {
  locationId: string | null;
  open: boolean;
  onClose: () => void;
  onLoad: (order: PickupOrder) => void;
};

export function PickupPanel({ locationId, open, onClose, onLoad }: Props) {
  const supabase = createClient();
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const ch = supabase
      .channel('pos_pickup')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders' },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locationId]);

  async function refresh() {
    setLoading(true);
    let q = supabase
      .from('customer_orders')
      .select('id,bestellnummer,kunde_name,kunde_telefon,typ,gesamtbetrag,zwischensumme,liefergebuehr,zahlungsart,bezahlt,fertig_am,external_source,items:order_items(id,name,menge,einzelpreis,menu_item_id)')
      .eq('status', 'fertig')
      .in('typ', ['abholung', 'lieferung'])
      .order('fertig_am', { ascending: true });
    if (locationId) q = q.eq('location_id', locationId);
    const { data } = await q;
    setOrders((data as any) ?? []);
    setLoading(false);
  }

  const pickupOrders = orders.filter((o) => o.typ === 'abholung');
  const deliveryOrders = orders.filter((o) => o.typ === 'lieferung');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="w-full max-w-md bg-[#0d1f16] border-l border-white/10 flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-white font-bold text-lg font-display">Offene Bestellungen</div>
            <div className="text-white/50 text-xs">
              {pickupOrders.length} Abholung · {deliveryOrders.length} Lieferung
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-2" aria-label="Schließen">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading && orders.length === 0 && (
            <div className="text-white/40 text-sm text-center py-10">Lade …</div>
          )}

          {orders.length === 0 && !loading && (
            <div className="text-center py-10">
              <Package className="h-12 w-12 text-white/20 mx-auto mb-3" />
              <div className="text-white/60">Keine fertigen Bestellungen.</div>
              <div className="text-white/30 text-xs mt-1">Erscheint sobald die Küche fertig markiert.</div>
            </div>
          )}

          {pickupOrders.length > 0 && (
            <Section title="Abholung" icon={<Store size={14} />}>
              {pickupOrders.map((o) => (
                <OrderCard key={o.id} order={o} onLoad={() => onLoad(o)} />
              ))}
            </Section>
          )}

          {deliveryOrders.length > 0 && (
            <Section title="Lieferung" icon={<Truck size={14} />}>
              {deliveryOrders.map((o) => (
                <OrderCard key={o.id} order={o} onLoad={() => onLoad(o)} />
              ))}
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4ae68a] mb-2 px-1">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function OrderCard({ order, onLoad }: { order: PickupOrder; onLoad: () => void }) {
  const waitMin = order.fertig_am
    ? Math.floor((Date.now() - new Date(order.fertig_am).getTime()) / 60_000)
    : 0;
  const warn = waitMin >= 10;

  return (
    <button
      onClick={onLoad}
      className={cn(
        'w-full text-left rounded-xl p-4 transition',
        'bg-white/5 hover:bg-white/10 border border-white/10',
        'active:scale-[0.99]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-[#4ae68a] tracking-wider">
              #{order.bestellnummer.replace('FF-', '')}
            </span>
            {order.external_source && (
              <span className="rounded-full bg-[#d4a843] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#0d1f16]">
                {order.external_source}
              </span>
            )}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
              order.bezahlt ? 'bg-[#14532d] text-white' : 'bg-[#d4a843] text-[#0d1f16]',
            )}>
              {order.bezahlt ? 'Bezahlt' : order.zahlungsart === 'bar' ? 'Bar fällig' : 'Karte fällig'}
            </span>
          </div>
          <div className="mt-1 text-white font-semibold truncate">{order.kunde_name}</div>
          <div className="text-white/50 text-xs mt-0.5">
            {order.items.length} {order.items.length === 1 ? 'Artikel' : 'Artikel'} ·{' '}
            {order.items.slice(0, 2).map((i) => `${i.menge}× ${i.name}`).join(', ')}
            {order.items.length > 2 && ` + ${order.items.length - 2} weitere`}
          </div>
        </div>
        <ChevronRight className="text-white/40 shrink-0" size={20} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <div className={cn('flex items-center gap-1 text-xs', warn ? 'text-[#d4a843] font-bold' : 'text-white/50')}>
          <Clock size={12} />
          {waitMin} Min. wartet
        </div>
        <div className="text-white font-bold font-display text-lg">
          {order.gesamtbetrag.toFixed(2)} €
        </div>
      </div>
    </button>
  );
}
