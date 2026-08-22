/**
 * /pos/settings — POS-Konfiguration im Lightspeed-Stil.
 *
 * Sektionen:
 *  1. Mitarbeiter-App Download (iPad / Android)
 *  2. Zahlungsmethoden (welche Optionen sieht der Kassierer)
 *  3. Bondrucker + Bon-Output (Drucker / QR / E-Mail / Aus)
 *  4. QR-Bon nach Zahlung (Customer-Display)
 *  5. Trinkgeld (% Stufen, Aufrunden)
 *  6. Service-Charge / Aufschläge
 *  7. Manager-PIN-Pflicht (Storno, Rabatt, Z-Bon)
 *  8. Schicht / Auto-Schluss / Anfangsbestand
 *  9. UI / Sprache / Sound / Auto-Logout
 * 10. Hardware-Test (Drucker, Schublade)
 */
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireManagerPlus } from "@/lib/auth/requireRole";
import { PageHeader } from "@/components/layout/page-header";
import { POSSettingsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function POSSettingsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from("employees")
    .select("tenant_id,location_id")
    .eq("id", emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect("/start");

  // Settings holen — wenn nicht da, leeren Datensatz mit Defaults erzeugen
  let { data: settings } = await svc
    .from("pos_settings")
    .select("*")
    .eq("tenant_id", empRow.tenant_id)
    .eq("location_id", empRow.location_id)
    .maybeSingle();

  if (!settings) {
    const { data: created } = await svc
      .from("pos_settings")
      .insert({
        tenant_id: empRow.tenant_id,
        location_id: empRow.location_id,
      })
      .select()
      .single();
    settings = created;
  }

  // SumUp/Stripe-Status für Zahlungs-Toggle-Hinweise
  const { data: tenant } = await svc
    .from("tenants")
    .select("sumup_merchant_code, sumup_api_key, stripe_account_id")
    .eq("id", empRow.tenant_id)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="POS-Einstellungen"
        description="Wie deine Kasse aussieht, was sie kann, wie sie kassiert."
        backHref="/pos"
      />
      <POSSettingsClient
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initial={settings}
        sumupConnected={
          !!(tenant?.sumup_merchant_code && tenant?.sumup_api_key)
        }
        stripeConnected={!!tenant?.stripe_account_id}
      />
    </>
  );
}
