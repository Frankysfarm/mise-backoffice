import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /go/[slug]
 *
 * Stabiler Redirector für gedruckte QR-Codes. Encodet wird IMMER diese URL,
 * Ziel wird per DB-Lookup aufgelöst:
 *
 *   1. tenants.storefront_settings.public_url  (für Subpath-Setups)
 *   2. tenants.custom_domain bei status active/verified  (eigene Domain)
 *   3. Fallback: mise-gastro.de/order/{slug}             (Standard-Storefront)
 *
 * Wenn der Restaurant-Inhaber später die Domain wechselt, ändert sich der
 * Ziel-Redirect automatisch — der gedruckte QR bleibt gültig.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return new NextResponse('slug required', { status: 400 });

  const svc = createServiceClient();
  const { data: tenant } = await svc
    .from('tenants')
    .select('slug, custom_domain, custom_domain_status, storefront_settings')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) {
    // Unbekannter Slug → trotzdem zur Standard-Storefront falls dort gerouted wird
    return NextResponse.redirect(`https://mise-gastro.de/order/${slug}`, 302);
  }

  const settings = (tenant.storefront_settings ?? {}) as { public_url?: string };
  const publicUrl = settings.public_url?.trim();
  if (publicUrl && /^https?:\/\//.test(publicUrl)) {
    return NextResponse.redirect(publicUrl, 302);
  }

  const dom = tenant.custom_domain?.trim();
  const verified = ['verified', 'active'].includes(String(tenant.custom_domain_status ?? ''));
  if (dom && verified) {
    return NextResponse.redirect(`https://${dom}`, 302);
  }

  return NextResponse.redirect(`https://mise-gastro.de/order/${slug}`, 302);
}
