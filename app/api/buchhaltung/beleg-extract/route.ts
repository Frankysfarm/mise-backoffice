import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-6';
const KATEGORIEN = ['Wareneinsatz', 'Getränke', 'Personal', 'Miete', 'Energie', 'Marketing', 'Fahrzeugkosten', 'Reparatur', 'Büro', 'Sonstiges'];

const SYSTEM = `Du bist ein Buchhaltungs-Assistent für deutsche Gastronomie. Du liest Belege/Kassenbons/Rechnungen aus Fotos und gibst strukturierte Daten zurück.
Erkenne: Händler/Lieferant, Belegdatum, Rechnungs-/Belegnummer, Netto, Steuerbetrag, Brutto-Gesamtbetrag, MwSt-Satz (meist 7 oder 19), Zahlungsart (bar/karte/ueberweisung/lastschrift/paypal), und ordne eine Ausgaben-Kategorie zu aus: ${KATEGORIEN.join(', ')}.
Buchungsvorschlag-Regeln (Händler → Kategorie): Metro/Selgros/Großmarkt/Bäcker/Rewe/Edeka → Wareneinsatz · Getränkemarkt/Brauerei → Getränke · Tankstelle/Aral/Shell/DKV → Fahrzeugkosten · Amazon/Bürobedarf/Staples → Büro · Stadtwerke/Strom/Gas → Energie · Facebook/Google/Flyer/Druckerei → Marketing.
- Mehrere MwSt-Sätze: nimm den höheren Hauptsatz. Unklar: 19.
- Datum YYYY-MM-DD. Beträge als Zahl mit Punkt (z. B. 47.90). rechnungsnummer = null falls keine.
Antworte AUSSCHLIESSLICH mit gültigem JSON, kein Markdown:
{"haendler": string, "datum": "YYYY-MM-DD"|null, "rechnungsnummer": string|null, "betrag_brutto": number, "mwst_satz": 7|19|0, "zahlungsart": string|null, "kategorie": string, "confidence": number}`;

function inferMediaType(type: string, name: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (type.includes('png') || name.toLowerCase().endsWith('.png')) return 'image/png';
  if (type.includes('webp') || name.toLowerCase().endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'KI nicht konfiguriert (ANTHROPIC_API_KEY fehlt).' }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  const { data: emp } = await supabase.from('employees').select('tenant_id, location_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const mediaType = inferMediaType((file as File).type, (file as File).name ?? '');

  // 1) KI-Extraktion
  let extracted: any;
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
        { type: 'text', text: 'Lies diesen Beleg aus und gib das JSON zurück.' },
      ] }],
    });
    const text = res.content.find((b: any) => b.type === 'text')?.text ?? '{}';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    extracted = JSON.parse(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'KI-Fehler' }, { status: 500 });
  }

  // 2) Beleg-Bild speichern (privater Bucket, GoBD: Original behalten)
  let beleg_url: string | null = null;
  try {
    const svc = createServiceClient();
    const ext = mediaType.split('/')[1];
    const path = `${emp.tenant_id}/${Date.now()}.${ext}`;
    const { error: upErr } = await svc.storage.from('belege').upload(path, buf, { contentType: mediaType, upsert: false });
    if (!upErr) beleg_url = path;
  } catch { /* Bild-Upload optional — Extraktion zählt */ }

  const brutto = Number(extracted?.betrag_brutto) || 0;
  const satz = [0, 7, 19].includes(Number(extracted?.mwst_satz)) ? Number(extracted.mwst_satz) : 19;
  const mwst = satz > 0 ? brutto - brutto / (1 + satz / 100) : 0;
  const kategorie = KATEGORIEN.includes(extracted?.kategorie) ? extracted.kategorie : 'Sonstiges';

  return NextResponse.json({
    haendler: extracted?.haendler ?? '',
    datum: extracted?.datum ?? null,
    rechnungsnummer: extracted?.rechnungsnummer ?? '',
    betrag_brutto: brutto,
    mwst_satz: satz,
    mwst_betrag: Math.round(mwst * 100) / 100,
    netto: Math.round((brutto - mwst) * 100) / 100,
    zahlungsart: extracted?.zahlungsart ?? '',
    kategorie,
    confidence: Number(extracted?.confidence) || 0.7,
    beleg_url,
  });
}
