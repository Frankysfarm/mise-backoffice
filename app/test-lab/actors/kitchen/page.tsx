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
    station={{ id: "40000000-0000-4000-8000-000000000001", name: "Testküche Warm", icon: "🍳", farbe: "#14532d", sound_enabled: false }}
    displayToken="testlab-kitchen-token"
    initialItems={[{
      id: "60000000-0000-4000-8000-000000000001", order_id: "70000000-0000-4000-8000-000000000001", name: "Test Bowl", menge: 1,
      notiz: "ohne Zwiebeln", station_status: "offen", extras: [],
      order: {
        id: "70000000-0000-4000-8000-000000000001", bestellnummer: "TL-K-1001", status: "bestaetigt", typ: "lieferung",
        bestellt_am: "2026-08-02T10:00:00.000Z", kunde_name: "Testkunde Eins", tisch_id: null, gedeckt_personen: null,
      },
    }]}
    initialTableMap={{}}
  />
}
