import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { TableStorefront } from '@/app/t/[token]/storefront';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tisch-Vorschau · Mise' };

export default async function TablePreviewPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: tenant }, { data: location }, { data: categories }, { data: items }, { data: realTable }, { data: relations }] = await Promise.all([
    svc.from('tenants')
      .select('name, slug, logo_url, hero_image_url, storefront_theme_id, theme_primary, theme_accent')
      .eq('id', empRow.tenant_id).single(),
    svc.from('locations').select('name, adresse, stadt, plz').eq('id', empRow.location_id).single(),
    svc.from('menu_categories').select('*').eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order'),
    svc.from('menu_items').select('*').eq('location_id', empRow.location_id).eq('verfuegbar', true).order('sort_order'),
    svc.from('restaurant_tables').select('id, nummer, name, bereich').eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order').limit(1).maybeSingle(),
    svc.from('menu_item_relations').select('item_id, related_item_id, typ, sort_order').in('typ', ['crosssell', 'upsell']).order('sort_order'),
  ]);

  // Falls noch kein echter Tisch angelegt ist → Demo-Tisch
  const demoTable = realTable ?? {
    id: 'preview',
    nummer: 'VORSCHAU',
    name: 'Demo-Tisch',
    bereich: 'Innen',
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 grid place-items-center p-4 overflow-auto">
      {/* Preview-Banner */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-black text-center py-2 text-xs font-bold uppercase tracking-wider">
        👀 Vorschau — so sehen deine Gäste die Tisch-Bestellseite
        <a href="/pos/tables" className="ml-4 underline">← Zurück</a>
      </div>

      {/* Phone Frame */}
      <div className="mt-8 w-full max-w-[420px] bg-white rounded-[2.5rem] shadow-2xl border-[10px] border-black overflow-hidden" style={{ height: 'calc(100vh - 100px)', maxHeight: 900 }}>
        <div className="w-full h-full overflow-y-auto">
          <TableStorefront
            table={{
              id: demoTable.id,
              nummer: demoTable.nummer,
              name: demoTable.name,
              bereich: demoTable.bereich,
              tenant_id: empRow.tenant_id,
              location_id: empRow.location_id,
            }}
            tenant={tenant as any}
            location={location as any}
            categories={(categories as any[]) ?? []}
            items={(items as any[]) ?? []}
            relations={(relations as any[]) ?? []}
          />
        </div>
      </div>
    </div>
  );
}
