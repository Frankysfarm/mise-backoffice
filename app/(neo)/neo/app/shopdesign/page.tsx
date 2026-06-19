import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { ShopDesignClient } from './client';
export const dynamic = 'force-dynamic';

type ThemeId = 'classic' | 'aurora' | 'noir' | 'mercato';
const VALID: ThemeId[] = ['classic', 'aurora', 'noir', 'mercato'];

export default async function ShopDesign() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const { data: t } = await sb
    .from('tenants')
    .select('id, name, slug, storefront_theme_id')
    .eq('id', emp?.tenant_id ?? '')
    .maybeSingle();

  const shopUrl = t?.slug ? `https://mise-gastro.de/biss-app/${t.slug}` : '';
  const raw = (t?.storefront_theme_id ?? '') as string;
  const current: ThemeId = (VALID as string[]).includes(raw) ? (raw as ThemeId) : 'classic';

  return (
    <ShopDesignClient
      tenantId={t?.id ?? ''}
      name={t?.name || 'Mein Shop'}
      shopUrl={shopUrl}
      current={current}
    />
  );
}
