import { notFound } from "next/navigation"
import { StationDisplay } from "@/app/kitchen/display/[token]/client"
import { assertTestLabEnvironment } from "@/tests/driver-system-lab/support/environment"

export const dynamic = "force-dynamic"

export default function TestLabKitchenActorPage() {
  try {
    assertTestLabEnvironment()
  } catch {
    notFound()
  }
  return <StationDisplay
    station={{ id: "testlab-station-hot", name: "Testküche Warm", icon: "🍳", farbe: "#14532d", sound_enabled: false }}
    initialItems={[{
      id: "testlab-kitchen-item-1", order_id: "testlab-kitchen-order-1", name: "Test Bowl", menge: 1,
      notiz: "ohne Zwiebeln", station_status: "offen", extras: [],
      order: {
        id: "testlab-kitchen-order-1", bestellnummer: "TL-K-1001", status: "bestaetigt", typ: "lieferung",
        bestellt_am: "2026-08-02T10:00:00.000Z", kunde_name: "Testkunde Eins", tisch_id: null, gedeckt_personen: null,
      },
    }]}
    initialTableMap={{}}
  />
}
