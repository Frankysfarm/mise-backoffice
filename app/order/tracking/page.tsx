import { SmartDeliveryLiveEta } from '@/app/order/[locationSlug]/smart-delivery-live-eta';
import { SmartLiveTrackingExtended } from '@/app/order/[locationSlug]/smart-live-tracking-extended';
import { Phase2720DynamischeEtaLiveTrackingCockpit } from '@/app/order/[locationSlug]/phase2720-dynamische-eta-live-tracking-cockpit';
import { Phase4000EtaLiveTracker } from '@/app/order/[locationSlug]/phase4000-eta-live-tracker';
import { Phase4150DynamischeEtaLiveTracking } from '@/app/order/[locationSlug]/phase4150-dynamische-eta-live-tracking';
import { Phase4155DynamischeEtaLiveCockpitUltra } from '@/app/order/[locationSlug]/phase4155-dynamische-eta-live-cockpit-ultra';
import { Phase4201LiefervertrauenStatusKarte } from '@/app/order/[locationSlug]/phase4201-liefervertrauen-status-karte';
import { Phase4210DynamischeEtaLiveTrackingBoard } from '@/app/order/[locationSlug]/phase4210-dynamische-eta-live-tracking-board';
import { Phase4470DynamischeEtaLiveTrackingV5 } from '@/app/order/[locationSlug]/phase4470-dynamische-eta-live-tracking-v5';
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

        {/* Phase 4000: ETA Live Tracker — Dynamische ETA-Anzeige mit Phasen-Timeline, Fahrer-Info, Telefon-Schnellwahl; 20-Sek-Polling; Mock-Fallback */}
        <Phase4000EtaLiveTracker orderId={orderId} />

        {/* Phase 4150: Dynamische ETA Live-Tracking — ETA-Ring mit Bereichsschätzung; 5-Stufen Phasen-Timeline; Fahrer-Info; GPS-Echtzeit; 20-Sek-Polling; Mock-Fallback */}
        <Phase4150DynamischeEtaLiveTracking orderId={orderId} />

        {/* Phase 4155: Dynamische ETA Live-Cockpit Ultra — SVG-Ring animiert; ETA-Bereich low/high; Fahrer-Name + Distanz; Telefon-Link; 5-Stufen Timeline animated; 20-Sek-Polling; Mock-Fallback */}
        <Phase4155DynamischeEtaLiveCockpitUltra orderId={orderId} />

        {/* Phase 4201: Liefervertrauen Status-Karte — Shield Konfidenz-Badge; 3-KPI Pünktlichkeit/Bewertung/Ø-Lieferzeit; 3-stufig grün/gelb/rot; 5-Min-Polling; Mock-Fallback */}
        <Phase4201LiefervertrauenStatusKarte orderId={orderId} />

        {/* Phase 4210: Dynamische ETA Live-Tracking Board — 5-Stufen Phasen-Timeline; ETA-Bereich low/high Balken; Fahrer-Info; Phasen-Fortschrittsbalken; 20-Sek-Polling; Mock-Fallback */}
        <Phase4210DynamischeEtaLiveTrackingBoard orderId={orderId} />

        {/* Phase 4470: Dynamische ETA Live-Tracking V5 — SVG-ETA-Ring mit Konfidenz-Prozent; 5-Stufen Phasen-Timeline mit ETA je Phase; Fahrer-Name + Distanz; Geliefert-State mit Bewertungs-Prompt; 1-Sek-Tick + 20-Sek-Polling; Mock-Fallback */}
        <Phase4470DynamischeEtaLiveTrackingV5 orderId={orderId} />

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
