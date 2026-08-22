/**
 * GET    /api/delivery/zones/[id]  — Einzelne Zone laden
 * PATCH  /api/delivery/zones/[id]  — Zone aktualisieren (Admin)
 * DELETE /api/delivery/zones/[id]  — Zone deaktivieren (soft-delete)
 */
import { NextRequest, NextResponse } from 'next/server';
import { updateZoneById, deactivateZoneById } from '@/lib/delivery/zones';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

async function requireUser() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_zones')
    .select('id, name, label, min_km, max_km, surcharge_eur, min_order_eur, eta_base_min, color, active, location_id')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Zone nicht gefunden' }, { status: 404 });
  return NextResponse.json({ zone: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    location_id?: string;
    label?: string;
    min_km?: number;
    max_km?: number;
    surcharge_eur?: number;
    min_order_eur?: number;
    eta_base_min?: number;
    color?: string;
  };

  if (!body.location_id) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  try {
    const zone = await updateZoneById(id, body.location_id, {
      label:         body.label,
      min_km:        body.min_km != null ? Number(body.min_km) : undefined,
      max_km:        body.max_km != null ? Number(body.max_km) : undefined,
      surcharge_eur: body.surcharge_eur != null ? Number(body.surcharge_eur) : undefined,
      min_order_eur: body.min_order_eur != null ? Number(body.min_order_eur) : undefined,
      eta_base_min:  body.eta_base_min != null ? Number(body.eta_base_min) : undefined,
      color:         body.color,
    });
    return NextResponse.json({ ok: true, zone });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    await deactivateZoneById(id, locationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
