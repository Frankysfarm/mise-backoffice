'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowRightLeft, ChefHat, Loader2, Merge, X, Utensils } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Table = { id: string; nummer: string; name: string | null; bereich: string | null };

export function TableActionsDialog({
  tenantId, locationId, currentTable, onClose,
}: {
  tenantId: string;
  locationId: string;
  currentTable: { id: string; nummer: string; name: string | null };
  onClose: () => void;
}) {
  const supabase = createClient();
  const [action, setAction] = useState<'transfer' | 'merge' | 'course' | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [targetTable, setTargetTable] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: os }] = await Promise.all([
        supabase.from('restaurant_tables').select('id, nummer, name, bereich')
          .eq('location_id', locationId).eq('aktiv', true).neq('id', currentTable.id).order('sort_order'),
        supabase.from('customer_orders')
          .select('id, bestellnummer, items:order_items(id, name, menge, gang, gang_fired_at, gesamtpreis)')
          .eq('tisch_id', currentTable.id)
          .in('status', ['wartet_auf_zahlung', 'neu', 'bestätigt', 'in_zubereitung', 'fertig']),
      ]);
      setTables((ts as any[]) ?? []);
      setOrders((os as any[]) ?? []);
    })();
    // eslint-disable-next-line
  }, []);

  async function doTransfer() {
    if (!targetTable) return;
    setPending(true);
    const { data } = await supabase.rpc('transfer_table_orders', {
      p_from_table_id: currentTable.id,
      p_to_table_id: targetTable,
    });
    setStatus((data as any)?.ok
      ? { ok: true, msg: `${(data as any).transferred} Bestellung(en) verschoben` }
      : { ok: false, msg: (data as any)?.error ?? 'Fehler' });
    setPending(false);
  }

  async function doFireCourse(gang: number) {
    setPending(true);
    for (const o of orders) {
      await supabase.rpc('fire_course', { p_order_id: o.id, p_gang: gang });
    }
    setStatus({ ok: true, msg: `Gang ${gang} an Küche gefeuert` });
    setPending(false);
  }

  // Orders-Items nach Gang gruppiert
  const itemsByGang = new Map<number, any[]>();
  orders.forEach((o) => {
    (o.items ?? []).forEach((it: any) => {
      const g = it.gang ?? 0;
      if (!itemsByGang.has(g)) itemsByGang.set(g, []);
      itemsByGang.get(g)!.push(it);
    });
  });

  return (
    <div className="fixed inset-0 z-[55] bg-black/80 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full">
        <header className="p-5 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-900 text-white grid place-items-center font-display font-black">
            {currentTable.nummer}
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tisch-Aktionen</div>
            <h2 className="font-display text-xl font-black">Tisch {currentTable.nummer}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5">
          {!action ? (
            <div className="space-y-2">
              <ActionButton icon={<ArrowRightLeft className="h-5 w-5" />} label="Tisch transferieren" sub="Gäste wechseln Tisch" onClick={() => setAction('transfer')} />
              <ActionButton icon={<Merge className="h-5 w-5" />} label="Mit anderem Tisch zusammenlegen" sub="Rechnung kombinieren" onClick={() => setAction('merge')} />
              <ActionButton icon={<ChefHat className="h-5 w-5" />} label="Gang an Küche feuern" sub="Vorspeise / Hauptspeise senden" onClick={() => setAction('course')} />
            </div>
          ) : action === 'course' ? (
            <div>
              <div className="text-sm text-muted-foreground mb-3">Welchen Gang feuern?</div>
              {Array.from(itemsByGang.entries()).sort(([a], [b]) => a - b).map(([gang, items]) => {
                const notFired = items.filter((i) => !i.gang_fired_at);
                return (
                  <button
                    key={gang}
                    onClick={() => doFireCourse(gang)}
                    disabled={notFired.length === 0 || pending}
                    className={cn(
                      'w-full rounded-xl border-2 p-3 text-left mb-2 transition',
                      notFired.length > 0 ? 'hover:bg-muted cursor-pointer' : 'opacity-40',
                    )}
                  >
                    <div className="font-display font-bold">
                      {gang === 0 ? '⚡ Sofort' : gang === 1 ? '🥗 Vorspeise' : gang === 2 ? '🍽 Hauptspeise' : gang === 3 ? '🍰 Dessert' : `Gang ${gang}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {items.length} Item(s) · {notFired.length > 0 ? `${notFired.length} noch nicht gefeuert` : 'Alle gefeuert'}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="text-sm text-muted-foreground mb-3">
                Ziel-Tisch wählen
              </div>
              <div className="max-h-64 overflow-y-auto grid grid-cols-4 gap-2">
                {tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTargetTable(t.id)}
                    className={cn(
                      'aspect-square rounded-xl border-2 font-display font-black text-2xl',
                      targetTable === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-muted',
                    )}
                  >
                    {t.nummer}
                  </button>
                ))}
              </div>
              <button
                onClick={doTransfer}
                disabled={!targetTable || pending}
                className="mt-4 w-full h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {action === 'merge' ? 'Zusammenlegen' : 'Transferieren'}
              </button>
            </div>
          )}

          {status && (
            <div className={cn(
              'mt-3 text-sm text-center p-2 rounded-lg',
              status.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900',
            )}>
              {status.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border-2 p-4 text-left hover:bg-muted transition flex items-center gap-3"
    >
      <div className="h-11 w-11 rounded-xl bg-gray-900 text-white grid place-items-center shrink-0">{icon}</div>
      <div>
        <div className="font-display font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </button>
  );
}
