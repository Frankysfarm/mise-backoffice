import { notFound } from "next/navigation"
import { BissStorefront } from "@/app/biss-app/[slug]/client"
import { assertTestLabEnvironment } from "@/tests/driver-system-lab/support/environment"

export const dynamic = "force-dynamic"

export default function TestLabStorefrontActorPage() {
  try {
    assertTestLabEnvironment()
  } catch {
    notFound()
  }
  return <BissStorefront
    location={{ id: "testlab-location-a", name: "Testküche Mitte", adresse: "Laborstraße 1", stadt: "Berlin", plz: "10115", telefon: null }}
    tenant={{ name: "MISE Testrestaurant", slug: "testlab-store", logoUrl: null, heroImageUrl: null, primary: null, deliveryTimeMin: 30, minOrder: 1, deliveryFee: 0 }}
    categories={[{ id: "testlab-category-main", name: "Hauptgerichte", icon: "🍽️", sort_order: 1 }]}
    items={[{ id: "testlab-item-bowl", name: "Test Bowl", beschreibung: "Synthetischer Testartikel", preis: 12.5, bild_url: null, category_id: "testlab-category-main", location_id: "testlab-location-a", verfuegbar: true, beliebt: false, sort_order: 1, option_groups: null }]}
  />
}
