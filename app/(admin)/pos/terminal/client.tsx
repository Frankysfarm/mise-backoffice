'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  Banknote, Check, CheckCircle2, ChevronLeft, CreditCard, Grid, Loader2,
  Minus, Percent, Plus, Printer, ShoppingBag, Smartphone, Tag,
  Trash2, Users, Utensils, X, Zap,
} from 'lucide-react';
import { POSItemOptionsModal, type AddPayload } from './options-modal';
import { ShiftStarter } from './shift-starter';
import { ShiftCloseDialog } from './shift-close';
import { ShiftHeader } from './shift-header';
import { TransactionsHistory } from './transactions-history';
import { PayPendingDialog } from './pay-pending-dialog';
import { SoldOutDialog } from './sold-out-dialog';
import { RestockCheck } from './restock-check';

type Category = { id: string; name: string; icon: string | null };
type MenuItem = {
  id: string; name: string; beschreibung: string | null; preis: number;
  bild_url: string | null; category_id: string | null; beliebt: boolean;
  allergene: string[] | null; tags: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras: any;
};
type Table = {
  id: string; nummer: string; name: string | null;
  bereich: string | null; kapazitaet: number | null;
  pos_x?: number | null; pos_y?: number | null;
  breite?: number | null; hoehe?: number | null;
  form?: 'rund' | 'eckig' | 'lang' | null;
};
type OpenTablesMap = Record<string, { offene_orders: number; offene_summe: number }>;
type Mode = { typ: 'tisch'; table: Table } | { typ: 'takeaway' } | null;
type SelectedExtras = Record<string, string[]>;
type CartLine = {
  lineId: string;
  item: MenuItem;
  qty: number;
  mwst_satz: number;
  extras: SelectedExtras;
  extraPrice: number;
  notiz?: string;
};

type PendingOrder = {
  order_id: string; bestellnummer: string; tisch_id: string; tisch_nummer: string;
  tisch_name: string | null; tisch_bereich: string | null;
  gesamtbetrag: number; zahlungsart: string; anzahl_items: number;
  bestellt_am: string;
};

type Shift = { id: string; employee_id: string; start_at: string; status: string };

