import { SmartDeliveryLiveEta } from '@/app/order/[locationSlug]/smart-delivery-live-eta';
import { SmartLiveTrackingExtended } from '@/app/order/[locationSlug]/smart-live-tracking-extended';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Live-Tracking · mise',
  description: 'Verfolge deine Lieferung in Echtzeit.',
};

export default function TrackingPage({
  searchParams,
}: {
  searchParams: { order_id?: string };
}) {
  const orderId = searchParams.order_id ?? null;

  return (
    <div className="min-h-screen bg-[#F8F6F3] flex flex-col items-center justify-start pt-8 px-4 pb-12">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-2xl font-black text-stone-900">mise</span>
          <p className="text-sm text-stone-500 mt-0.5">Deine Lieferung im Blick</p>
        </div>

        {/* Extended Live Tracking (Hauptansicht) */}
        <SmartLiveTrackingExtended orderId={orderId} />

        {/* ETA-Karte (kompakt, als Ergänzung) */}
        <SmartDeliveryLiveEta orderId={orderId} />

        {/* Help Text */}
        {!orderId && (
          <div className="mt-4 text-center text-xs text-stone-400">
            Füge <code className="bg-stone-100 px-1 rounded">?order_id=DEINE_ID</code> zur URL hinzu<br />
            um deine spezifische Bestellung zu verfolgen.
          </div>
        )}
      </div>
    </div>
  );
}
