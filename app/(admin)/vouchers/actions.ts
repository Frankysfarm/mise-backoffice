'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function tenantId() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  return emp?.tenant_id ?? null;
}

export async function createVoucher(data: {
  code: string;
  typ: 'prozent' | 'fix' | 'gratis_lieferung';
  wert: number;
  min_bestellwert?: number;
  max_rabatt?: number;
  gueltig_bis?: string;
  nutzungen_max?: number;
  nutzungen_pro_kunde?: number;
  beschreibung?: string;
}) {
  const t = await tenantId();
  if (!t) return { ok: false, error: 'Kein Tenant' };
  const svc = createServiceClient();
  const { error } = await svc.from('vouchers').insert({
    tenant_id: t,
    code: data.code.toUpperCase().replace(/\s/g, ''),
    typ: data.typ,
    wert: data.wert,
    min_bestellwert: data.min_bestellwert ?? 0,
    max_rabatt: data.max_rabatt ?? null,
    gueltig_bis: data.gueltig_bis ?? null,
    nutzungen_max: data.nutzungen_max ?? null,
    nutzungen_pro_kunde: data.nutzungen_pro_kunde ?? 1,
    beschreibung: data.beschreibung ?? null,
    aktiv: true,
    quelle: 'manual',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/vouchers');
  return { ok: true };
}

export async function toggleVoucher(id: string, aktiv: boolean) {
  const svc = createServiceClient();
  const { error } = await svc.from('vouchers').update({ aktiv }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/vouchers');
  return { ok: true };
}

export async function deleteVoucher(id: string) {
  const svc = createServiceClient();
  const { error } = await svc.from('vouchers').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/vouchers');
  return { ok: true };
}

export async function toggleBonVoucher(enabled: boolean) {
  const t = await tenantId();
  if (!t) return { ok: false, error: 'Kein Tenant' };
  const svc = createServiceClient();
  const { data: current } = await svc.from('tenants').select('oeffnungszeiten_json').eq('id', t).single();
  const cfg = { ...(current?.oeffnungszeiten_json as any ?? {}), bon_voucher_enabled: enabled };
  const { error } = await svc.from('tenants').update({ oeffnungszeiten_json: cfg }).eq('id', t);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/vouchers');
  return { ok: true };
}
