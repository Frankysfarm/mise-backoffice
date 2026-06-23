import { createServiceClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BissTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const sb = createServiceClient();

  // Try to look up the token in customer_orders table
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, location_id, locations(tenant_id, tenants(slug))')
    .eq('id', decoded)
    .maybeSingle();

  if (order) {
    const tenantSlug = (order as any)?.locations?.tenants?.slug;
    if (tenantSlug) {
      redirect(`/biss-app/${encodeURIComponent(tenantSlug)}`);
    }
  }

  // Fallback: try short_links or qr_tokens table
  const { data: link } = await sb
    .from('short_links')
    .select('target_slug')
    .eq('token', decoded)
    .maybeSingle();

  if (link?.target_slug) {
    redirect(`/biss-app/${encodeURIComponent(link.target_slug)}`);
  }

  notFound();
}
