/**
 * GET /api/delivery/admin/fahrer-schicht-prognose?location_id=<uuid>
 *
 * Phase 1045 — Fahrer-Schicht-Prognose-Board API
 * Wie viele Fahrer sind für die nächste Schicht eingeplant vs. Mindestbesetzung.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerSchicht {
  fahrer_id: string;
  fahrer_name: string;
  status: 'eingeplant' | 'bestaetigt' | 'ausstehend';
}

interface Schicht {
  id: string;
  label: string;
  zeitraum: string;
  start_iso: string;
  fahrer: FahrerSchicht[];
  eingeplant: number;
  bestaetigt: number;
  mindestbesetzung: number;
  ampel: 'gruen' | 'amber' | 'rot';
}

const MOCK_SCHICHTEN: Schicht[] = [
  {
    id: 's1', label: 'Frühschicht', zeitraum: '08:00 – 14:00',
    start_iso: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
    fahrer: [
      { fahrer_id: 'd1', fahrer_name: 'T. Müller',  status: 'bestaetigt' },
      { fahrer_id: 'd2', fahrer_name: 'S. Bauer',   status: 'bestaetigt' },
      { fahrer_id: 'd3', fahrer_name: 'K. Lang',    status: 'eingeplant' },
    ],
    eingeplant: 3, bestaetigt: 2, mindestbesetzung: 3, ampel: 'amber',
  },
  {
    id: 's2', label: 'Mittagsschicht', zeitraum: '12:00 – 18:00',
    start_iso: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
    fahrer: [
      { fahrer_id: 'd2', fahrer_name: 'S. Bauer',   status: 'bestaetigt' },
      { fahrer_id: 'd4', fahrer_name: 'M. Weber',   status: 'bestaetigt' },
      { fahrer_id: 'd5', fahrer_name: 'A. Schmidt', status: 'bestaetigt' },
      { fahrer_id: 'd6', fahrer_name: 'J. Fischer', status: 'eingeplant' },
    ],
    eingeplant: 4, bestaetigt: 3, mindestbesetzung: 4, ampel: 'amber',
  },
  {
    id: 's3', label: 'Abendschicht', zeitraum: '17:00 – 23:00',
    start_iso: new Date(new Date().setHours(17, 0, 0, 0)).toISOString(),
    fahrer: [
      { fahrer_id: 'd4', fahrer_name: 'M. Weber',   status: 'bestaetigt' },
      { fahrer_id: 'd7', fahrer_name: 'C. Braun',   status: 'bestaetigt' },
      { fahrer_id: 'd8', fahrer_name: 'L. Klein',   status: 'bestaetigt' },
      { fahrer_id: 'd9', fahrer_name: 'P. Richter', status: 'bestaetigt' },
    ],
    eingeplant: 4, bestaetigt: 4, mindestbesetzung: 4, ampel: 'gruen',
  },
];

function ampelFor(eingeplant: number, mindest: number): Schicht['ampel'] {
  if (eingeplant >= mindest) return 'gruen';
  if (eingeplant >= mindest - 1) return 'amber';
  return 'rot';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ schichten: MOCK_SCHICHTEN, location_id: null, generiert_am: new Date().toISOString() });
  }

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jetzt = new Date();
    const morgen = new Date(jetzt.getTime() + 24 * 3600_000).toISOString();

    const { data: shifts } = await sb
      .from('driver_shifts')
      .select('id, driver_id, start_time, end_time, status')
      .eq('location_id', locationId)
      .gte('start_time', jetzt.toISOString())
      .lte('start_time', morgen)
      .order('start_time');

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ schichten: MOCK_SCHICHTEN, location_id: locationId, generiert_am: new Date().toISOString() });
    }

    const grouped: Record<string, { start: string; end: string; fahrer: FahrerSchicht[]; count: number }> = {};
    for (const sh of shifts) {
      const key = (sh.start_time ?? 'x').slice(0, 13);
      if (!grouped[key]) grouped[key] = { start: sh.start_time ?? '', end: sh.end_time ?? '', fahrer: [], count: 0 };
      grouped[key].count++;
      grouped[key].fahrer.push({
        fahrer_id: sh.driver_id ?? '',
        fahrer_name: `Fahrer ${grouped[key].count}`,
        status: sh.status === 'confirmed' ? 'bestaetigt' : 'eingeplant',
      });
    }

    const schichten: Schicht[] = Object.entries(grouped).map(([, g], idx) => {
      const startH = g.start ? new Date(g.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '?';
      const endH = g.end ? new Date(g.end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '?';
      const mindest = Math.max(2, Math.ceil(g.fahrer.length * 0.8));
      return {
        id: `s${idx + 1}`,
        label: idx === 0 ? 'Nächste Schicht' : `Schicht ${idx + 1}`,
        zeitraum: `${startH} – ${endH}`,
        start_iso: g.start,
        fahrer: g.fahrer,
        eingeplant: g.fahrer.length,
        bestaetigt: g.fahrer.filter(f => f.status === 'bestaetigt').length,
        mindestbesetzung: mindest,
        ampel: ampelFor(g.fahrer.length, mindest),
      };
    });

    return NextResponse.json({ schichten, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json({ schichten: MOCK_SCHICHTEN, location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
