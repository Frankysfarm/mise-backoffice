import { createServiceClient } from '@/lib/supabase/server';

/**
 * Validiert einen Kassen-Nachschau-Token und loggt den Zugriff.
 * Gibt tenant_id zurück wenn gültig, sonst null.
 */
export async function validatePruefungToken(
  token: string,
  action: 'open' | 'dsfinvk_export' | 'meldepaket' | 'verfahrensdoku',
  req?: Request,
): Promise<{ tenant_id: string; location_id: string | null } | null> {
  const svc = createServiceClient();
  const { data } = await svc.from('kassenpruefung_tokens')
    .select('tenant_id, location_id, gueltig_bis, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.gueltig_bis) < new Date()) return null;

  // Append-only Audit-Log
  await svc.from('pruefung_access_log').insert({
    token,
    action,
    ip_address: req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: req?.headers.get('user-agent') ?? null,
  });

  return { tenant_id: data.tenant_id, location_id: data.location_id };
}
