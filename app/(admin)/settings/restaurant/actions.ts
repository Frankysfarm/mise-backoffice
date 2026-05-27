'use server';

import { createServiceClient, createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveRestaurantSettings(formData: FormData) {
  const sb = await createClient();
  const svc = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt' };
  const { data: emp } = await sb.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return { ok: false, error: 'Kein Tenant' };

  const patch = {
    name: str(formData.get('name')),
    inhaber_vollname: str(formData.get('inhaber_vollname')),
    email: str(formData.get('email')),
    telefon: str(formData.get('telefon')),
    adresse: str(formData.get('adresse')),
    stadt: str(formData.get('stadt')),
    plz: str(formData.get('plz')),
    ustid: str(formData.get('ustid')),
    steuernummer: str(formData.get('steuernummer')),
    handelsregister: str(formData.get('handelsregister')),
    impressum_text: str(formData.get('impressum_text')),
    agb_url: str(formData.get('agb_url')),
    widerruf_url: str(formData.get('widerruf_url')),
    datenschutz_url: str(formData.get('datenschutz_url')),
    bank_iban: str(formData.get('bank_iban')),
    bank_bic: str(formData.get('bank_bic')),
    bank_inhaber: str(formData.get('bank_inhaber')),
    lieferradius_km: num(formData.get('lieferradius_km')),
    liefergebuehr: num(formData.get('liefergebuehr')),
    mindestbestellwert: num(formData.get('mindestbestellwert')),
    theme_primary: str(formData.get('theme_primary')),
    theme_accent: str(formData.get('theme_accent')),
  };

  const { error } = await svc.from('tenants').update(patch).eq('id', emp.tenant_id);
  if (error) return { ok: false, error: error.message };

  // Geocoding der Filiale(n) via Photon (OSM, kostenlos, keine API-Keys)
  if (patch.adresse && patch.stadt) {
    await geocodeTenantLocations(emp.tenant_id, {
      adresse: patch.adresse,
      stadt: patch.stadt,
      plz: patch.plz,
    });
  }

  revalidatePath('/settings/restaurant');
  return { ok: true };
}

async function geocodeTenantLocations(
  tenantId: string,
  addr: { adresse: string | null; stadt: string | null; plz: string | null },
): Promise<void> {
  try {
    const svc = createServiceClient();
    // Alle Locations des Tenants holen (normalerweise 1)
    const { data: locations } = await svc
      .from('locations')
      .select('id, adresse, stadt, plz, lat, lng')
      .eq('tenant_id', tenantId)
      .eq('aktiv', true);

    for (const loc of (locations as any[]) ?? []) {
      // Skip wenn schon geocoded
      if (loc.lat && loc.lng) continue;

      const locAddr = loc.adresse ?? addr.adresse;
      const locCity = loc.stadt ?? addr.stadt;
      const locPlz = loc.plz ?? addr.plz;

      if (!locAddr || !locCity) continue;

      const q = encodeURIComponent(`${locAddr}, ${locPlz ?? ''} ${locCity}, Deutschland`);
      const url = `https://photon.komoot.io/api/?q=${q}&limit=1&lang=de`;

      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const feature = json?.features?.[0];
        if (!feature?.geometry?.coordinates) continue;

        const [lng, lat] = feature.geometry.coordinates;
        await svc.from('locations').update({
          lat,
          lng,
          geocoded_am: new Date().toISOString(),
        }).eq('id', loc.id);
      } catch {
        // still succeed — geocoding ist best-effort
      }
    }
  } catch {}
}

function str(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}
function num(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string') return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
