import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { TrackingView } from './tracking';
import { PushOptInCard } from '@/components/customer/push-optin';

export const dynamic = 'force-dynamic';

export default async function TrackPage({
  params,
}: {
  params: Promise<{ bestellnummer: string }>;
}) {
  const { bestellnummer } = await params;
  const supabase = await createClient();
  const svc = createServiceClient();

  const { data: order } = await supabase
    .from('v_order_tracking')
    .select('*')
    .eq('bestellnummer', bestellnummer)
    .maybeSingle();

  if (!order) notFound();

  const [{ data: items }, { data: fullOrder }] = await Promise.all([
    supabase.from('order_items').select('name, menge, einzelpreis').eq('order_id', (order as any).order_id),
    svc.from('customer_orders').select('tenant_id,kunde_telefon,kunde_email,status,tenants(name,logo_url,brand_color)').eq('id', (order as any).order_id).maybeSingle(),
  ]);

  const showOptIn = Boolean(
    fullOrder?.tenant_id &&
    fullOrder.status !== 'geliefert' &&
    fullOrder.status !== 'abgeholt' &&
    fullOrder.status !== 'storniert',
  );

  return (
    <div className="min-h-screen">
      {showOptIn && fullOrder && (
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          <PushOptInCard
            orderId={(order as any).order_id}
            tenantId={fullOrder.tenant_id}
            telefon={(fullOrder as any).kunde_telefon ?? undefined}
            email={(fullOrder as any).kunde_email ?? undefined}
          />
        </div>
      )}
      <TrackingView order={order as any} items={(items as any) ?? []} tenant={(fullOrder as any)?.tenants ?? null} />
    </div>
  );
}
