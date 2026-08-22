import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { KampagnenView } from './client';
export const dynamic = 'force-dynamic';

export default async function Kampagnen() {
  const emp = await getCurrentEmployee();
  const svc = createServiceClient();
  const tid = emp?.tenant_id ?? '';
  const [{ data: tenant }, { data: campaigns }, { data: vouchers }, aAll, a30, aVou] = await Promise.all([
    svc.from('tenants').select('resend_verified_at, resend_from_email').eq('id', tid).maybeSingle(),
    svc.from('email_campaigns').select('id, name, betreff, status, audience_typ, versendet_count, created_at').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(50),
    svc.from('vouchers').select('id, code, typ, wert, beschreibung').eq('tenant_id', tid).eq('aktiv', true),
    svc.rpc('campaign_audience', { p_tenant_id: tid, p_audience: 'all_customers' }),
    svc.rpc('campaign_audience', { p_tenant_id: tid, p_audience: 'last_30d' }),
    svc.rpc('campaign_audience', { p_tenant_id: tid, p_audience: 'voucher_unused' }),
  ]);
  return (
    <div style={{ maxWidth: 1180 }}>
      <KampagnenView
        resendReady={!!tenant?.resend_verified_at}
        campaigns={(campaigns as any[]) ?? []}
        vouchers={(vouchers as any[]) ?? []}
        counts={{ all_customers: (aAll.data as any[])?.length ?? 0, last_30d: (a30.data as any[])?.length ?? 0, voucher_unused: (aVou.data as any[])?.length ?? 0 }}
      />
    </div>
  );
}
