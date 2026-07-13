import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1385 — Wetter-Status API
// GET /api/delivery/public/wetter-status?location_id=<uuid>
// Liest aus location_weather_config oder delivery_config falls vorhanden
// Fallback: einfache Tageszeit-Heuristik (Abends im Sommer kein Regen → klar)

type WetterTyp = 'regen' | 'sturm' | 'wind' | 'klar';

interface ApiResponse {
  typ: WetterTyp;
  beschreibung: string;
  extra_minuten: number;
  aktiv: boolean;
}

function buildKlar(): ApiResponse {
  return { typ: 'klar', beschreibung: '', extra_minuten: 0, aktiv: false };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Prüfe delivery_config auf manuell gesetzten Wetter-Override
    const { data: cfg } = await supabase
      .from('delivery_config')
      .select('config_value')
      .eq('location_id', locationId)
      .eq('config_key', 'wetter_hinweis')
      .maybeSingle();

    if (cfg?.config_value) {
      const val = cfg.config_value as Record<string, unknown>;
      const typ = (val.typ ?? 'klar') as WetterTyp;
      const aktiv = Boolean(val.aktiv);
      return NextResponse.json({
        typ,
        beschreibung: (val.beschreibung as string) ?? '',
        extra_minuten: typ === 'sturm' ? 10 : typ === 'regen' ? 7 : 5,
        aktiv,
      } satisfies ApiResponse);
    }

    // Kein Config-Eintrag → klar (kein Banner)
    return NextResponse.json(buildKlar());
  } catch {
    return NextResponse.json(buildKlar());
  }
}