export function POSTerminalNew({
  tenantId, locationId, employeeId, employeeName, registerId,
  categories, items, tables, openTables, initialShift, pendingOrders,
}: {
  tenantId: string;
  locationId: string;
  employeeId: string;
  employeeName: string;
  registerId: string | null;
  categories: Category[];
  items: MenuItem[];
  tables: Table[];
  openTables?: OpenTablesMap;
  initialShift?: Shift | null;
  pendingOrders?: PendingOrder[];
}) {
  const supabase = createClient();
  const [shift, setShift] = useState<Shift | null>(initialShift ?? null);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingPayId, setPendingPayId] = useState<string | null>(null);
  const [soldOutItem, setSoldOutItem] = useState<MenuItem | null>(null);
  const [restockDone, setRestockDone] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!sessionStorage.getItem('pos_restock_done');
  });
  const [trainingMode, setTrainingMode] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? '');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useTransition();
  const [success, setSuccess] = useState<{ number: string; method: string; bonToken: string | null } | null>(null);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [discount, setDiscount] = useState<{ typ: 'prozent' | 'euro'; wert: number } | null>(null);

  const subtotal = cart.reduce((s, l) => s + l.qty * (l.item.preis + l.extraPrice), 0);
  const discountAmount =
    !discount ? 0 :
    discount.typ === 'prozent' ? (subtotal * discount.wert) / 100 :
    Math.min(subtotal, discount.wert);
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  // VAT Split: dine-in = 19%, takeaway = 7%
  const vatRate = mode?.typ === 'tisch' ? 19 : 7;
  const vatAmount = total - total / (1 + vatRate / 100);

  const filteredItems = useMemo(() => {
    return activeCat ? items.filter((i) => i.category_id === activeCat) : items;
  }, [items, activeCat]);

  function onTapItem(item: MenuItem) {
    const hasOptions = Array.isArray(item.extras) && item.extras.length > 0;
    if (hasOptions) {
      setActiveItem(item);
    } else {
      // Direkt in Cart — stapelt bei gleichem Item ohne Optionen
      setCart((c) => {
        const existing = c.find((l) => l.item.id === item.id && Object.keys(l.extras).length === 0 && !l.notiz);
        if (existing) return c.map((l) => l === existing ? { ...l, qty: l.qty + 1 } : l);
        return [...c, {
          lineId: `${item.id}-${Date.now()}`,
          item, qty: 1, mwst_satz: vatRate,
          extras: {}, extraPrice: 0,
        }];
      });
    }
  }

  function addFromModal(payload: AddPayload) {
    setCart((c) => [...c, {
      lineId: `${payload.item.id}-${Date.now()}`,
      item: payload.item as MenuItem,
      qty: payload.qty,
      mwst_satz: vatRate,
      extras: payload.selected,
      extraPrice: payload.extraPrice,
      notiz: payload.notiz || undefined,
    }]);
    setActiveItem(null);
  }

  function updateQty(idx: number, delta: number) {
    setCart((c) => {
      const next = [...c];
      const line = next[idx];
      if (!line) return c;
      const newQty = line.qty + delta;
      if (newQty <= 0) next.splice(idx, 1);
      else next[idx] = { ...line, qty: newQty };
      return next;
    });
  }

  async function submitOrder(method: 'bar' | 'karte' | 'online') {
    if (!mode || cart.length === 0) return;
    setSubmitting(async () => {
      try {
        // 1) customer_orders anlegen (für Küche + Routing)
        const { data: order, error: orderErr } = await supabase.from('customer_orders').insert({
          tenant_id: tenantId,
          location_id: locationId,
          tisch_id: mode.typ === 'tisch' ? mode.table.id : null,
          kellner_id: employeeId,
          typ: mode.typ === 'tisch' ? 'vor_ort' : 'abholung',
          status: 'neu',
          kunde_name: mode.typ === 'tisch' ? `Tisch ${mode.table.nummer}` : `Abholung ${employeeName}`,
          zwischensumme: total,
          gesamtbetrag: total,
          zahlungsart: method === 'online' ? 'online' : method,
          bezahlt: true, // POS: direkt bezahlt
          bestellt_am: new Date().toISOString(),
          bestaetigt_am: new Date().toISOString(),
          geschaetzte_zubereitung_min: Math.max(5, cart.length * 3),
        }).select('id, bestellnummer').single();

        if (orderErr || !order) throw orderErr || new Error('Bestellung konnte nicht angelegt werden');

        // 2) order_items (Trigger setzt station_id automatisch)
        const itemRows = cart.map((l) => ({
          order_id: order.id,
          menu_item_id: l.item.id,
          name: l.item.name + (l.extraPrice > 0 ? ' (+ Optionen)' : ''),
          menge: l.qty,
          einzelpreis: l.item.preis + l.extraPrice,
          gesamtpreis: l.qty * (l.item.preis + l.extraPrice),
          notiz: [
            l.notiz,
            ...describeExtras(l.extras, l.item),
          ].filter(Boolean).join(' · ') || null,
          extras: l.extras,
        }));
        await supabase.from('order_items').insert(itemRows);

        // 3) pos_transaction — via API (inkl. TSE-Signierung)
        let bonToken: string | null = null;
        if (registerId) {
          const txRes = await fetch('/api/pos/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              location_id: locationId,
              register_id: registerId,
              shift_id: shift?.id ?? null,
              customer_order_id: order.id,
              tisch_id: mode.typ === 'tisch' ? mode.table.id : null,
              typ: 'verkauf',
              mitarbeiter_id: employeeId,
              brutto_gesamt: total,
              mwst_gesamt: vatAmount,
              netto_gesamt: total - vatAmount,
              vat_rates: [{ satz: vatRate, brutto: total, netto: total - vatAmount, steuer: vatAmount }],
              zahlungsart: method,
              trainingsbon: trainingMode,
            }),
          });
          const txData = await txRes.json();
          bonToken = txData.bon_token ?? null;
        }

        setSuccess({ number: order.bestellnummer, method, bonToken });
        setCart([]);
        setDiscount(null);
        setPaymentOpen(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Fehler bei der Zahlung');
      }
    });
  }

  function reset() {
    setSuccess(null);
    setMode(null);
    setCart([]);
    setDiscount(null);
  }

  function describeExtras(extras: SelectedExtras, item: MenuItem): string[] {
    const groups = Array.isArray(item.extras) ? item.extras : [];
    const out: string[] = [];
    for (const g of groups) {
      const ids = extras[g.id];
      if (!ids || ids.length === 0) continue;
      const names = ids.map((id) => g.options?.find((o: any) => o.id === id)?.name).filter(Boolean);
      if (names.length > 0) out.push(`${g.name}: ${names.join(', ')}`);
    }
    return out;
  }

  /* ========== SHIFT-STARTER (vor allem) ========== */
  if (!shift) {
    return (
      <ShiftStarter
        tenantId={tenantId}
        locationId={locationId}
        employeeId={employeeId}
        employeeName={employeeName}
        registerId={registerId}
        existingShift={null}
        onStarted={(s) => {
          setShift(s);
          sessionStorage.removeItem('pos_restock_done');
          setRestockDone(false);
        }}
      />
    );
  }

  /* ========== RESTOCK-CHECK (direkt nach Shift-Start) ========== */
  if (!restockDone) {
    return (
      <RestockCheck
        locationId={locationId}
        onDone={() => {
          sessionStorage.setItem('pos_restock_done', '1');
          setRestockDone(true);
        }}
      />
    );
  }

  /* ========== SUCCESS SCREEN ========== */
  if (success) {
    return (
      <SuccessScreen
        orderNumber={success.number}
        bonToken={success.bonToken}
        method={success.method}
        onReset={reset}
      />
    );
  }

  /* ========== MODE-SELECTOR (erster Schritt) ========== */
  if (!mode) {
    return (
      <ModeSelector
        tables={tables}
        openTables={openTables ?? {}}
        pendingOrders={pendingOrders ?? []}
        onTakeaway={() => setMode({ typ: 'takeaway' })}
        onTable={(t) => setMode({ typ: 'tisch', table: t })}
        onCloseShift={() => setCloseShiftOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        trainingMode={trainingMode}
        onToggleTraining={() => setTrainingMode(!trainingMode)}
        onPayPending={(orderId) => setPendingPayId(orderId)}
      />
    );
  }

  /* ========== TERMINAL ========== */
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col md:flex-row">
      {/* LEFT: Menu */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <header className="flex items-center gap-2 p-3 border-b bg-white">
          <button
            onClick={() => { setMode(null); setCart([]); }}
            className="h-10 w-10 rounded-xl hover:bg-muted grid place-items-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            {mode.typ === 'tisch' ? (
              <div className="flex items-center gap-2.5">
                <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-matcha-900 to-matcha-700 text-matcha-50 font-display font-black grid place-items-center shadow-md shadow-matcha-900/20">
                  <span className="text-lg leading-none">{mode.table.nummer}</span>
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-gold ring-2 ring-white animate-pulse" title="Aktiver Tisch" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-matcha-700">Tisch · 19 % MwSt</div>
                  <div className="font-display font-bold leading-tight text-matcha-900">
                    {mode.table.name ?? `Tisch ${mode.table.nummer}`}
                    {mode.table.bereich && <span className="text-muted-foreground font-normal text-sm"> · {mode.table.bereich}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold to-gold/70 text-matcha-900 grid place-items-center shadow-md shadow-gold/30">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-matcha-700">Take-Away · 7 % MwSt</div>
                  <div className="font-display font-bold leading-tight text-matcha-900">Abholung</div>
                </div>
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Kellner: <strong>{employeeName}</strong>
          </div>
        </header>

        {/* Category tabs */}
        <div className="border-b bg-white overflow-x-auto">
          <div className="flex gap-1 p-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition',
                  activeCat === c.id
                    ? 'bg-matcha-900 text-matcha-50 shadow'
                    : 'bg-surface-warm hover:bg-gold/30 text-matcha-900',
                )}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
          {filteredItems.length === 0 ? (
            <div className="h-full grid place-items-center text-muted-foreground">
              <div className="text-center">
                <Utensils className="h-12 w-12 mx-auto opacity-30 mb-2" />
                Keine Produkte in dieser Kategorie.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredItems.map((it) => {
                const qtyInCart = cart.filter((l) => l.item.id === it.id).reduce((s, l) => s + l.qty, 0);
                const hasOptions = Array.isArray(it.extras) && it.extras.length > 0;
                return (
                  <LongPressTile
                    key={it.id}
                    onClick={() => onTapItem(it)}
                    onLongPress={() => setSoldOutItem(it)}
                    className={cn(
                      'group relative rounded-2xl bg-white border-2 p-2 text-left transition-all',
                      'active:scale-[0.97] hover:shadow-lg hover:-translate-y-0.5',
                      qtyInCart > 0
                        ? 'border-matcha-700 bg-matcha-50/40 ring-2 ring-matcha-500/30 shadow-md'
                        : 'border-gray-200 hover:border-matcha-400',
                    )}
                  >
                    {hasOptions && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-gold/90 text-matcha-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm">
                        + Optionen
                      </div>
                    )}
                    {it.beliebt && !hasOptions && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-rose-500/95 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm inline-flex items-center gap-1">
                        ★ Top
                      </div>
                    )}
                    {qtyInCart > 0 && (
                      <div className="absolute -top-2 -right-2 z-10 h-8 min-w-8 px-2 rounded-full bg-matcha-700 text-white font-display font-black text-sm grid place-items-center shadow-lg ring-2 ring-white">
                        {qtyInCart}×
                      </div>
                    )}
                    {it.bild_url ? (
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted mb-2">
                        <Image src={it.bild_url} fill alt={it.name} className="object-cover transition-transform group-hover:scale-105" unoptimized />
                        <div className="absolute bottom-1.5 right-1.5 h-9 w-9 rounded-full bg-matcha-900/90 text-matcha-50 grid place-items-center shadow-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition">
                          <Plus className="h-5 w-5" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative aspect-[4/3] rounded-xl bg-gradient-to-br from-matcha-50 to-gold/20 grid place-items-center text-4xl mb-2 border border-matcha-100">
                        🍽
                        <div className="absolute bottom-1.5 right-1.5 h-9 w-9 rounded-full bg-matcha-900/90 text-matcha-50 grid place-items-center shadow-lg opacity-0 group-hover:opacity-100 transition">
                          <Plus className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                    <div className="px-1">
                      <div className="font-bold text-sm leading-tight line-clamp-2 text-matcha-900">{it.name}</div>
                      <div className="mt-1 font-display font-black text-base text-matcha-800">
                        {euro(it.preis)}
                      </div>
                    </div>
                  </LongPressTile>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* RIGHT: Cart (desktop) / Bottom sheet (mobile) */}
      <aside className="md:w-[400px] border-t md:border-t-0 md:border-l bg-gradient-to-b from-white to-surface flex flex-col max-h-[45vh] md:max-h-none">
        <header className="p-4 border-b border-matcha-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-matcha-50 text-matcha-900 grid place-items-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-matcha-700">Bon</div>
              <div className="font-display text-base font-bold text-matcha-900 leading-tight">
                {itemCount} {itemCount === 1 ? 'Position' : 'Positionen'}
              </div>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => { if (confirm('Alle Positionen verwerfen?')) setCart([]); }}
              className="text-xs text-muted-foreground hover:text-red-600 inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Leeren
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full min-h-32 grid place-items-center text-muted-foreground text-sm">
              <div className="text-center">
                <ShoppingBag className="h-10 w-10 mx-auto opacity-30 mb-2" />
                Produkte antippen…
              </div>
            </div>
          ) : (
            cart.map((l, idx) => {
              const lineTotal = l.qty * (l.item.preis + l.extraPrice);
              const extrasDesc = describeExtras(l.extras, l.item);
              return (
                <div key={l.lineId} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm leading-tight">{l.item.name}</div>
                      {extrasDesc.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                          {extrasDesc.map((d, i) => <div key={i}>→ {d}</div>)}
                        </div>
                      )}
                      {l.notiz && (
                        <div className="text-[11px] italic text-orange-700 mt-0.5">„{l.notiz}"</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {euro(l.item.preis + l.extraPrice)} · {l.mwst_satz}% MwSt
                      </div>
                    </div>
                    <div className="font-display font-black text-sm">
                      {euro(lineTotal)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => setCart((c) => c.filter((x) => x.lineId !== l.lineId))}
                      className="text-xs text-muted-foreground hover:text-red-600 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Entfernen
                    </button>
                    <div className="flex items-center gap-1 bg-white rounded-full p-0.5 border">
                      <button onClick={() => updateQty(idx, -1)} className="h-7 w-7 rounded-full hover:bg-gray-100 grid place-items-center">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold w-5 text-center text-sm">{l.qty}</span>
                      <button onClick={() => updateQty(idx, 1)} className="h-7 w-7 rounded-full bg-matcha-800 text-white grid place-items-center">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Summary + Pay */}
        <footer className="border-t p-4 space-y-3 shrink-0 bg-white">
          {/* Discount-Row */}
          {cart.length > 0 && (
            <div className="flex gap-2">
              {discount ? (
                <div className="flex-1 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-amber-700" />
                    <span className="text-xs font-semibold text-amber-900">
                      Rabatt {discount.typ === 'prozent' ? `${discount.wert}%` : euro(discount.wert)}
                    </span>
                  </div>
                  <button onClick={() => setDiscount(null)} className="h-6 w-6 rounded-full hover:bg-amber-100 grid place-items-center">
                    <X className="h-3 w-3 text-amber-700" />
                  </button>
                </div>
              ) : (
                <QuickDiscountRow onSet={setDiscount} subtotal={subtotal} />
              )}
            </div>
          )}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Zwischensumme</span>
              <span>{euro(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Rabatt</span>
                <span>– {euro(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>enthält MwSt ({vatRate}%)</span>
              <span>{euro(vatAmount)}</span>
            </div>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t">
            <span className="font-display font-bold">Gesamt</span>
            <span className="font-display text-3xl font-black text-matcha-900">{euro(total)}</span>
          </div>
          <button
            onClick={() => setPaymentOpen(true)}
            disabled={cart.length === 0}
            className={cn(
              "group relative w-full h-16 rounded-2xl font-display font-black text-lg",
              "bg-gradient-to-br from-matcha-900 to-matcha-700 text-matcha-50",
              "shadow-lg shadow-matcha-900/30 transition-all",
              "hover:from-matcha-800 hover:to-matcha-600 hover:shadow-xl hover:shadow-matcha-900/40",
              "active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:from-matcha-900 disabled:hover:to-matcha-700",
              "flex items-center justify-center gap-3",
            )}
          >
            <CreditCard className="h-5 w-5 transition-transform group-hover:scale-110" />
            <span>Bezahlen · {euro(total)}</span>
            <span className="absolute right-4 opacity-60 group-hover:translate-x-1 group-hover:opacity-100 transition-all">→</span>
          </button>
        </footer>
      </aside>

      {/* Sold-Out-Dialog */}
      {soldOutItem && (
        <SoldOutDialog
          item={soldOutItem as any}
          onClose={() => setSoldOutItem(null)}
          onDone={() => {
            setSoldOutItem(null);
            // reload würde hier nötig sein, da items aus Server kommt;
            // für einfaches UX: router.refresh()
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}

      {/* Pay-Pending-Order-Dialog */}
      {pendingPayId && (
        <PayPendingDialog
          orderId={pendingPayId}
          registerId={registerId}
          shiftId={shift?.id ?? null}
          onClose={() => setPendingPayId(null)}
          onPaid={(bonToken, orderNumber, method) => {
            setPendingPayId(null);
            setSuccess({ number: orderNumber, method, bonToken });
          }}
        />
      )}

      {/* History-Dialog */}
      {historyOpen && (
        <TransactionsHistory
          tenantId={tenantId}
          shiftId={shift?.id ?? null}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Shift-Close-Dialog */}
      {closeShiftOpen && shift && (
        <ShiftCloseDialog
          shiftId={shift.id}
          startWechselgeld={Number((shift as any).start_wechselgeld ?? 0)}
          onClose={() => setCloseShiftOpen(false)}
          onClosed={() => {
            setShift(null);
            setCloseShiftOpen(false);
            setMode(null);
          }}
        />
      )}

      {/* Item Options Modal */}
      {activeItem && (
        <POSItemOptionsModal
          item={activeItem as any}
          onClose={() => setActiveItem(null)}
          onAdd={addFromModal}
        />
      )}

      {/* Payment modal */}
      {paymentOpen && (
        <PaymentModal
          total={total}
          submitting={submitting}
          onClose={() => setPaymentOpen(false)}
          onPay={submitOrder}
        />
      )}
    </div>
  );
}

/* ============================================ Success Screen mit QR ============================================ */

function SuccessScreen({
  orderNumber, bonToken, method, onReset,
}: {
  orderNumber: string;
  bonToken: string | null;
  method: string;
  onReset: () => void;
}) {
  const bonUrl = typeof window !== 'undefined' && bonToken
    ? `${window.location.origin}/bon/${bonToken}`
    : '';
  const qrSrc = bonUrl ? `/api/pos/qr?url=${encodeURIComponent(bonUrl)}&size=400` : '';

  const [emailInput, setEmailInput] = useState('');
  const [emailStage, setEmailStage] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(60);
  useEffect(() => {
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (secondsLeft === 0) onReset();
  }, [secondsLeft, onReset]);

  async function sendEmail() {
    if (!emailInput.includes('@') || !bonToken) return;
    setEmailStage('sending');
    try {
      const res = await fetch('/api/pos/bon/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bon_token: bonToken, email: emailInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) { setEmailStage('sent'); setEmailMsg(`Bon an ${emailInput} gesendet ✓`); }
      else { setEmailStage('error'); setEmailMsg(data.error ?? 'Fehler'); }
    } catch {
      setEmailStage('error');
      setEmailMsg('Netzwerkfehler');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white grid place-items-center p-4 overflow-y-auto">
      <div className="max-w-5xl w-full">
        {/* Top: Zahlung bestätigt (klein) */}
        <div className="text-center mb-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-matcha-600 grid place-items-center mb-2 animate-bounce">
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <div className="font-display text-xl font-black">
            {method === 'bar' ? 'Bar kassiert' : method === 'karte' ? 'Karte gezahlt' : 'Online bezahlt'}
            <span className="ml-2 font-mono text-gray-400">#{orderNumber.replace('FF-', '')}</span>
          </div>
        </div>

        {bonToken ? (
          <div className="grid md:grid-cols-[1fr,320px] gap-5 items-stretch">
            {/* GROSSER QR */}
            <div className="rounded-3xl border-4 border-gray-900 bg-white p-6 md:p-8 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500 mb-3">
                📱 QR-Code mit dem Handy scannen
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-black mb-5 leading-tight">
                Kassenbon aufs Handy
              </h2>
              <div className="mx-auto bg-white p-4 rounded-2xl border inline-block">
                {qrSrc && (
                  <img src={qrSrc} alt="QR-Code Bon" className="mx-auto block" width={320} height={320} />
                )}
              </div>
              <div className="mt-5 flex items-center justify-center gap-4 flex-wrap text-xs text-gray-700">
                <span>✓ Beleg als PDF</span>
                <span>✓ Bewirtungsbeleg</span>
                <span>✓ Steuererklärung</span>
              </div>
            </div>

            {/* Seite: E-Mail + Drucken + Reset */}
            <div className="flex flex-col gap-3">
              <div className="rounded-3xl border-2 bg-gray-50 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Oder per E-Mail senden
                </div>
                {emailStage === 'sent' ? (
                  <div className="flex items-center gap-2 text-sm text-matcha-800 font-bold">
                    <Check className="h-4 w-4" /> {emailMsg}
                  </div>
                ) : (
                  <>
                    <input
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      type="email"
                      placeholder="mail@kunde.de"
                      className="w-full h-12 rounded-xl border bg-white px-3 text-sm outline-none focus:border-gray-900 mb-2"
                    />
                    <button
                      onClick={sendEmail}
                      disabled={emailStage === 'sending' || !emailInput.includes('@')}
                      className="w-full h-12 rounded-xl bg-matcha-900 text-matcha-50 font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {emailStage === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : '✉'}
                      Senden
                    </button>
                    {emailStage === 'error' && (
                      <div className="mt-2 text-xs text-red-700">{emailMsg}</div>
                    )}
                  </>
                )}
              </div>

              <a
                href={bonUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-3xl border-2 bg-white hover:bg-gray-50 p-5 text-center transition"
              >
                <Printer className="h-6 w-6 mx-auto mb-1" />
                <div className="font-bold text-sm">Selbst drucken</div>
                <div className="text-xs text-gray-500">Auf dem Bon-Drucker oder PDF</div>
              </a>

              <button
                onClick={onReset}
                className="mt-auto h-14 rounded-2xl bg-matcha-900 text-matcha-50 font-display font-black text-base hover:bg-matcha-800"
              >
                Neuer Vorgang
                <span className="ml-2 text-xs opacity-60 font-mono">({secondsLeft}s)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 border p-5 text-sm text-gray-600 text-center">
            Kein Kassenbon erzeugt (keine Registrierkasse konfiguriert).
            <button
              onClick={onReset}
              className="mt-4 h-12 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold block mx-auto"
            >
              Neuer Vorgang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================ QuickDiscount ============================================ */

function QuickDiscountRow({
  onSet, subtotal,
}: { onSet: (d: { typ: 'prozent' | 'euro'; wert: number }) => void; subtotal: number }) {
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState('');
  const [typ, setTyp] = useState<'prozent' | 'euro'>('prozent');

  if (custom) {
    return (
      <div className="flex-1 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl p-1">
        <div className="flex bg-white rounded-lg p-0.5 border">
          <button onClick={() => setTyp('prozent')} className={cn('px-2 py-1 text-xs font-bold rounded', typ === 'prozent' ? 'bg-amber-200' : '')}>%</button>
          <button onClick={() => setTyp('euro')} className={cn('px-2 py-1 text-xs font-bold rounded', typ === 'euro' ? 'bg-amber-200' : '')}>€</button>
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="number"
          placeholder="0"
          className="flex-1 h-8 bg-transparent px-2 text-sm font-bold outline-none"
          autoFocus
        />
        <button
          onClick={() => {
            const n = Number(value);
            if (!isNaN(n) && n > 0) onSet({ typ, wert: n });
            setCustom(false); setValue('');
          }}
          className="h-8 px-2 rounded-lg bg-amber-700 text-white text-xs font-bold"
        >
          OK
        </button>
        <button onClick={() => setCustom(false)} className="h-8 w-8 rounded-full hover:bg-amber-100 grid place-items-center">
          <X className="h-3.5 w-3.5 text-amber-700" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-1">
      <button onClick={() => onSet({ typ: 'prozent', wert: 10 })} className="flex-1 h-8 rounded-lg border bg-white hover:bg-amber-50 text-xs font-bold text-amber-900 inline-flex items-center justify-center gap-1">
        <Percent className="h-3 w-3" /> 10%
      </button>
      <button onClick={() => onSet({ typ: 'prozent', wert: 20 })} className="flex-1 h-8 rounded-lg border bg-white hover:bg-amber-50 text-xs font-bold text-amber-900 inline-flex items-center justify-center gap-1">
        <Percent className="h-3 w-3" /> 20%
      </button>
      <button onClick={() => setCustom(true)} className="h-8 px-2 rounded-lg border bg-white hover:bg-amber-50 text-xs font-bold text-amber-900 inline-flex items-center justify-center gap-1">
        <Tag className="h-3 w-3" /> Rabatt
      </button>
    </div>
  );
}

/* ============================================ Mode Selector ============================================ */

function ModeSelector({
  tables, openTables, pendingOrders, onTakeaway, onTable, onPayPending, onCloseShift, onOpenHistory, trainingMode, onToggleTraining,
}: {
  tables: Table[];
  openTables: OpenTablesMap;
  pendingOrders: PendingOrder[];
  onTakeaway: () => void;
  onTable: (t: Table) => void;
  onPayPending: (orderId: string) => void;
  onCloseShift: () => void;
  onOpenHistory: () => void;
  trainingMode: boolean;
  onToggleTraining: () => void;
}) {
  const bereiche = Array.from(new Set(tables.map((t) => t.bereich).filter(Boolean))) as string[];
  const [filter, setFilter] = useState<string>('all');
  const hasLayout = tables.some((t) => (t.pos_x ?? 0) !== 0 || (t.pos_y ?? 0) !== 0);
  const [view, setView] = useState<'floor' | 'list'>(hasLayout ? 'floor' : 'list');
  const filtered = filter === 'all' ? tables : tables.filter((t) => t.bereich === filter);

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 p-4 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-black">Was möchtest du aufnehmen?</h1>
            <p className="text-gray-500 mt-1">Tisch antippen oder Take-Away starten.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/"
              className="shrink-0 h-10 px-3 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 text-sm font-bold inline-flex items-center gap-2"
              title="Zurück ins Backoffice"
            >
              <ChevronLeft className="h-4 w-4" /> Backoffice
            </Link>
            <button
              onClick={onToggleTraining}
              className={cn(
                'shrink-0 h-10 px-3 rounded-xl border-2 text-sm font-bold inline-flex items-center gap-2',
                trainingMode
                  ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                  : 'bg-white hover:bg-amber-50 border-amber-200 text-amber-900',
              )}
              title="Training-Modus: Buchungen werden als Trainings-Bon markiert"
            >
              🎓 {trainingMode ? 'TRAINING AN' : 'Training'}
            </button>
            <button
              onClick={onOpenHistory}
              className="shrink-0 h-10 px-4 rounded-xl border-2 bg-white hover:bg-gray-50 text-sm font-bold inline-flex items-center gap-2"
              title="Vergangene Bons · Storno · Nochmal drucken"
            >
              📜 Historie · Storno
            </button>
            <button
              onClick={onCloseShift}
              className="shrink-0 h-10 px-4 rounded-xl border-2 bg-white hover:bg-gray-50 text-sm font-bold inline-flex items-center gap-2"
              title="Schicht beenden"
            >
              🔚 Schicht beenden
            </button>
          </div>
        </div>

        {/* PENDING ORDERS — QR-Bestellungen die noch zu kassieren sind */}
        {pendingOrders.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-5 rounded-full bg-red-600 animate-pulse" />
              <h2 className="font-display text-lg font-black">Zu kassieren ({pendingOrders.length})</h2>
              <span className="text-xs text-gray-500">— Kunden sagen Tisch, du tippst hier rein</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingOrders.map((p) => {
                const waitMin = Math.floor((Date.now() - new Date(p.bestellt_am).getTime()) / 60000);
                return (
                  <button
                    key={p.order_id}
                    onClick={() => onPayPending(p.order_id)}
                    className="rounded-2xl bg-red-50 border-2 border-red-300 hover:bg-red-100 hover:border-red-500 p-4 text-left transition active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-red-600 text-white grid place-items-center font-display font-black text-lg shrink-0">
                        {p.tisch_nummer}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-matcha-900">Tisch {p.tisch_nummer}</div>
                        <div className="text-xs text-gray-500">
                          #{p.bestellnummer.replace('FF-', '')} · {p.anzahl_items} Items · {waitMin}′
                        </div>
                        <div className="mt-1 font-display text-xl font-black text-red-900">
                          {euro(p.gesamtbetrag)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Zahlung fehlt → tippen zum Kassieren
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Take-Away */}
        <button
          onClick={onTakeaway}
          className="w-full rounded-3xl bg-gradient-to-br from-amber-100 to-amber-200 p-5 mb-6 text-left hover:shadow-lg transition active:scale-[0.99] border-2 border-transparent hover:border-amber-400"
        >
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gray-900 text-amber-300 grid place-items-center shrink-0">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">Schnelle Abholung</div>
              <div className="font-display text-xl font-black text-matcha-900">Take-Away</div>
              <div className="text-xs text-gray-700 mt-0.5">7 % MwSt · für Theke / Laufkundschaft</div>
            </div>
            <Zap className="h-5 w-5 text-gray-500" />
          </div>
        </button>

        {tables.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed p-10 text-center text-gray-500 bg-white">
            <Grid className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <div className="font-bold text-matcha-900">Noch keine Tische angelegt</div>
            <a href="/pos/tables" className="mt-2 inline-block text-matcha-900 underline text-sm font-semibold">Jetzt Tische anlegen →</a>
          </div>
        ) : (
          <>
            {/* View-Toggle + Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-display text-xl font-bold">Tische</h2>
              <div className="flex gap-2 items-center flex-wrap">
                {bereiche.length > 1 && view === 'list' && (
                  <div className="flex gap-1 flex-wrap">
                    <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Alle</FilterChip>
                    {bereiche.map((b) => (
                      <FilterChip key={b} active={filter === b} onClick={() => setFilter(b)}>{b}</FilterChip>
                    ))}
                  </div>
                )}
                <div className="flex bg-white rounded-lg p-0.5 border">
                  <button
                    onClick={() => setView('floor')}
                    className={cn('px-3 py-1 rounded-md text-xs font-bold', view === 'floor' ? 'bg-matcha-900 text-matcha-50' : '')}
                  >
                    Floor-Plan
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={cn('px-3 py-1 rounded-md text-xs font-bold', view === 'list' ? 'bg-matcha-900 text-matcha-50' : '')}
                  >
                    Liste
                  </button>
                </div>
              </div>
            </div>

            {view === 'floor' ? (
              <FloorPlanView tables={tables} openTables={openTables} onPick={onTable} />
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {filtered.map((t) => (
                  <TableListCard
                    key={t.id}
                    table={t}
                    open={openTables[t.id]}
                    onPick={() => onTable(t)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FloorPlanView({
  tables, openTables, onPick,
}: {
  tables: Table[];
  openTables: OpenTablesMap;
  onPick: (t: Table) => void;
}) {
  // Canvas-Größe an max-coords anpassen
  const maxX = Math.max(800, ...tables.map((t) => (t.pos_x ?? 0) + (t.breite ?? 80) + 40));
  const maxY = Math.max(500, ...tables.map((t) => (t.pos_y ?? 0) + (t.hoehe ?? 80) + 40));

  const hasLayout = tables.some((t) => (t.pos_x ?? 0) !== 0 || (t.pos_y ?? 0) !== 0);

  if (!hasLayout) {
    return (
      <div className="rounded-2xl border-2 border-dashed bg-white p-10 text-center">
        <Grid className="h-10 w-10 mx-auto text-gray-300 mb-2" />
        <div className="font-bold">Tische sind noch nicht platziert</div>
        <p className="text-sm text-gray-500 mt-1 mb-3">Leg ein Layout an, damit du die Tische wie im Restaurant anordnen kannst.</p>
        <a href="/pos/tables/layout" className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold">
          Layout jetzt anlegen →
        </a>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border-2 bg-white overflow-auto" style={{ height: '65vh', minHeight: 500 }}>
      <div
        className="relative"
        style={{
          width: maxX,
          height: maxY,
          backgroundImage: 'linear-gradient(#0000000a 1px, transparent 1px), linear-gradient(90deg, #0000000a 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {tables.map((t) => {
          const w = t.breite ?? 80;
          const h = t.hoehe ?? 80;
          const form = t.form ?? 'rund';
          const open = openTables[t.id];
          const isOccupied = open && open.offene_orders > 0;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className={cn(
                'absolute text-center transition-transform hover:scale-105 active:scale-95 flex items-center justify-center font-display shadow',
                isOccupied ? 'ring-2 ring-amber-400 ring-offset-2' : '',
              )}
              style={{
                left: t.pos_x ?? 0,
                top: t.pos_y ?? 0,
                width: w,
                height: h,
                borderRadius: form === 'rund' ? '50%' : 12,
                background: isOccupied ? '#fef3c7' : 'white',
                border: '3px solid #0d1f16',
              }}
            >
              <div>
                <div className="font-black text-matcha-900" style={{ fontSize: Math.min(w, h) * 0.3 }}>
                  {t.nummer}
                </div>
                {isOccupied && (
                  <div className="text-[9px] font-bold text-amber-900 leading-none mt-0.5">
                    {open.offene_orders} · {euro(open.offene_summe)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TableListCard({
  table, open, onPick,
}: {
  table: Table;
  open?: { offene_orders: number; offene_summe: number };
  onPick: () => void;
}) {
  const isOccupied = open && open.offene_orders > 0;
  return (
    <button
      onClick={onPick}
      className={cn(
        'rounded-2xl border-2 p-4 text-center transition active:scale-95 hover:shadow-lg',
        isOccupied ? 'bg-amber-50 border-amber-300' : 'bg-white border-transparent hover:border-gray-900',
      )}
    >
      <div className="font-display text-3xl font-black text-matcha-900 mb-1">{table.nummer}</div>
      {table.name && <div className="text-xs text-gray-500 truncate">{table.name}</div>}
      {isOccupied ? (
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
          {open!.offene_orders} offen · {euro(open!.offene_summe)}
        </div>
      ) : table.kapazitaet ? (
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 inline-flex items-center gap-1">
          <Users className="h-2.5 w-2.5" /> {table.kapazitaet}
        </div>
      ) : null}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-bold transition',
        active ? 'bg-matcha-900 text-matcha-50' : 'bg-muted hover:bg-muted/70',
      )}
    >
      {children}
    </button>
  );
}

/* ============================================ Payment Modal ============================================ */

function PaymentModal({
  total, submitting, onClose, onPay,
}: {
  total: number;
  submitting: boolean;
  onClose: () => void;
  onPay: (m: 'bar' | 'karte' | 'online') => void;
}) {
  const [given, setGiven] = useState('');
  const givenNum = parseFloat(given.replace(',', '.'));
  const change = !isNaN(givenNum) ? givenNum - total : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6">
        <header className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl font-black">Zahlung</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="text-center mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gesamtbetrag</div>
          <div className="font-display text-5xl font-black text-matcha-900 mt-1">{euro(total)}</div>
        </div>

        {/* Bar: mit Rückgeld */}
        <div className="mb-3 p-4 rounded-2xl border-2 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Bar · gegeben</div>
          <input
            type="text"
            inputMode="decimal"
            value={given}
            onChange={(e) => setGiven(e.target.value)}
            placeholder="0,00"
            className="w-full h-14 rounded-xl border-2 bg-white px-4 font-display text-2xl font-black text-center"
          />
          {given && !isNaN(givenNum) && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Rückgeld</span>
              <span className={cn('font-display font-black', change < 0 ? 'text-red-600' : 'text-matcha-700')}>
                {euro(Math.max(0, change))}
              </span>
            </div>
          )}
          <button
            onClick={() => onPay('bar')}
            disabled={submitting || (given !== '' && (!isNaN(givenNum) && givenNum < total))}
            className="mt-3 w-full h-12 rounded-xl bg-matcha-900 text-matcha-50 font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Bar kassieren
          </button>
        </div>

        {/* Karte */}
        <button
          onClick={() => onPay('karte')}
          disabled={submitting}
          className="mb-2 w-full h-14 rounded-2xl border-2 border-matcha-900 text-matcha-900 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-matcha-50"
        >
          <CreditCard className="h-5 w-5" /> Karte (EC · Kreditkarte)
        </button>

        {/* Digital */}
        <button
          onClick={() => onPay('online')}
          disabled={submitting}
          className="w-full h-14 rounded-2xl bg-black text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Smartphone className="h-5 w-5" /> Apple/Google Pay
        </button>
      </div>
    </div>
  );
}

/* ============================================ LongPressTile ============================================ */

function LongPressTile({
  children, onClick, onLongPress, className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onLongPress: () => void;
  className?: string;
}) {
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [longPressed, setLongPressed] = useState(false);

  const start = () => {
    setLongPressed(false);
    const t = setTimeout(() => {
      setLongPressed(true);
      onLongPress();
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 600);
    setTimer(t);
  };

  const cancel = () => {
    if (timer) { clearTimeout(timer); setTimer(null); }
  };

  return (
    <button
      className={className}
      onClick={() => { if (!longPressed) onClick(); }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
    >
      {children}
    </button>
  );
}
