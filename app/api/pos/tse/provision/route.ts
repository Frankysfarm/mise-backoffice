import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Einmalige TSS+Client Erstellung bei fiskaly.
 * - Holt API-Key + Secret aus tenant
 * - Authentifiziert via Basic → bekommt access_token
 * - Erstellt TSS (uuid)
 * - Registriert Client (uuid) an der TSS
 * - Speichert IDs zurück auf tenant
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const { tenant_id } = await req.json();
  const svc = createServiceClient();

  const { data: emp } = await svc.from('employees').select('tenant_id,rolle').eq('auth_user_id', user.id).maybeSingle();
  if (!emp || emp.tenant_id !== tenant_id) {
    return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
  }

  const { data: tenant } = await svc.from('tenants')
    .select('fiskaly_api_key, fiskaly_api_secret, fiskaly_environment')
    .eq('id', tenant_id).single();

  if (!tenant?.fiskaly_api_key || !tenant?.fiskaly_api_secret) {
    return NextResponse.json({ ok: false, error: 'API-Key/Secret nicht konfiguriert' });
  }

  const baseUrl = tenant.fiskaly_environment === 'live'
    ? 'https://kassensichv.io/api/v2'
    : 'https://kassensichv.io/api/v2';  // fiskaly hat Live/Sandbox per Key, nicht per URL

  try {
    // 1) Auth
    const authRes = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tenant.fiskaly_api_key,
        api_secret: tenant.fiskaly_api_secret,
      }),
    });
    if (!authRes.ok) {
      const err = await authRes.text();
      return NextResponse.json({ ok: false, error: `fiskaly Auth: ${err.slice(0, 200)}` });
    }
    const { access_token } = await authRes.json();

    // 2) TSS erstellen
    const tssId = crypto.randomUUID();
    const tssRes = await fetch(`${baseUrl}/tss/${tssId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'UNINITIALIZED' }),
    });
    if (!tssRes.ok) {
      return NextResponse.json({ ok: false, error: `TSS-Creation: ${tssRes.status}` });
    }
    const tss = await tssRes.json();

    // 3) TSS aktivieren
    await fetch(`${baseUrl}/tss/${tssId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'INITIALIZED' }),
    });

    // 4) Client erstellen
    const clientId = crypto.randomUUID();
    await fetch(`${baseUrl}/tss/${tssId}/client/${clientId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serial_number: `mise-${tenant_id.slice(0, 8)}` }),
    });

    // 5) zurückspeichern
    await svc.from('tenants').update({
      fiskaly_tss_id: tssId,
      fiskaly_client_id: clientId,
    }).eq('id', tenant_id);

    return NextResponse.json({
      ok: true,
      tss_id: tssId,
      client_id: clientId,
      serial_number: tss.serial_number,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Netzwerkfehler',
    });
  }
}
