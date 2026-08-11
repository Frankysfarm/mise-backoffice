import { createServiceClient } from '@/lib/supabase/server';
import { getOrderAccessByNumber } from '@/lib/delivery/tracking-access';
import { TrackingView } from './tracking';
import { TrackingVerification } from './verify-form';
import { PushOptInCard } from '@/components/customer/push-optin';

export const dynamic = 'force-dynamic';

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ bestellnummer: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { bestellnummer } = await params;
  const query = await searchParams;
  const trackingToken = typeof query.token === 'string' ? query.token : '';
  const access = trackingToken
    ? await getOrderAccessByNumber(bestellnummer, trackingToken)
    : null;

  // Bestellnummern sind absichtlich nicht mehr selbst die Zugangsberechtigung.
  // Alte oder ungültige Links zeigen dieselbe neutrale Verifizierung ohne PII.
  if (!access) return <TrackingVerification bestellnummer={bestellnummer} />;

  const svc = createServiceClient();

  const { data: order } = await svc
    .from('v_order_tracking')
    .select('*')
    .eq('order_id', access.id)
    .maybeSingle();

  if (!order) return <TrackingVerification bestellnummer={bestellnummer} />;

  const [{ data: items }, { data: fullOrder }] = await Promise.all([
    svc.from('order_items').select('name, menge, einzelpreis').eq('order_id', (order as any).order_id),
    svc.from('customer_orders').select('tenant_id,location_id,status,tenants(name,logo_url,brand_color),locations(telefon)').eq('id', (order as any).order_id).maybeSingle(),
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
            trackingToken={trackingToken}
          />
        </div>
      )}
      <TrackingView
        order={order as any}
        items={(items as any) ?? []}
        trackingToken={trackingToken}
        tenant={(fullOrder as any)?.tenants ?? null}
        restaurantTelefon={(fullOrder as any)?.locations?.telefon ?? null}
      />
    </div>
  );
}
