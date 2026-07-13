import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Fenster = {
  label: string;
  eta_label: string;
  verfuegbar: boolean;
  empfohlen: boolean;
};

type ApiResponse = {
  fenster: Fenster[];
  location_id: string;
  generiert_am: string;
};

function formatEtaRange(base: Date, offsetMin: number, rangeMin: number): string {
  const start = new Date(base.getTime() + offsetMin * 60_000);
  const end = new Date(start.getTime() + rangeMin * 60_000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)}–${fmt(end)} Uhr`;
}

function buildFenster(now: Date, baseEtaMin: number): Fenster[] {
  return [
    {
      label: `Jetzt · ~${baseEtaMin} Min`,
      eta_label: formatEtaRange(now, baseEtaMin, 15),
      verfuegbar: true,
      empfohlen: true,
    },
    {
      label: 'In 30 Min',
      eta_label: formatEtaRange(now, baseEtaMin + 30, 15),
      verfuegbar: true,
      empfohlen: false,
    },
    {
      label: 'In 60 Min',
      eta_label: formatEtaRange(now, baseEtaMin + 60, 15),
      verfuegbar: true,
      empfohlen: false,
    },
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const now = new Date();

  try {
    const supabase = await createClient();

    // Count active drivers to estimate ETA
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    // Count pending orders
    const { count: pendingCount } = await supabase
      .from('mise_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['neu', 'angenommen', 'confirmed', 'new', 'pending', 'in_preparation']);

    const activeDrivers = drivers?.length ?? 0;
    const pending = pendingCount ?? 0;

    // Simple ETA estimate: base 20 min + 2 min per order above driver capacity
    const capacity = activeDrivers * 4;
    const overload = Math.max(0, pending - capacity);
    const baseEta = Math.min(55, 20 + overload * 2);

    return NextResponse.json({
      fenster: buildFenster(now, baseEta),
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json({
      fenster: buildFenster(now, 25),
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  }
}
