/**
 * GET /api/delivery/admin/kunden-wartezeit-live
 *   ?location_id=<uuid>
 *
 * Ø Wartezeit aktueller Kunden (Bestellung bis Lieferung).
 * Alert wenn Ø > 45 Min.
 *
 * Phase 553
 *
 * Response: { ok, data: WartezeitData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_SCHWELLE_MIN = 45;
const WARNUNG_SCHWELLE_MIN = 35;

export interface WartezeitEintrag {
  orderId: string;
  bestellnummer: string;
  bestelltAm: string;
  geliefertAm: string | null;
  wartezeitMin: number;
  status: string;
  istAktiv: boolean;
}

export interface WartezeitData {
  aktivBestellungen: number;
  abgeschlosseneBestellungen: number;
  avgWartezeitAktivMin: number;
  avgWartezeitAbgeschlossenMin: number;
  maxWartezeitMin: number;
  ueber45Min: number;
  ueber30Min: number;
  wartezeiten: WartezeitEintrag[];
  alertLevel: 'ok' | 'warnung' | 'kritisch';
  alertMessage: string;
  empfehlung: string;
}

export interface KundenWartezeitResponse {
  ok: boolean;
  data: WartezeitData;
  generatedAt: string;
}

type OrderRow = {
  id: string;
  bestellnummer: string;
  status: string;
  created_at: string;
  geliefert_am: string | null;
};

const AKTIV_STATUSES = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'in_lieferung'];

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const since4h = new Date(now.getTime() - 4 * 3600_000).toISOString();

    const { data: rawOrders } = await svc
      .from('customer_orders')
      .select('id, bestellnummer, status, created_at, geliefert_am')
      .eq('location_id', locationId)
      .neq('status', 'storniert')
      .gte('created_at', since4h)
      .order('created_at', { ascending: false });

    const orders = (rawOrders ?? []) as OrderRow[];

    const wartezeiten: WartezeitEintrag[] = orders.map(o => {
      const bestelltMs   = new Date(o.created_at).getTime();
      const geliefertMs  = o.geliefert_am ? new Date(o.geliefert_am).getTime() : now.getTime();
      const wartezeitMin = Math.max(0, Math.round((geliefertMs - bestelltMs) / 60_000));
      const istAktiv     = AKTIV_STATUSES.includes(o.status);
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        bestelltAm: o.created_at,
        geliefertAm: o.geliefert_am,
        wartezeitMin,
        status: o.status,
        istAktiv,
      };
    });

    const aktiv        = wartezeiten.filter(w => w.istAktiv);
    const abgeschl     = wartezeiten.filter(w => !w.istAktiv && w.geliefertAm);

    const avg = (arr: WartezeitEintrag[]) =>
      arr.length > 0 ? Math.round(arr.reduce((s, w) => s + w.wartezeitMin, 0) / arr.length) : 0;

    const avgAktiv      = avg(aktiv);
    const avgAbgeschl   = avg(abgeschl);
    const maxWartezeit  = wartezeiten.length > 0
      ? Math.max(...wartezeiten.map(w => w.wartezeitMin))
      : 0;
    const ueber45       = aktiv.filter(w => w.wartezeitMin > 45).length;
    const ueber30       = aktiv.filter(w => w.wartezeitMin > 30).length;

    const alertLevel: WartezeitData['alertLevel'] =
      avgAktiv > ALERT_SCHWELLE_MIN   ? 'kritisch' :
      avgAktiv > WARNUNG_SCHWELLE_MIN ? 'warnung'  : 'ok';

    const alertMessage =
      alertLevel === 'kritisch'
        ? `Ø Wartezeit ${avgAktiv} Min — kritisch! ${ueber45} Kunden warten >45 Min`
        : alertLevel === 'warnung'
        ? `Ø Wartezeit ${avgAktiv} Min — erhöht. ${ueber30} Kunden warten >30 Min`
        : `Ø Wartezeit ${avgAktiv} Min — im grünen Bereich`;

    const empfehlung =
      alertLevel === 'kritisch'
        ? 'Sofort: Zusatz-Fahrer aktivieren oder Annahme-Stopp prüfen'
        : alertLevel === 'warnung'
        ? 'Kunden proaktiv informieren, Fahrer-Kapazität erhöhen'
        : 'Alles im Rahmen — weiter beobachten';

    const data: WartezeitData = {
      aktivBestellungen: aktiv.length,
      abgeschlosseneBestellungen: abgeschl.length,
      avgWartezeitAktivMin: avgAktiv,
      avgWartezeitAbgeschlossenMin: avgAbgeschl,
      maxWartezeitMin: maxWartezeit,
      ueber45Min: ueber45,
      ueber30Min: ueber30,
      wartezeiten,
      alertLevel,
      alertMessage,
      empfehlung,
    };

    return NextResponse.json({ ok: true, data, generatedAt: nowIso } satisfies KundenWartezeitResponse);
  } catch (err) {
    console.error('[kunden-wartezeit-live]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
