import { NextRequest, NextResponse } from 'next/server';
import {
  submitApplication,
  type SubmitApplicationInput,
  type VehicleType,
  type Availability,
} from '@/lib/delivery/onboarding';

// POST /api/delivery/driver/apply — öffentlich, kein Auth
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = (body.location_id ?? '') as string;
  const firstName  = ((body.first_name ?? '') as string).trim();
  const lastName   = ((body.last_name  ?? '') as string).trim();
  const email      = ((body.email      ?? '') as string).trim();
  const phone      = ((body.phone      ?? '') as string).trim();

  if (!locationId || !firstName || !lastName || !email || !phone) {
    return NextResponse.json(
      { error: 'Pflichtfelder: location_id, first_name, last_name, email, phone' },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  const input: SubmitApplicationInput = {
    locationId,
    firstName,
    lastName,
    email,
    phone,
    hasVehicle:   Boolean(body.has_vehicle),
    vehicleType:  (body.vehicle_type ?? undefined) as VehicleType | undefined,
    licenseClass: body.license_class ? String(body.license_class) : undefined,
    availability: (body.availability ?? undefined) as Availability | undefined,
    coverLetter:  body.cover_letter  ? String(body.cover_letter)  : undefined,
    referralCode: body.referral_code ? String(body.referral_code) : undefined,
  };

  try {
    const application = await submitApplication(input);
    return NextResponse.json({ application }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DUPLICATE_APPLICATION') {
      return NextResponse.json(
        { error: 'Eine offene Bewerbung für diese E-Mail existiert bereits.' },
        { status: 409 },
      );
    }
    console.error('[apply] error', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
