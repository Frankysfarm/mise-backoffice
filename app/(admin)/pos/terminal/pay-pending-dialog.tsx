'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Banknote, Check, CreditCard, Loader2, Smartphone, Wifi, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { buildSumUpDeepLink } from '@/lib/sumup-deeplink';
import { isNativePOS, printReceiptIfNative } from '@/lib/mise-pos-native';
import { SumUpSetupDialog } from './sumup-setup-dialog';

type OrderItem = {
  name: string; menge: number; einzelpreis: number; gesamtpreis: number;
};
type Order = {
  id: string; bestellnummer: string; gesamtbetrag: number; tisch_id: string | null;
  zwischensumme: number; liefergebuehr: number | null; trinkgeld: number | null;
  bestellt_am: string | null;
  items: OrderItem[];
  tisch?: { nummer: string };
};

type TenantInfo = {
  sumup_affiliate_key: string | null;
  name: string | null;
  ustid: string | null;
};

type LocationInfo = { name: string | null; adresse: string | null; plz: string | null; stadt: string | null };

type PayMode = 'idle' | 'sumup-launching' | 'sumup-waiting';

export function PayPendingDialog({
  orderId, registerId, shiftId, onClose, onPaid,
}: {
  orderId: string;
  registerId: string | null;
  shiftId: string | null;
  onClose: () => void;
  onPaid: (bonToken: string | null, orderNumber: string, method: string) => void;
}) {
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [affiliateKey, setAffiliateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>('idle');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: emp } = await supabase
        .from('employees')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      const tId = (emp as { tenant_id?: string } | null)?.tenant_id ?? null;
      setTenantId(tId);

      const [orderRes, tenantRes] = await Promise.all([
        supabase.from('customer_orders')
          .select('id, bestellnummer, gesamtbetrag, tisch_id, zwischensumme, liefergebuehr, trinkgeld, bestellt_am, location_id, items:order_items(name, menge, einzelpreis, gesamtpreis), tisch:restaurant_tables(nummer)')
          .eq('id', orderId).maybeSingle(),
        tId
          ? supabase.from('tenants').select('sumup_affiliate_key, name, ustid').eq('id', tId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const orderRow = orderRes.data as (Order & { location_id?: string }) | null;
      setOrder(orderRow);
      const tInfo = tenantRes.data as TenantInfo | null;
      setTenantInfo(tInfo);
      setAffiliateKey(tInfo?.sumup_affiliate_key ?? null);

      if (orderRow?.location_id) {
        const { data: loc } = await supabase
          .from('locations')
          .select('name, adresse, plz, stadt')
          .eq('id', orderRow.location_id)
          .maybeSingle();
        setLocationInfo(loc as LocationInfo | null);
      }
      setLoading(false);
    })();
  }, [orderId]); // eslint-disable-line

  async function pay(method: 'bar' | 'karte' | 'online') {
    setPaying(true);
    setErr(null);
    try {
      const { data } = await supabase.rpc('pay_pending_order', {
        p_order_id: orderId,
        p_zahlungsart: method,
        p_register_id: registerId,
        p_shift_id: shiftId,
      });
      const result = data as { ok?: boolean; bon_token?: string | null; error?: string } | null;
      if (result?.ok) {
        if (isNativePOS() && order && tenantInfo) {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mise-gastro.de';
          const addrParts = [
            locationInfo?.name,
            locationInfo?.adresse,
            [locationInfo?.plz, locationInfo?.stadt].filter(Boolean).join(' '),
          ].filter(Boolean) as string[];
          await printReceiptIfNative({
            restaurantName: tenantInfo.name ?? 'Mise',
            restaurantAddress: addrParts.length ? addrParts.join(' · ') : undefined,
            restaurantTaxId: tenantInfo.ustid ?? undefined,
            orderNumber: order.bestellnummer,
            tableNumber: order.tisch?.nummer ?? null,
            bestelltAm: order.bestellt_am ? new Date(order.bestellt_am) : new Date(),
            items: order.items.map((it) => ({
              qty: it.menge,
              name: it.name,
              unitPrice: Number(it.einzelpreis),
              total: Number(it.gesamtpreis),
            })),
            subtotal: Number(order.zwischensumme ?? order.gesamtbetrag),
            tip: order.trinkgeld ? Number(order.trinkgeld) : undefined,
            deliveryFee: order.liefergebuehr ? Number(order.liefergebuehr) : undefined,
            total: Number(order.gesamtbetrag),
            paymentMethod: method,
            bonToken: result.bon_token ?? undefined,
            qrUrl: result.bon_token ? `${origin}/bon/${result.bon_token}` : undefined,
            paperWidthMm: 80,
            openCashDrawer: method === 'bar',
          });
        }
        onPaid(result.bon_token ?? null, order?.bestellnummer ?? '', method);
      } else {
        setErr(result?.error ?? 'Fehler');
      }
    } finally {
      setPaying(false);
    }
  }

  function payCardWithSumUp(keyOverride?: string) {
    const key = keyOverride ?? affiliateKey;
    if (!key) {
      setSetupOpen(true);
      return;
    }
    if (!order) return;

    setPayMode('sumup-launching');
    const callback = new URL('/api/pos/sumup/callback', window.location.origin);
    callback.searchParams.set('order', order.id);
    if (registerId) callback.searchParams.set('register', registerId);
    if (shiftId) callback.searchParams.set('shift', shiftId);

    const link = buildSumUpDeepLink({
      affiliateKey: key,
      amount: Number(order.gesamtbetrag),
      currency: 'EUR',
      title: `Bestellung #${order.bestellnummer}`,
      callbackUrl: callback.toString(),
    });

    window.location.href = link;
    setTimeout(() => setPayMode('sumup-waiting'), 800);
  }

  if (payMode === 'sumup-waiting' || payMode === 'sumup-launching') {
    return (
      <div className="fixed inset-0 z-[55] bg-black/85 grid items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-100 text-blue-700 grid place-items-center mx-auto">
            <Wifi className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl font-black">SumUp läuft…</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Bezahle <strong>{order ? euro(Number(order.gesamtbetrag)) : ''}</strong> mit dem Karten-Reader.
            Nach Abschluss kommt die SumUp-App automatisch hierher zurück.
          </p>
          <p className="text-[11px] text-gray-500">
            Klappt der Rückweg nicht? Wechsel manuell zurück und tippe auf <strong>Karte durch</strong>.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setPayMode('idle')}
              className="py-3 rounded-xl border border-gray-300 font-bold flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </button>
            <button
              onClick={() => pay('karte')}
              disabled={paying}
              className="py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Karte durch
            </button>
          </div>
          {err && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[55] bg-black/80 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full">
        <header className="p-5 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white grid place-items-center font-display font-black">
            {order?.tisch?.nummer ?? '?'}
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Offene Tischbestellung</div>
            <h2 className="font-display text-xl font-black">
              {order?.tisch ? `Tisch ${order.tisch.nummer}` : 'Bestellung'}
            </h2>
            <div className="text-xs text-muted-foreground">
              {order && <>#{order.bestellnummer.replace('FF-', '')}</>}
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5">
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : order ? (
            <>
              {/* Items */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-64 overflow-y-auto">
                {order.items?.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{it.menge}× {it.name}</span>
                    <span className="font-bold">{euro(Number(it.gesamtpreis))}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-baseline mb-4">
                <span className="font-bold">Zu zahlen</span>
                <span className="font-display text-3xl font-black">{euro(Number(order.gesamtbetrag))}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <PayTile
                  icon={Banknote}
                  label="Bar"
                  desc="Bargeld"
                  accent="from-emerald-600 to-emerald-800"
                  onClick={() => pay('bar')}
                  loading={paying}
                />
                <PayTile
                  icon={CreditCard}
                  label="Karte"
                  desc={affiliateKey ? 'SumUp ✓' : 'Verbinden'}
                  accent="from-blue-600 to-blue-800"
                  onClick={() => payCardWithSumUp()}
                  loading={paying}
                />
                <PayTile
                  icon={Smartphone}
                  label="Mobile"
                  desc="Apple / Google Pay"
                  accent="from-zinc-800 to-black"
                  onClick={() => pay('online')}
                  loading={paying}
                />
              </div>

              {err && <div className="mt-3 text-sm text-red-700 bg-red-50 rounded-lg p-2 text-center">{err}</div>}

              <div className="mt-3 text-[10px] text-gray-500 text-center">
                Nach Zahlung geht die Bestellung automatisch in die Küche (Station-Routing wird ausgeführt).
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-red-700">Bestellung nicht gefunden</div>
          )}
        </div>
      </div>

      {setupOpen && tenantId && (
        <SumUpSetupDialog
          tenantId={tenantId}
          onClose={() => setSetupOpen(false)}
          onConnected={(key) => {
            setAffiliateKey(key);
            setSetupOpen(false);
            payCardWithSumUp(key);
          }}
        />
      )}
    </div>
  );
}

function PayTile({
  icon: Icon, label, desc, accent, onClick, loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  accent: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'group relative aspect-square rounded-2xl text-white font-bold flex flex-col items-center justify-center gap-2',
        'bg-gradient-to-br shadow-lg transition-all',
        'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        accent,
      )}
    >
      {loading ? (
        <Loader2 className="h-7 w-7 animate-spin" />
      ) : (
        <Icon className="h-7 w-7 transition-transform group-hover:scale-110" />
      )}
      <div className="font-display text-lg leading-none">{label}</div>
      <div className="text-[10px] opacity-80 uppercase tracking-wider">{desc}</div>
    </button>
  );
}
