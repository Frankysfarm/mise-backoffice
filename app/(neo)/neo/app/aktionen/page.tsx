import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { GratisProdukClientUi } from './gratis-produkt-client';

export const dynamic = 'force-dynamic';

export default async function AktionenPage() {
  const employee = await requireManagerPlus();
  const sb = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: fpConfig } = await sb
    .from('free_product_configs')
    .select('*')
    .eq('tenant_id', emp.tenant_id)
    .maybeSingle();

  const { data: menuItems } = await sb
    .from('menu_items')
    .select('id, name, preis')
    .eq('verfuegbar', true)
    .order('name');

  const { count: redemptionsLast30 } = await sb
    .from('customer_free_product_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', emp.tenant_id)
    .gte('eingeloest_am', new Date(Date.now() - 30 * 86400_000).toISOString());

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Aktionen & Rabatte</h1>
      <p className="text-gray-600 mb-8">Belohne deine Kunden mit einem Gratis-Produkt — manipulationssicher mit Anti-Cheat.</p>
      
      <GratisProdukClientUi
        tenantId={emp.tenant_id}
        initialConfig={fpConfig as any}
        menuItems={(menuItems as any) ?? []}
        redemptionsLast30={redemptionsLast30 ?? 0}
      />
    </div>
  );
}
