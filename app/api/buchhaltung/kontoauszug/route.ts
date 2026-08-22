import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Tx = { buchungstag: string | null; betrag: number; richtung: 'einnahme' | 'ausgabe'; verwendungszweck: string; gegenpartei: string; import_hash: string };

function parseGermanNumber(s: string): number {
  if (!s) return 0;
  let t = String(s).trim().replace(/\s/g, '').replace(/[€]/g, '');
  // 1.234,56 → 1234.56 ; 1234.56 bleibt
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
function parseDate(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{2})\.(\d{2})\.(\d{2,4})/); // DD.MM.YYYY
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2]}-${m[1]}`; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function hashRow(parts: string[]): string {
  const s = parts.join('|');
  let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'h' + (h >>> 0).toString(36);
}

// ── CSV (flexible deutsche Bank-Exporte) ──
function parseCsv(text: string): Tx[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const lines = clean.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (l: string) => l.split(delim).map((c) => c.replace(/^"|"$/g, '').trim());
  // Header-Zeile finden (enthält Datum/Betrag-Spalte)
  let hi = lines.findIndex((l) => /buchung|datum|betrag|valuta/i.test(l));
  if (hi < 0) hi = 0;
  const head = split(lines[hi]).map((h) => h.toLowerCase());
  // Priorität: exakter Treffer > startsWith > includes — verhindert dass "buchungstext" die "buchungstag"-Spalte klaut
  const col = (...keys: string[]) => {
    for (const k of keys) { const i = head.findIndex((h) => h === k); if (i >= 0) return i; }
    for (const k of keys) { const i = head.findIndex((h) => h.startsWith(k)); if (i >= 0) return i; }
    for (const k of keys) { const i = head.findIndex((h) => h.includes(k)); if (i >= 0) return i; }
    return -1;
  };
  const iDate = col('buchungstag', 'buchungsdatum', 'valutadatum', 'valuta', 'datum');
  const iAmt = col('betrag', 'umsatz', 'amount');
  const iZweck = col('verwendungszweck', 'vwz', 'buchungstext', 'beschreibung', 'description');
  const iName = col('beguenstigter', 'begünstigter', 'zahlungspflichtiger', 'name', 'auftraggeber', 'empfänger', 'empfaenger');
  const out: Tx[] = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const c = split(lines[i]);
    if (c.length < 2) continue;
    const betrag = iAmt >= 0 ? parseGermanNumber(c[iAmt]) : 0;
    if (!betrag) continue;
    out.push({
      buchungstag: iDate >= 0 ? parseDate(c[iDate]) : null,
      betrag: Math.abs(betrag),
      richtung: betrag < 0 ? 'ausgabe' : 'einnahme',
      verwendungszweck: iZweck >= 0 ? (c[iZweck] || '') : '',
      gegenpartei: iName >= 0 ? (c[iName] || '') : '',
      import_hash: hashRow(c),
    });
  }
  return out;
}

// ── CAMT.053 (SEPA XML) ──
function parseCamt(xml: string): Tx[] {
  const out: Tx[] = [];
  const entries = xml.match(/<Ntry>[\s\S]*?<\/Ntry>/g) ?? [];
  for (const e of entries) {
    const amt = parseFloat(e.match(/<Amt[^>]*>([\d.]+)<\/Amt>/)?.[1] ?? '0');
    const dbit = /<CdtDbtInd>\s*DBIT\s*<\/CdtDbtInd>/.test(e);
    const date = e.match(/<BookgDt>[\s\S]*?<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/)?.[1] ?? e.match(/<ValDt>[\s\S]*?<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/)?.[1] ?? null;
    const zweck = (e.match(/<Ustrd>([\s\S]*?)<\/Ustrd>/g) ?? []).map((u) => u.replace(/<\/?Ustrd>/g, '')).join(' ').trim();
    const name = e.match(/<RltdPties>[\s\S]*?<Nm>([\s\S]*?)<\/Nm>/)?.[1]?.trim() ?? '';
    if (!amt) continue;
    out.push({ buchungstag: date, betrag: Math.abs(amt), richtung: dbit ? 'ausgabe' : 'einnahme', verwendungszweck: zweck, gegenpartei: name, import_hash: hashRow([date ?? '', String(amt), zweck, name]) });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  const { data: emp } = await supabase.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 });
  const text = await file.text();
  let tx: Tx[] = [];
  try {
    if (/<\?xml|<Document/i.test(text.slice(0, 400))) tx = parseCamt(text);
    else tx = parseCsv(text);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Parse-Fehler' }, { status: 500 });
  }
  if (!tx.length) return NextResponse.json({ error: 'Keine Buchungen erkannt. Unterstützt: CSV (Sparkasse/Volksbank/N26/…) oder CAMT.053-XML.' }, { status: 422 });
  return NextResponse.json({ transactions: tx.slice(0, 1000), count: tx.length });
}
