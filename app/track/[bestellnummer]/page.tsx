import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { TrackingView } from './tracking';
import { PushOptInCard } from '@/components/customer/push-optin';
import { getOrderProof } from '@/lib/delivery/proof';

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
    svc.from('customer_orders').select('tenant_id,location_id,kunde_telefon,kunde_email,status,tenants(name,logo_url,brand_color),locations(telefon,lat,lng)').eq('id', (order as any).order_id).maybeSingle(),
  ]);

  // Liefernachweis nur abrufen wenn Bestellung bereits zugestellt
  const rawProof = (order as any).status === 'geliefert'
    ? await getOrderProof((order as any).order_id as string)
    : null;
  const initialProof = rawProof
    ? { proof_type: rawProof.proofType, photo_url: rawProof.photoUrl, notes: rawProof.notes, created_at: rawProof.createdAt }
    : null;

  // Fehlgeschlagene Zustellversuche für den Kunden sichtbar machen
  const { data: failedAttempts } = await svc
    .from('delivery_failed_attempts')
    .select('id, reason, attempt_number, next_attempt_at, created_at')
    .eq('order_id', (order as any).order_id)
    .order('created_at', { ascending: true })
    .limit(5);
  const initialFailedAttempts = (failedAttempts ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    reason: a.reason as string,
    attempt_number: a.attempt_number as number,
    next_attempt_at: (a.next_attempt_at as string | null) ?? null,
    created_at: a.created_at as string,
  }));

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
      <TrackingView
        order={order as any}
        items={(items as any) ?? []}
        tenant={(fullOrder as any)?.tenants ?? null}
        restaurantTelefon={(fullOrder as any)?.locations?.telefon ?? null}
        restaurantLat={(fullOrder as any)?.locations?.lat ?? null}
        restaurantLng={(fullOrder as any)?.locations?.lng ?? null}
        initialProof={initialProof}
        initialFailedAttempts={initialFailedAttempts}
      />
    </div>
  );
}
