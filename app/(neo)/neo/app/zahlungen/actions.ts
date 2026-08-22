'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';
const ALLOWED = ['stripe', 'bar', 'karte', 'abholung', 'lieferung'];
export async function toggleZahlung(method: string, on: boolean) {
  if (!ALLOWED.includes(method)) throw new Error('Ungültige Methode');
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const val = !on;
  // Online-Zahlung darf nur AN, wenn Stripe verbunden ist (Connect aktiv oder Self-Service-Key)
  if (method === 'stripe' && val) {
    const { data: tn } = await sb.from('tenants').select('stripe_connect_charges_enabled, stripe_secret_key').eq('id', emp.tenant_id).maybeSingle();
    if (!(tn?.stripe_connect_charges_enabled || tn?.stripe_secret_key)) {
      throw new Error('Bitte zuerst mit Stripe verbinden, bevor du die Online-Zahlung aktivierst.');
    }
  }
  const { data: ex } = await sb.from('tenant_payment_methods').select('id').eq('tenant_id', emp.tenant_id).eq('method', method).maybeSingle();
  if (ex) {
    const { error } = await sb.from('tenant_payment_methods').update({ enabled_lieferung: val, enabled_abholung: val, enabled_vor_ort: val }).eq('tenant_id', emp.tenant_id).eq('method', method);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('tenant_payment_methods').insert({ tenant_id: emp.tenant_id, method, enabled_lieferung: val, enabled_abholung: val, enabled_vor_ort: val });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/neo/app/zahlungen');
}
