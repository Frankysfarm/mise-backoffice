import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getMiseOsApiUrl,
  getMiseOsAppUrl,
  isMiseOsScreen,
  mapEmployeeRoleToMiseOs,
} from '@/lib/mise-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SsoResponse = {
  token?: string;
  user?: { id: string; name: string; role: string; tenantName?: string };
  error?: string;
};

export async function POST(request: NextRequest) {
  const employee = await getCurrentEmployee();
  if (!employee?.tenant_id || !employee.email) {
    return NextResponse.json(
      { error: 'Dein Mitarbeiterkonto ist nicht vollständig mit Neo verbunden.' },
      { status: 403 },
    );
  }
  if (!['manager', 'backoffice', 'admin'].includes(employee.rolle)) {
    return NextResponse.json(
      { error: 'Dieser Mise-OS-Bereich ist nur für die Betriebsleitung freigegeben.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null) as { screen?: unknown } | null;
  const screen = typeof body?.screen === 'string' && isMiseOsScreen(body.screen)
    ? body.screen
    : null;
  if (!screen) {
    return NextResponse.json({ error: 'Unbekannter Mise-OS-Bereich.' }, { status: 400 });
  }

  const secret = process.env.MISE_OS_SSO_SECRET;
  if (!secret || secret.length < 16) {
    console.error('MISE_OS_SSO_SECRET is missing or too short');
    return NextResponse.json(
      { error: 'Die Verbindung zum Betriebssystem ist noch nicht konfiguriert.' },
      { status: 503 },
    );
  }

  const service = createServiceClient();
  const { data: tenant, error: tenantError } = await service
    .from('tenants')
    .select('name,slug')
    .eq('id', employee.tenant_id)
    .maybeSingle<{ name: string | null; slug: string | null }>();

  if (tenantError || !tenant) {
    console.error('Neo tenant lookup failed for Mise OS handoff', tenantError?.message ?? 'not found');
    return NextResponse.json(
      { error: 'Dein Betrieb konnte für Mise OS nicht eindeutig zugeordnet werden.' },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${getMiseOsApiUrl()}/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: employee.email,
        secret,
        tenantName: tenant.name ?? 'Mein Restaurant',
        tenantSlug: tenant.slug,
        tenantExternalId: employee.tenant_id,
        userExternalId: employee.id,
        userName: `${employee.vorname} ${employee.nachname}`.trim() || employee.email,
        role: mapEmployeeRoleToMiseOs(employee.rolle),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    console.error('Mise OS SSO is unreachable', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Das Betriebssystem ist gerade nicht erreichbar. Bitte erneut versuchen.' },
      { status: 503 },
    );
  }

  const result = await response.json().catch(() => null) as SsoResponse | null;
  if (!response.ok || !result?.token) {
    console.error('Mise OS SSO rejected the handoff', response.status, result?.error ?? 'invalid response');
    return NextResponse.json(
      { error: 'Die Anmeldung am Betriebssystem konnte nicht abgeschlossen werden.' },
      { status: response.status === 401 ? 502 : 503 },
    );
  }

  return NextResponse.json(
    { token: result.token, appUrl: getMiseOsAppUrl(), screen },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}
