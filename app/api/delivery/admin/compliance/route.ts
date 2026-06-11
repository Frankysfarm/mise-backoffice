import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCertifications,
  upsertCertification,
  deleteCertification,
  getComplianceStatus,
  getExpiringSoon,
  generateComplianceAlerts,
  checkDriverCompliance,
  type CertType,
  type CertStatus,
} from '@/lib/delivery/compliance';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp         = req.nextUrl.searchParams;
  const locationId = sp.get('location_id');
  const view       = sp.get('view') ?? 'overview';
  const driverId   = sp.get('driver_id');
  const days       = Math.min(Number(sp.get('days') ?? 30), 90);

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  if (view === 'expiring') {
    const certs = await getExpiringSoon(locationId, days);
    return NextResponse.json({ certs, days });
  }

  if (view === 'driver' && driverId) {
    const [certs, compliance] = await Promise.all([
      getCertifications(driverId, locationId),
      checkDriverCompliance(driverId),
    ]);
    return NextResponse.json({ certs, compliance });
  }

  const overview = await getComplianceStatus(locationId);
  return NextResponse.json(overview);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body       = await req.json() as Record<string, unknown>;
  const action     = body.action as string | undefined;
  const locationId = body.location_id as string | undefined;

  if (action === 'evaluate') {
    if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
    const result = await generateComplianceAlerts(locationId);
    return NextResponse.json(result);
  }

  // Zertifikat hinzufügen / aktualisieren
  const driverId = body.driver_id as string | undefined;
  const certType = body.cert_type as CertType | undefined;

  if (!locationId || !driverId || !certType) {
    return NextResponse.json(
      { error: 'location_id, driver_id, cert_type required' },
      { status: 400 },
    );
  }

  const VALID_CERT_TYPES: CertType[] = [
    'food_hygiene', 'drivers_license', 'vehicle_inspection',
    'food_handler', 'id_verification', 'other',
  ];
  if (!VALID_CERT_TYPES.includes(certType)) {
    return NextResponse.json({ error: `invalid cert_type: ${certType}` }, { status: 400 });
  }

  const cert = await upsertCertification({
    driverId,
    locationId,
    certType,
    certNumber: body.cert_number as string | null | undefined,
    issuedAt:   body.issued_at   as string | null | undefined,
    expiresAt:  body.expires_at  as string | null | undefined,
    status:     (body.status as CertStatus | undefined) ?? 'active',
    notes:      body.notes as string | null | undefined,
    createdBy:  user.id,
  });
  return NextResponse.json(cert, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp         = req.nextUrl.searchParams;
  const certId     = sp.get('cert_id');
  const locationId = sp.get('location_id');

  if (!certId || !locationId) {
    return NextResponse.json(
      { error: 'cert_id and location_id required' },
      { status: 400 },
    );
  }

  await deleteCertification(certId, locationId);
  return NextResponse.json({ ok: true });
}
