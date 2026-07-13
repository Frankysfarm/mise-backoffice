import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1410 — Storefront-ETA-Verfeinerungs-API
// GET /api/delivery/public/eta-verfeinert?location_id=<uuid>
// Lieferzeit angepasst an Wetter / aktive Fahrer / Queue-Tiefe

interface ApiResponse {
  basis_eta_min: number;
  verfeinerte_eta_min: number;
  faktoren: {
    wetter_zusatz: number;
    queue_zusatz: number;
    fahrer_abzug: number;
  };
  status: 'normal' | 'erhoecht' | 'hoch';
  hinweis: string | null;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): ApiResponse {
  return {
    basis_eta_min: 30,
    verfeinerte_eta_min: 35,
    faktoren: { wetter_zusatz: 5, queue_zusatz: 3, fahrer_abzug: -3 },
    status: 'erhoecht',
    hinweis: 'Leicht erhöhtes Bestellaufkommen',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Basis-ETA aus delivery_config
    const { data: cfg } = await supabase
      .from('delivery_config')
      .select('config_value')
      .eq('location_id', locationId)
      .eq('config_key', 'basis_eta_min')
      .maybeSingle();
    const basis_eta_min: number = cfg?.config_value ? Number(cfg.config_value) : 30;

    // Queue-Tiefe: offene Bestellungen der letzten Stunde
    const { count: openCount } = await supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['pending', 'preparing'])
      .gte('created_at', oneHourAgo.toISOString());
    const queue_zusatz = Math.min(15, Math.round((openCount ?? 0) / 3) * 2);

    // Aktive Fahrer
    const { count: driverCount } = await supabase
      .from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('online', true);
    const fahrer_abzug = Math.min(8, Math.round((driverCount ?? 0) * 1.5)) * -1;

    // Wetter-Hinweis aus delivery_config
    const { data: wetterCfg } = await supabase
      .from('delivery_config')
      .select('config_value')
      .eq('location_id', locationId)
      .eq('config_key', 'wetter_hinweis')
      .maybeSingle();
    const wetterTyp: string = wetterCfg?.config_value ?? 'klar';
    const wetter_zusatz =
      wetterTyp === 'sturm' ? 10 : wetterTyp === 'regen' ? 7 : wetterTyp === 'wind' ? 5 : 0;

    const verfeinerte_eta_min = Math.max(
      basis_eta_min,
      basis_eta_min + wetter_zusatz + queue_zusatz + fahrer_abzug
    );

    const delta = verfeinerte_eta_min - basis_eta_min;
    const status: ApiResponse['status'] =
      delta >= 10 ? 'hoch' : delta >= 5 ? 'erhoecht' : 'normal';
    const hinweis =
      status === 'hoch'
        ? 'Hohe Auslastung — etwas mehr Geduld einplanen'
        : status === 'erhoecht'
        ? 'Leicht erhöhtes Bestellaufkommen'
        : null;

    return NextResponse.json({
      basis_eta_min,
      verfeinerte_eta_min,
      faktoren: { wetter_zusatz, queue_zusatz, fahrer_abzug },
      status,
      hinweis,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
