/**
 * Öffentliche Kunden-Bewertungsseite.
 * Erreichbar via Link nach Lieferung: /rate/[token]
 * Kein Login erforderlich — token-geschützt.
 */
import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import RatingClient from './client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lieferung bewerten — Mise',
  description: 'Wie war deine Lieferung?',
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RatingPage({ params }: Props) {
  const { token } = await params;
  const sb = createServiceClient();

  // Bestelldetails zum Token laden
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, status, rating_token')
    .eq('rating_token', token)
    .maybeSingle();

  const alreadyRated = order ? await (async () => {
    const { data } = await sb
      .from('customer_delivery_ratings')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();
    return !!data;
  })() : false;

  return (
    <RatingClient
      token={token}
      orderId={order?.id ?? null}
      bestellnummer={order?.bestellnummer ?? null}
      orderStatus={order?.status ?? null}
      alreadyRated={alreadyRated}
      validToken={!!order}
    />
  );
}
