import { notFound } from "next/navigation"
import { FahrerApp } from "@/app/fahrer/app/client"
import { assertTestLabEnvironment } from "@/tests/driver-system-lab/support/environment"

export const dynamic = "force-dynamic"

export default function TestLabDriverActorPage() {
  try { assertTestLabEnvironment() } catch { notFound() }
  return <FahrerApp
    driver={{
      id: "a1000000-0000-4000-8000-000000000001", vorname: "Test", nachname: "Fahrer",
      tenant_id: "a2000000-0000-4000-8000-000000000001", location_id: "a3000000-0000-4000-8000-000000000001",
      fahrzeug_praeferenz: "bike",
    }}
    initialStatus={{
      employee_id: "a1000000-0000-4000-8000-000000000001", ist_online: true, fahrzeug: "bike",
      aktueller_batch_id: null, online_seit: "2026-08-02T10:00:00.000Z", last_lat: 52.52, last_lng: 13.405,
      last_update: "2026-08-02T10:00:00.000Z",
    }}
    initialOpenBatches={[{
      batch_id: "a4000000-0000-4000-8000-000000000001", tenant_id: "a2000000-0000-4000-8000-000000000001",
      location_id: "a3000000-0000-4000-8000-000000000001", order_id: "a5000000-0000-4000-8000-000000000001",
      bestellnummer: "TL-D-1001", kunde_name: "Testkunde Fahrer", kunde_adresse: "Laborstraße 9", kunde_plz: "10115",
      kunde_stadt: "Berlin", kunde_lat: 52.521, kunde_lng: 13.406, gesamtbetrag: 25,
      geschaetzte_lieferung_min: 20, location_name: "Testküche Mitte", location_lat: 52.52, location_lng: 13.405,
      source_system: "mise", zahlungsart: "bar", bezahlt: false,
    }]}
    initialActiveBatch={null}
  />
}
