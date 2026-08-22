'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import {
  Trash2, Minus, Plus, CreditCard, Banknote, Smartphone, Printer, X,
  Package, Coins, History, FileText, Link2,
} from 'lucide-react';
import { PickupPanel, type PickupOrder } from './components/pickup-panel';
import { CashMovementModal } from './components/cash-movement-modal';
import { ReceiptHistory } from './components/receipt-history';
import { BonVoucherQR } from './components/bon-voucher-qr';
import { bruttoToNetto, mwstBetrag } from '@/lib/pos/helpers';

type Register = { id: string; name: string; location_id: string };
type Category = { id: string; name: string; icon: string | null };
type MenuItem = { id: string; name: string; preis: number; category_id: string | null; beschreibung: string | null; allergene: string[] | null; beliebt: boolean };
type TaxRate = { id: string; satz: number };
type CartLine = { item: MenuItem; qty: number; mwst_satz: number; _isFromOrder?: boolean };

export function POSTerminal({ registers, categories, items, taxRates }: {
  registers: Register[]; categories: Category[]; items: MenuItem[]; taxRates: TaxRate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? '');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [gegeben, setGegeben] = useState('');
  const [payMethod, setPayMethod] = useState<'bar' | 'karte' | 'digital'>('bar');
  const [lastBon, setLastBon] = useState<any>(null);

  // Neue Panels/Modals
  const [pickupOpen, setPickupOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<{ id: string; bestellnummer: string } | null>(null);

  // Pickup-Badge: Anzahl fertiger Orders
  const [pendingPickups, setPendingPickups] = useState(0);
  const register = registers.find((r) => r.id === registerId);

  useEffect(() => {
    if (!register?.location_id) return;
    const sb = createClient();
    async function refresh() {
      const { count } = await sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'fertig')
        .eq('location_id', register!.location_id);
      setPendingPickups(count ?? 0);
    }
    void refresh();
    const ch = sb
      .channel('pos_pickup_count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders' },
        () => void refresh(),
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [register?.location_id]);

  function addItem(item: MenuItem) {
    const isFood = !!(item.allergene?.length); // Heuristik: wenn Allergene → Food → 7%
    const mwst = isFood ? 7 : 19;
    setCart(c => {
      const existing = c.find(l => l.item.id === item.id);
      if (existing) return c.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
      return [...c, { item, qty: 1, mwst_satz: mwst }];
    });
  }

  function removeItem(itemId: string) {
    setCart(c => c.map(l => l.item.id === itemId ? { ...l, qty: l.qty - 1 } : l).filter(l => l.qty > 0));
  }

  function clearCart() { setCart([]); setLinkedOrder(null); }

  function loadOrderIntoCart(order: PickupOrder) {
    // Wenn schon bezahlt → nur Info, nicht erneut kassieren
    if (order.bezahlt) {
      toastError(
        `${order.bestellnummer} ist bereits bezahlt`,
        'Diese Bestellung wurde online bezahlt und muss nicht über die Kasse gehen.',
      );
      return;
    }
    const newCart: CartLine[] = order.items.map((oi) => {
      const menu = items.find((m) => m.id === oi.menu_item_id);
      const fallback: MenuItem = menu ?? {
        id: oi.menu_item_id ?? `custom-${oi.id}`,
        name: oi.name,
        preis: Number(oi.einzelpreis),
        category_id: null,
        beschreibung: null,
        allergene: null,
        beliebt: false,
      };
      const isFood = !!(fallback.allergene?.length);
      return {
        item: { ...fallback, preis: Number(oi.einzelpreis) },
        qty: oi.menge,
        mwst_satz: isFood ? 7 : 19,
        _isFromOrder: true,
      };
    });
    setCart(newCart);
    setLinkedOrder({ id: order.id, bestellnummer: order.bestellnummer });
    setPayMethod(order.zahlungsart === 'karte' ? 'karte' : 'bar');
    setPickupOpen(false);
    setPaymentOpen(true);
  }

  const bruttoGesamt = cart.reduce((s, l) => s + l.item.preis * l.qty, 0);
  const mwst7 = cart.filter(l => l.mwst_satz === 7).reduce((s, l) => s + mwstBetrag(l.item.preis * l.qty, 7), 0);
  const mwst19 = cart.filter(l => l.mwst_satz === 19).reduce((s, l) => s + mwstBetrag(l.item.preis * l.qty, 19), 0);
  const nettoGesamt = bruttoGesamt - mwst7 - mwst19;
  const gegebenNum = parseFloat(gegeben) || 0;
  const rueckgeld = Math.max(0, gegebenNum - bruttoGesamt);

  const filteredItems = activeCat ? items.filter(i => i.category_id === activeCat) : items;
  const popularItems = items.filter(i => i.beliebt);

  async function completeSale() {
    if (cart.length === 0) return;
    if (!registerId) return toastError('Keine Kasse ausgewählt');

    start(async () => {
      const sb = createClient();

      const bonData = {
        positionen: cart.map(l => ({
          name: l.item.name, menge: l.qty,
          einzelpreis: l.item.preis, mwst_satz: l.mwst_satz,
          gesamt: l.item.preis * l.qty,
        })),
        mwst: { '7%': mwst7.toFixed(2), '19%': mwst19.toFixed(2) },
        netto: nettoGesamt.toFixed(2), brutto: bruttoGesamt.toFixed(2),
        zahlungsart: payMethod, gegeben: gegebenNum.toFixed(2), rueckgeld: rueckgeld.toFixed(2),
      };

      // Transaktion erstellen
      const { data: trans, error } = await sb.from('pos_transactions').insert({
        register_id: registerId,
        typ: 'verkauf',
        netto_gesamt: +nettoGesamt.toFixed(2),
        mwst_7: +mwst7.toFixed(2),
        mwst_19: +mwst19.toFixed(2),
        brutto_gesamt: +bruttoGesamt.toFixed(2),
        zahlungsart: payMethod,
        gegeben: payMethod === 'bar' ? gegebenNum : null,
        rueckgeld: payMethod === 'bar' ? +rueckgeld.toFixed(2) : null,
        bon_data: bonData,
        order_id: linkedOrder?.id ?? null,
      } as any).select('id,bon_nummer,bon_data').single();

      if (error) return toastError('Kassierung fehlgeschlagen', error.message);
      // Der Trigger schreibt bei ≥10€ einen voucher_code in bon_data — lesen wir zurück
      const voucherCode = (trans as any)?.bon_data?.voucher_code ?? null;

      // Positionen
      await sb.from('pos_transaction_items').insert(cart.map(l => ({
        transaction_id: trans.id,
        menu_item_id: l.item.id,
        name: l.item.name,
        menge: l.qty,
        einzelpreis_netto: +bruttoToNetto(l.item.preis, l.mwst_satz).toFixed(2),
        einzelpreis_brutto: l.item.preis,
        mwst_satz: l.mwst_satz,
        mwst_betrag: +mwstBetrag(l.item.preis * l.qty, l.mwst_satz).toFixed(2),
        gesamt_brutto: +(l.item.preis * l.qty).toFixed(2),
      })) as any);

      // Wenn mit Order verknüpft: Order auf 'abgeholt' setzen und bezahlt markieren
      if (linkedOrder) {
        await sb
          .from('customer_orders')
          .update({
            status: 'abgeholt',
            abgeholt_am: new Date().toISOString(),
            bezahlt: true,
          })
          .eq('id', linkedOrder.id);
      }

      setLastBon({
        ...bonData,
        bon_nummer: trans.bon_nummer,
        datum: new Date().toLocaleString('de-DE'),
        orderRef: linkedOrder?.bestellnummer,
        voucher_code: voucherCode,
      });
      setCart([]);
      setLinkedOrder(null);
      setPaymentOpen(false);
      setGegeben('');
      toastSuccess(`Bon ${trans.bon_nummer}`, `${bruttoGesamt.toFixed(2)} € · ${payMethod}`);
    });
  }

  return (
    <div className="fixed inset-0 flex bg-[#0d1f16]">
      {/* ========== LINKE SEITE: Produktraster ========== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1a3a2a] px-4 py-3 gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-2xl">🍵</span>
            <span className="text-white font-bold">mise POS</span>
          </div>

          <div className="flex items-center gap-1.5">
            <ToolBtn
              icon={<Package size={16} />}
              label="Abholung"
              badge={pendingPickups}
              onClick={() => setPickupOpen(true)}
              highlight={pendingPickups > 0}
            />
            <ToolBtn icon={<Coins size={16} />} label="Kasse" onClick={() => setMovementOpen(true)} />
            <ToolBtn icon={<History size={16} />} label="Bons" onClick={() => setHistoryOpen(true)} />
            <ToolBtn icon={<FileText size={16} />} label="Z-Bericht" onClick={() => router.push('/pos/z-report')} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select value={registerId} onChange={e => setRegisterId(e.target.value)}
              className="bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm border-0">
              {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white p-2" aria-label="Schließen">
              <X size={20} />
            </button>
          </div>
        </div>

        {linkedOrder && (
          <div className="bg-[#4ae68a]/10 border-b border-[#4ae68a]/30 px-4 py-2 flex items-center gap-2 text-[#4ae68a] text-sm">
            <Link2 size={14} />
            <span>Verknüpft mit Online-Bestellung</span>
            <span className="font-mono font-bold">#{linkedOrder.bestellnummer.replace('FF-', '')}</span>
            <button onClick={() => { setLinkedOrder(null); setCart([]); }} className="ml-auto text-[#4ae68a]/60 hover:text-[#4ae68a]">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Kategorien */}
        <div className="flex gap-2 px-4 py-3 bg-[#122920] overflow-x-auto">
          <CatBtn active={!activeCat} onClick={() => setActiveCat(null)} label="⭐ Beliebt" />
          <CatBtn active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="Alle" />
          {categories.map(c => (
            <CatBtn key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={`${c.icon ?? ''} ${c.name}`} />
          ))}
        </div>

        {/* Produkt-Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {(activeCat ? filteredItems : popularItems.length > 0 ? popularItems : items).map(item => {
              const inCart = cart.find(l => l.item.id === item.id);
              return (
                <button key={item.id} onClick={() => addItem(item)}
                  className={cn(
                    'relative rounded-2xl p-4 text-left transition active:scale-95',
                    'bg-white/5 hover:bg-white/10 border border-white/10',
                    inCart && 'ring-2 ring-[#4ae68a]',
                  )}>
                  <div className="text-white font-semibold text-sm leading-tight">{item.name}</div>
                  <div className="mt-2 text-[#4ae68a] font-bold text-xl">{item.preis.toFixed(2)} €</div>
                  {inCart && (
                    <div className="absolute -top-2 -right-2 bg-[#4ae68a] text-[#0d1f16] w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                      {inCart.qty}
                    </div>
                  )}
                  {item.beliebt && <div className="absolute top-2 right-2 text-xs">⭐</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========== RECHTE SEITE: Warenkorb ========== */}
      <div className="w-[380px] bg-[#1a3a2a] flex flex-col border-l border-white/10">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-white font-bold">Warenkorb</span>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-white/40 hover:text-white text-xs flex items-center gap-1">
              <Trash2 size={14} /> Leeren
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">Tippe auf ein Produkt</div>
          ) : (
            <div className="space-y-2">
              {cart.map(l => (
                <div key={l.item.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-3">
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{l.item.name}</div>
                    <div className="text-white/50 text-xs">{l.item.preis.toFixed(2)} € · {l.mwst_satz}% MwSt</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => removeItem(l.item.id)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Minus size={14} className="text-white" /></button>
                    <span className="text-white font-bold w-6 text-center">{l.qty}</span>
                    <button onClick={() => addItem(l.item)} className="w-8 h-8 rounded-full bg-[#4ae68a] flex items-center justify-center"><Plus size={14} className="text-[#0d1f16]" /></button>
                  </div>
                  <div className="text-white font-bold text-sm w-16 text-right">{(l.item.preis * l.qty).toFixed(2)} €</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summen + Bezahlen */}
        {cart.length > 0 && (
          <div className="px-4 py-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between text-white/60 text-xs">
              <span>Netto</span><span>{nettoGesamt.toFixed(2)} €</span>
            </div>
            {mwst7 > 0 && <div className="flex justify-between text-white/60 text-xs"><span>MwSt 7%</span><span>{mwst7.toFixed(2)} €</span></div>}
            {mwst19 > 0 && <div className="flex justify-between text-white/60 text-xs"><span>MwSt 19%</span><span>{mwst19.toFixed(2)} €</span></div>}
            <div className="flex justify-between text-white font-bold text-2xl pt-1 border-t border-white/10">
              <span>Gesamt</span><span>{bruttoGesamt.toFixed(2)} €</span>
            </div>

            {!paymentOpen ? (
              <button onClick={() => setPaymentOpen(true)}
                className="w-full bg-[#4ae68a] hover:bg-[#3dd67a] text-[#0d1f16] py-4 rounded-2xl font-bold text-lg transition active:scale-[0.98]">
                Kassieren
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2">
                  <PayBtn active={payMethod === 'bar'} onClick={() => setPayMethod('bar')} icon={<Banknote size={20} />} label="Bar" />
                  <PayBtn active={payMethod === 'karte'} onClick={() => setPayMethod('karte')} icon={<CreditCard size={20} />} label="Karte" />
                  <PayBtn active={payMethod === 'digital'} onClick={() => setPayMethod('digital')} icon={<Smartphone size={20} />} label="Digital" />
                </div>

                {payMethod === 'bar' && (
                  <div>
                    <div className="text-white/60 text-xs mb-1">Gegeben</div>
                    <div className="flex gap-2">
                      <input value={gegeben} onChange={e => setGegeben(e.target.value)} type="number" step="0.01"
                        className="flex-1 bg-white/10 text-white text-xl font-bold rounded-xl px-4 py-3 text-center border-0 focus:ring-2 focus:ring-[#4ae68a]"
                        placeholder={bruttoGesamt.toFixed(2)} autoFocus />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[5, 10, 20, 50].map(v => (
                        <button key={v} onClick={() => setGegeben(String(v))}
                          className="flex-1 bg-white/10 text-white rounded-lg py-2 text-sm font-bold hover:bg-white/20">{v} €</button>
                      ))}
                    </div>
                    {gegebenNum >= bruttoGesamt && gegebenNum > 0 && (
                      <div className="mt-2 text-center text-[#4ae68a] text-xl font-bold">
                        Rückgeld: {rueckgeld.toFixed(2)} €
                      </div>
                    )}
                  </div>
                )}

                <button onClick={completeSale} disabled={pending || (payMethod === 'bar' && gegebenNum < bruttoGesamt)}
                  className="w-full bg-[#4ae68a] hover:bg-[#3dd67a] disabled:opacity-40 text-[#0d1f16] py-4 rounded-2xl font-bold text-lg transition flex items-center justify-center gap-2">
                  <Printer size={20} />
                  {pending ? 'Drucke...' : 'Bon drucken & Abschließen'}
                </button>
                <button onClick={() => setPaymentOpen(false)} className="w-full text-white/40 text-sm py-2">Abbrechen</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== PANELS & MODALS ========== */}
      <PickupPanel
        locationId={register?.location_id ?? null}
        open={pickupOpen}
        onClose={() => setPickupOpen(false)}
        onLoad={loadOrderIntoCart}
      />
      <CashMovementModal
        open={movementOpen}
        registerId={registerId}
        onClose={() => setMovementOpen(false)}
      />
      <ReceiptHistory
        open={historyOpen}
        registerId={registerId}
        onClose={() => setHistoryOpen(false)}
      />

      {/* ========== BON-VORSCHAU (nach Verkauf) ========== */}
      {lastBon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setLastBon(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl font-mono text-sm" onClick={e => e.stopPropagation()}>
            <div className="text-center border-b pb-4 mb-4">
              <div className="text-2xl">🍵</div>
              <div className="font-bold text-lg">Franky's Farm</div>
              <div className="text-xs text-gray-500">Matcha Kaffee Berlin Mitte</div>
              <div className="text-xs text-gray-500">Torstraße 112, 10119 Berlin</div>
              <div className="text-xs text-gray-500">St.-Nr.: DE123456789</div>
            </div>
            <div className="text-xs text-gray-500 mb-2">{lastBon.datum}</div>
            <div className="font-bold mb-1">Bon: {lastBon.bon_nummer}</div>
            <div className="border-t border-dashed pt-2 space-y-1">
              {lastBon.positionen.map((p: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{p.menge}x {p.name}</span>
                  <span>{p.gesamt.toFixed(2)} €</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed mt-2 pt-2 space-y-0.5">
              <div className="flex justify-between text-xs"><span>Netto</span><span>{lastBon.netto} €</span></div>
              <div className="flex justify-between text-xs"><span>MwSt 7%</span><span>{lastBon.mwst['7%']} €</span></div>
              <div className="flex justify-between text-xs"><span>MwSt 19%</span><span>{lastBon.mwst['19%']} €</span></div>
              <div className="flex justify-between font-bold text-lg border-t border-double mt-1 pt-1">
                <span>GESAMT</span><span>{lastBon.brutto} €</span>
              </div>
            </div>
            <div className="border-t border-dashed mt-2 pt-2 text-xs">
              <div>Zahlungsart: {lastBon.zahlungsart.toUpperCase()}</div>
              {lastBon.zahlungsart === 'bar' && (
                <>
                  <div>Gegeben: {lastBon.gegeben} €</div>
                  <div>Rückgeld: {lastBon.rueckgeld} €</div>
                </>
              )}
            </div>
            {lastBon.voucher_code && <BonVoucherQR code={lastBon.voucher_code} />}
            <div className="border-t border-dashed mt-2 pt-2 text-center text-xs text-gray-400">
              <div>TSE: Nicht konfiguriert</div>
              <div>Powered by mise</div>
              <div className="mt-2">Vielen Dank für Ihren Besuch!</div>
            </div>
            <button onClick={() => setLastBon(null)}
              className="mt-4 w-full bg-[#1a3a2a] text-white py-3 rounded-xl font-bold">
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  icon, label, onClick, badge, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
        highlight
          ? 'bg-[#4ae68a] text-[#0d1f16] hover:bg-[#3dd67a]'
          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge != null && badge > 0 && (
        <span className={cn(
          'ml-0.5 rounded-full px-1.5 text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center',
          highlight ? 'bg-[#0d1f16] text-[#4ae68a]' : 'bg-[#4ae68a] text-[#0d1f16]',
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function CatBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cn(
      'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
      active ? 'bg-[#4ae68a] text-[#0d1f16]' : 'bg-white/10 text-white/70 hover:bg-white/20',
    )}>{label}</button>
  );
}

function PayBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cn(
      'flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-semibold transition',
      active ? 'bg-[#4ae68a] text-[#0d1f16]' : 'bg-white/10 text-white/70',
    )}>
      {icon}
      {label}
    </button>
  );
}
