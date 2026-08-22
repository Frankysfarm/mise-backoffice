import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { PruefungView } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kassen-Nachschau · Mise' };

export default async function PruefungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data: tok } = await svc.from('kassenpruefung_tokens')
    .select('*, tenant:tenants(name, steuernummer, ust_id, stadt, adresse, plz, fiskaly_tss_id, fiskaly_environment)')
    .eq('token', token).maybeSingle();

  if (!tok || new Date(tok.gueltig_bis) < new Date() || tok.revoked_at) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const from30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { data: registers },
    { data: transactions },
    { data: zReports },
    { data: outages },
    { count: auditCount },
  ] = await Promise.all([
    svc.from('pos_registers').select('*').eq('tenant_id', tok.tenant_id),
    svc.from('pos_transactions').select('id, typ, brutto_gesamt, zahlungsart, bezahlt, bezahlt_betrag, storno_grund, storno_ref_id, trainingsbon, created_at, tse_signature, tse_transaction_id, tse_start_time, tse_end_time')
      .eq('tenant_id', tok.tenant_id)
      .gte('created_at', `${from30}T00:00:00`)
      .order('created_at', { ascending: false }).limit(500),
    svc.from('pos_z_reports').select('*').eq('tenant_id', tok.tenant_id)
      .gte('erstellt_am', `${from30}T00:00:00`)
      .order('erstellt_am', { ascending: false }).limit(50),
    svc.from('tse_outage_log').select('*').eq('tenant_id', tok.tenant_id)
      .order('start_at', { ascending: false }).limit(20),
    svc.from('audit_log').select('id', { count: 'exact', head: true }).eq('tenant_id', tok.tenant_id),
  ]);

  return (
    <PruefungView
      token={token}
      tenant={(tok as any).tenant}
      pruefer={{ name: tok.pruefer_name, amt: tok.pruefer_amt, gueltig_bis: tok.gueltig_bis }}
      registers={(registers as any[]) ?? []}
      transactions={(transactions as any[]) ?? []}
      zReports={(zReports as any[]) ?? []}
      outages={(outages as any[]) ?? []}
      auditCount={auditCount ?? 0}
    />
  );
}
