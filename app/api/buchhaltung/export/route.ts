import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Deutsche Zahl mit Komma (für Excel/Buchhaltung)
const de = (n: unknown) => Number(n ?? 0).toFixed(2).replace('.', ',');
const cell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const BOM = '﻿'; // Excel-UTF-8

function monthRange(monat: string) {
  const [y, m] = monat.split('-').map(Number);
  const start = `${monat}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // 1. des Folgemonats
  return { start, end };
}

function sanitize(s: string) {
  return (s || 'beleg').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'beleg';
}

export async function GET(req: NextRequest) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 });

  const url = new URL(req.url);
  const monat = (url.searchParams.get('monat') || new Date().toISOString().slice(0, 7)).slice(0, 7);
  const format = url.searchParams.get('format') || 'zip';
  if (!/^\d{4}-\d{2}$/.test(monat)) return NextResponse.json({ error: 'Ungültiger Monat (YYYY-MM).' }, { status: 400 });
  const { start, end } = monthRange(monat);
  const sb = createServiceClient();

  const [{ data: tenant }, { data: belege }, { data: banktx }, { data: items }] = await Promise.all([
    sb.from('tenants').select('name').eq('id', emp.tenant_id).maybeSingle(),
    sb.from('belege').select('id, datum, haendler, rechnungsnummer, zahlungsart, kategorie, betrag_brutto, mwst_satz, mwst_betrag, netto, beleg_url, notiz')
      .eq('tenant_id', emp.tenant_id).gte('datum', start).lt('datum', end).order('datum'),
    sb.from('bank_transactions').select('buchungstag, richtung, betrag, gegenpartei, verwendungszweck, matched_auto, beleg_id, quelle')
      .eq('tenant_id', emp.tenant_id).gte('buchungstag', start).lt('buchungstag', end).order('buchungstag'),
    sb.from('order_items').select('gesamtpreis, mwst_satz, order:customer_orders!inner(tenant_id, status, created_at)')
      .eq('order.tenant_id', emp.tenant_id).gte('order.created_at', start).lt('order.created_at', end + 'T00:00:00').neq('order.status', 'storniert').limit(20000),
  ]);

  const bl = belege ?? [];
  const tx = banktx ?? [];
  const betrieb = tenant?.name ?? 'Restaurant';

  // ── GuV/USt — identische Logik wie das Backoffice-Dashboard ──
  let b7 = 0, b19 = 0;
  for (const it of (items ?? []) as any[]) {
    let m = Number(it.mwst_satz ?? 19); if (m < 1) m = m * 100;
    const v = Number(it.gesamtpreis ?? 0);
    if (m >= 19) b19 += v; else b7 += v;
  }
  const tax7 = b7 - b7 / 1.07, tax19 = b19 - b19 / 1.19;
  const umsatzBrutto = b7 + b19, umsatzUSt = tax7 + tax19;
  const ausgabenBrutto = bl.reduce((s, b) => s + Number(b.betrag_brutto || 0), 0);
  const vorsteuer = bl.reduce((s, b) => s + Number(b.mwst_betrag || 0), 0);
  const netto = umsatzBrutto - umsatzUSt;
  const ustZahllast = umsatzUSt - vorsteuer;
  const gewinn = netto - (ausgabenBrutto - vorsteuer);

  // ── CSV-Bausteine ──
  const belegeCsv = BOM + [
    ['Datum', 'Händler', 'Rechnungsnr', 'Kategorie', 'Zahlungsart', 'Brutto', 'MwSt-Satz', 'MwSt-Betrag', 'Netto', 'Beleg-Datei'].map(cell).join(';'),
    ...bl.map((b) => [b.datum ?? '', b.haendler ?? '', b.rechnungsnummer ?? '', b.kategorie ?? '', b.zahlungsart ?? '',
      de(b.betrag_brutto), `${Number(b.mwst_satz ?? 0)}%`, de(b.mwst_betrag), de(b.netto), b.beleg_url ? 'ja' : 'nein'].map(cell).join(';')),
  ].join('\r\n');

  const bankCsv = BOM + [
    ['Buchungstag', 'Richtung', 'Betrag', 'Gegenpartei', 'Verwendungszweck', 'Beleg zugeordnet', 'Quelle'].map(cell).join(';'),
    ...tx.map((t) => [t.buchungstag ?? '', t.richtung ?? '', de(t.betrag), t.gegenpartei ?? '', t.verwendungszweck ?? '',
      t.beleg_id ? 'ja' : 'nein', t.quelle ?? ''].map(cell).join(';')),
  ].join('\r\n');

  const summaryCsv = BOM + [
    ['Zusammenfassung', betrieb].map(cell).join(';'),
    ['Zeitraum', `${start} bis ${end} (exkl.)`].map(cell).join(';'),
    [].join(';'),
    ['Posten', 'Betrag (EUR)'].map(cell).join(';'),
    ['Umsatz brutto', de(umsatzBrutto)].map(cell).join(';'),
    ['  davon Speisen (7%)', de(b7)].map(cell).join(';'),
    ['  davon Getränke/vor Ort (19%)', de(b19)].map(cell).join(';'),
    ['enthaltene USt 7%', de(tax7)].map(cell).join(';'),
    ['enthaltene USt 19%', de(tax19)].map(cell).join(';'),
    ['Umsatzsteuer gesamt', de(umsatzUSt)].map(cell).join(';'),
    ['Ausgaben brutto (Belege)', de(ausgabenBrutto)].map(cell).join(';'),
    ['Vorsteuer (Belege)', de(vorsteuer)].map(cell).join(';'),
    ['USt-Zahllast (Umsatz-USt − Vorsteuer)', de(ustZahllast)].map(cell).join(';'),
    ['Gewinn (Netto-Umsatz − Netto-Ausgaben)', de(gewinn)].map(cell).join(';'),
    [].join(';'),
    ['Anzahl Belege', String(bl.length)].map(cell).join(';'),
    ['Anzahl Bankbuchungen', String(tx.length)].map(cell).join(';'),
  ].join('\r\n');

  // ── Direkte CSV-Downloads ──
  if (format === 'belege-csv' || format === 'bank-csv') {
    const body = format === 'belege-csv' ? belegeCsv : bankCsv;
    const fname = `${format === 'belege-csv' ? 'belege' : 'bankbuchungen'}-${betrieb.replace(/[^a-zA-Z0-9]+/g, '_')}-${monat}.csv`;
    return new NextResponse(body, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fname}"` },
    });
  }

  // ── Komplett-Paket als ZIP ──
  const zip = new JSZip();
  const fehlendeBelege = tx.filter((t) => t.richtung === 'ausgabe' && !t.beleg_id).length;

  zip.file('00_LIESMICH.txt',
`Vorbereitende Buchhaltung — ${betrieb}
Zeitraum: ${start} bis ${end} (exklusiv), Monat ${monat}
Erstellt: ${new Date().toLocaleString('de-DE')}

Inhalt:
  01_Zusammenfassung.csv   Umsatz, Umsatzsteuer, Ausgaben, Vorsteuer, USt-Zahllast, Gewinn
  02_Belege.csv            Alle erfassten Belege/Ausgaben des Monats (${bl.length})
  03_Bankbuchungen.csv     Alle Bankbuchungen des Monats (${tx.length})
  Belege/                  Die Original-Belegdateien (Foto/PDF), sofern vorhanden

Hinweis: Dies ist eine VORBEREITENDE Auswertung aus dem Kassen-/Shop-System.
Die endgültige Verbuchung und Steuerberechnung nimmt der Steuerberater vor.
${fehlendeBelege > 0 ? `\nACHTUNG: ${fehlendeBelege} Bankausgabe(n) ohne zugeordneten Beleg — bitte Belege nachreichen.` : ''}
`);
  zip.file('01_Zusammenfassung.csv', summaryCsv);
  zip.file('02_Belege.csv', belegeCsv);
  zip.file('03_Bankbuchungen.csv', bankCsv);

  // Original-Belegdateien aus dem Storage einsammeln (best effort)
  const belegeMitDatei = bl.filter((b) => b.beleg_url);
  let dateienOk = 0;
  for (const b of belegeMitDatei) {
    try {
      const { data: file } = await sb.storage.from('belege').download(b.beleg_url as string);
      if (!file) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = (b.beleg_url as string).split('.').pop()?.slice(0, 5) || 'bin';
      const name = `Belege/${(b.datum ?? 'ohne-datum')}_${sanitize(b.haendler ?? 'beleg')}_${(b.id as string).slice(0, 8)}.${ext}`;
      zip.file(name, buf);
      dateienOk++;
    } catch { /* einzelne Datei darf den Export nicht stoppen */ }
  }
  if (belegeMitDatei.length > 0) {
    zip.file('Belege/_INFO.txt', `${dateienOk} von ${belegeMitDatei.length} Belegdateien exportiert.`);
  }

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fname = `Steuerberater_${betrieb.replace(/[^a-zA-Z0-9]+/g, '_')}_${monat}.zip`;
  return new NextResponse(out, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Content-Length': String(out.length),
    },
  });
}
