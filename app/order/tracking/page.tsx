import { SmartDeliveryLiveEta } from '@/app/order/[locationSlug]/smart-delivery-live-eta';
import { SmartLiveTrackingExtended } from '@/app/order/[locationSlug]/smart-live-tracking-extended';
import { Phase2720DynamischeEtaLiveTrackingCockpit } from '@/app/order/[locationSlug]/phase2720-dynamische-eta-live-tracking-cockpit';
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

        {/* Phase 2720: Dynamische ETA Live-Tracking Cockpit — ETA-Ring; Phasen-Timeline 5 Stufen; Fortschrittsbalken; Fahrer-Info; Lieferung-geliefert-Konfirmation; 20-Sek-Polling; Mock-Fallback */}
        <Phase2720DynamischeEtaLiveTrackingCockpit orderId={orderId} />

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
