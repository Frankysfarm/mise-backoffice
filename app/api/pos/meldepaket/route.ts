import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * § 146a Abs. 4 AO Meldepaket
 * Erzeugt XML für ELSTER-Upload mit allen Kassen+TSE der Location.
 */
export async function GET(req: NextRequest) {
  const svc = createServiceClient();
  let tenantId: string | null = null;

  const pruefungToken = req.headers.get('x-pruefung-token') ?? req.nextUrl.searchParams.get('pruefung_token');
  if (pruefungToken) {
    const { data: kpt } = await svc.from('kassenpruefung_tokens')
      .select('tenant_id, gueltig_bis, revoked_at')
      .eq('token', pruefungToken).maybeSingle();
    if (!kpt || kpt.revoked_at || new Date(kpt.gueltig_bis) < new Date()) {
      return NextResponse.json({ ok: false, error: 'Token ungültig' }, { status: 401 });
    }
    tenantId = kpt.tenant_id;
    await svc.from('pruefung_access_log').insert({
      token: pruefungToken, action: 'meldepaket',
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  } else {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });
    const { data: emp } = await svc.from('employees').select('tenant_id, rolle').eq('auth_user_id', user.id).maybeSingle();
    if (!emp?.tenant_id || !['admin', 'backoffice'].includes(emp.rolle)) {
      return NextResponse.json({ ok: false, error: 'Nur Admin/Backoffice' }, { status: 403 });
    }
    tenantId = tenantId;
  }

  const { data: tenant } = await svc.from('tenants').select('*').eq('id', tenantId).single();
  const { data: locations } = await svc.from('locations').select('*').eq('tenant_id', tenantId);
  const { data: registers } = await svc.from('pos_registers').select('*').eq('tenant_id', tenantId);

  const xml = buildMeldepaketXML({
    tenant: tenant as any,
    locations: (locations as any[]) ?? [],
    registers: (registers as any[]) ?? [],
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="meldepaket-146a-${new Date().toISOString().slice(0,10)}.xml"`,
    },
  });
}

function buildMeldepaketXML(p: {
  tenant: any;
  locations: any[];
  registers: any[];
}): string {
  const { tenant, locations, registers } = p;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Mitteilung146aAO>
  <Steuerpflichtiger>
    <Name>${esc(tenant.name ?? '')}</Name>
    <Steuernummer>${esc(tenant.steuernummer ?? '')}</Steuernummer>
    <UstID>${esc(tenant.ust_id ?? '')}</UstID>
    <Adresse>
      <Strasse>${esc(tenant.adresse ?? '')}</Strasse>
      <PLZ>${esc(tenant.plz ?? '')}</PLZ>
      <Ort>${esc(tenant.stadt ?? '')}</Ort>
      <Land>DEU</Land>
    </Adresse>
  </Steuerpflichtiger>
  <Betriebsstaetten>
${locations.map((l: any) => `    <Betriebsstaette>
      <Name>${esc(l.name)}</Name>
      <Strasse>${esc(l.adresse ?? '')}</Strasse>
      <PLZ>${esc(l.plz ?? '')}</PLZ>
      <Ort>${esc(l.stadt ?? '')}</Ort>
      <Kassen>
${registers.filter((r: any) => r.location_id === l.id).map((r: any) => `        <Kasse>
          <KassenID>${esc(r.id)}</KassenID>
          <Hersteller>Mise GmbH</Hersteller>
          <Modell>SaaS-POS</Modell>
          <Softwareversion>2026.04</Softwareversion>
          <Seriennummer>${esc(r.id)}</Seriennummer>
          <TSE>
            <Seriennummer>${esc(tenant.fiskaly_tss_id ?? '')}</Seriennummer>
            <ZertifikatID>fiskaly-cloud-TSE</ZertifikatID>
            <BSI_Zertifizierung>BSI-K-TR-0362-2019</BSI_Zertifizierung>
          </TSE>
          <DatumAnschaffung>${esc((r.created_at ?? '').slice(0,10))}</DatumAnschaffung>
          <DatumInbetriebnahme>${esc((r.created_at ?? '').slice(0,10))}</DatumInbetriebnahme>
        </Kasse>`).join('\n')}
      </Kassen>
    </Betriebsstaette>`).join('\n')}
  </Betriebsstaetten>
</Mitteilung146aAO>`;
}

function esc(s: string): string {
  return (s ?? '').toString().replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] ?? c));
}
