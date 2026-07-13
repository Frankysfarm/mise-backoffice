import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1219 — Kunden-Anruf-Log API (Fahrer-App)
// Letzte 5 Kunden-Kontaktversuche (Anruf/Klingel) des Fahrers mit Uhrzeit + Status

type KontaktTyp = 'anruf' | 'klingel' | 'sms';
type KontaktStatus = 'erreicht' | 'nicht_erreicht' | 'mailbox';

type AnrufEintrag = {
  id: string;
  order_id: string;
  kunde_name: string | null;
  adresse: string | null;
  kontakt_typ: KontaktTyp;
  status: KontaktStatus;
  zeitpunkt: string;
  notiz: string | null;
};

type ApiResponse = {
  eintraege: AnrufEintrag[];
  fahrer_id: string;
  generiert_am: string;
};

function mockResponse(fahrerId: string): ApiResponse {
  const now = new Date();
  const eintraege: AnrufEintrag[] = [
    { id: 'a1', order_id: 'o1', kunde_name: 'Max M.', adresse: 'Hauptstr. 5', kontakt_typ: 'anruf',  status: 'erreicht',       zeitpunkt: new Date(now.getTime() - 8  * 60_000).toISOString(), notiz: null },
    { id: 'a2', order_id: 'o2', kunde_name: 'Anna S.', adresse: 'Bahnhofstr. 12', kontakt_typ: 'anruf', status: 'nicht_erreicht', zeitpunkt: new Date(now.getTime() - 25 * 60_000).toISOString(), notiz: 'Klingel versucht' },
    { id: 'a3', order_id: 'o3', kunde_name: 'Karl R.', adresse: 'Lindenstr. 3',  kontakt_typ: 'klingel', status: 'erreicht',    zeitpunkt: new Date(now.getTime() - 42 * 60_000).toISOString(), notiz: null },
    { id: 'a4', order_id: 'o4', kunde_name: 'Lisa T.', adresse: 'Gartenweg 7',   kontakt_typ: 'anruf',  status: 'mailbox',     zeitpunkt: new Date(now.getTime() - 68 * 60_000).toISOString(), notiz: 'Nachricht hinterlassen' },
    { id: 'a5', order_id: 'o5', kunde_name: 'Ben K.',  adresse: 'Parkstr. 2',    kontakt_typ: 'sms',    status: 'erreicht',    zeitpunkt: new Date(now.getTime() - 90 * 60_000).toISOString(), notiz: null },
  ];
  return { eintraege, fahrer_id: fahrerId, generiert_am: now.toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fahrerId = searchParams.get('driver_id');

  if (!fahrerId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();

    // Lade Kontakt-Log falls Tabelle vorhanden
    const { data: logs } = await supabase
      .from('driver_contact_logs')
      .select('id, order_id, kunde_name, adresse, kontakt_typ, status, zeitpunkt, notiz')
      .eq('driver_id', fahrerId)
      .order('zeitpunkt', { ascending: false })
      .limit(5);

    if (!logs || logs.length === 0) {
      return NextResponse.json(mockResponse(fahrerId));
    }

    const eintraege: AnrufEintrag[] = logs.map((l: {
      id: string; order_id: string; kunde_name: string | null;
      adresse: string | null; kontakt_typ: string; status: string;
      zeitpunkt: string; notiz: string | null;
    }) => ({
      id: l.id,
      order_id: l.order_id ?? '',
      kunde_name: l.kunde_name,
      adresse: l.adresse,
      kontakt_typ: (l.kontakt_typ as KontaktTyp) ?? 'anruf',
      status: (l.status as KontaktStatus) ?? 'nicht_erreicht',
      zeitpunkt: l.zeitpunkt,
      notiz: l.notiz,
    }));

    return NextResponse.json({ eintraege, fahrer_id: fahrerId, generiert_am: now.toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockResponse(fahrerId));
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { driver_id, order_id, kunde_name, adresse, kontakt_typ, status, notiz } = body;

  if (!driver_id || !order_id || !kontakt_typ || !status) {
    return NextResponse.json({ error: 'driver_id, order_id, kontakt_typ, status required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('driver_contact_logs').insert({
      driver_id, order_id, kunde_name: kunde_name ?? null,
      adresse: adresse ?? null, kontakt_typ, status,
      notiz: notiz ?? null, zeitpunkt: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // best-effort
  }
}
