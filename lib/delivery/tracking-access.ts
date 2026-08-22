import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const TRACKING_TOKEN_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function trackingTokenFromRequest(req: NextRequest): string | null {
  const token = req.headers.get('x-tracking-token') ?? req.nextUrl.searchParams.get('token');
  return token && TRACKING_TOKEN_RX.test(token) ? token : null;
}

export async function hasTrackingAccess(req: NextRequest, orderId: string): Promise<boolean> {
  const token = trackingTokenFromRequest(req);
  if (!token) return false;

  const svc = createServiceClient();
  const { data } = await svc
    .from('customer_orders')
    .select('id')
    .eq('id', orderId)
    .eq('tracking_token', token)
    .maybeSingle();

  return Boolean(data);
}

export async function getOrderAccessByNumber(bestellnummer: string, token: string) {
  if (!TRACKING_TOKEN_RX.test(token)) return null;

  const svc = createServiceClient();
  const { data } = await svc
    .from('customer_orders')
    .select('id, tracking_token')
    .eq('bestellnummer', bestellnummer)
    .eq('tracking_token', token)
    .maybeSingle();

  return data;
}
