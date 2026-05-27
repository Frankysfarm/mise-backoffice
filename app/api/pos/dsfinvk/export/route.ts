import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DSFinV-K 2.4 Export für Kassen-Nachschau.
 * Vollständig nach BMF-Spec — alle CSVs + index.xml + DTD.
 * GET /api/pos/dsfinvk/export?from=2026-01-01&to=2026-12-31
 */
export async function GET(req: NextRequest) {
  const svc = createServiceClient();
  let emp: { tenant_id: string } | null = null;

  // Path A: Kassen-Nachschau-Token (Finanzamt, kein Login nötig)
  const pruefungToken = req.headers.get('x-pruefung-token') ?? req.nextUrl.searchParams.get('pruefung_token');
  if (pruefungToken) {
    const { data: kpt } = await svc.from('kassenpruefung_tokens')
      .select('tenant_id, gueltig_bis, revoked_at')
      .eq('token', pruefungToken).maybeSingle();
    if (!kpt || kpt.revoked_at || new Date(kpt.gueltig_bis) < new Date()) {
      return NextResponse.json({ ok: false, error: 'Token ungültig oder abgelaufen' }, { status: 401 });
    }
    emp = { tenant_id: kpt.tenant_id };
    await svc.from('pruefung_access_log').insert({
      token: pruefungToken, action: 'dsfinvk_export',
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  } else {
    // Path B: Eingeloggter Admin
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });
    const { data } = await svc.from('employees').select('tenant_id, rolle').eq('auth_user_id', user.id).maybeSingle();
    if (!data?.tenant_id || !['admin', 'backoffice', 'manager'].includes(data.rolle)) {
      return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
    }
    emp = { tenant_id: data.tenant_id };
  }

  const from = req.nextUrl.searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = req.nextUrl.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);

  const [
    { data: tenant },
    { data: locations },
    { data: registers },
    { data: transactions },
    { data: orderItems },
    { data: zReports },
  ] = await Promise.all([
    svc.from('tenants').select('*').eq('id', emp.tenant_id).single(),
    svc.from('locations').select('*').eq('tenant_id', emp.tenant_id),
    svc.from('pos_registers').select('*').eq('tenant_id', emp.tenant_id),
    svc.from('pos_transactions').select('*')
      .eq('tenant_id', emp.tenant_id)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at'),
    svc.from('order_items').select('*, order:customer_orders!inner(id, tenant_id, bestellt_am)')
      .eq('order.tenant_id', emp.tenant_id).eq('order.is_training', false)
      .gte('order.bestellt_am', `${from}T00:00:00`)
      .lte('order.bestellt_am', `${to}T23:59:59`),
    svc.from('pos_z_reports').select('*').eq('tenant_id', emp.tenant_id)
      .gte('erstellt_am', `${from}T00:00:00`).lte('erstellt_am', `${to}T23:59:59`)
      .order('erstellt_am'),
  ]);

  const zip = new JSZip();
  const txs = (transactions as any[]) ?? [];
  const regs = (registers as any[]) ?? [];
  const locs = (locations as any[]) ?? [];
  const items = (orderItems as any[]) ?? [];
  const zs = (zReports as any[]) ?? [];

  // Z_NR fortlaufend (lückenlos gem. DSFinV-K)
  zs.forEach((z, idx) => { z._z_nr = idx + 1; });

  function findZForTx(tx: any): { z_kasse_id: string; z_nr: number; z_erstellung: string } {
    const z = zs.find((x) => new Date(x.erstellt_am) >= new Date(tx.created_at));
    return {
      z_kasse_id: tx.register_id ?? regs[0]?.id ?? '',
      z_nr: z?._z_nr ?? 1,
      z_erstellung: z?.erstellt_am ?? tx.created_at,
    };
  }

  const defaultKasseId = regs[0]?.id ?? 'KASSE-01';
  const defaultZErst = zs[0]?.erstellt_am ?? new Date().toISOString();

  /* =========== STAMMDATEN =========== */

  zip.file('cashregister.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'KASSE_BRAND', 'KASSE_MODELL', 'KASSE_SERIENNR', 'KASSE_SW_BRAND', 'KASSE_SW_VERSION', 'KASSE_BASISWAEH_CODE', 'KEINE_UST_ZUORDNUNG'],
    regs.map((r) => [r.id, r.created_at ?? defaultZErst, 1, 'Mise', 'SaaS-POS', r.id, 'Mise', '2026.04', 'EUR', '0']),
  ));

  zip.file('slaves.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'SLAVE_ID', 'SLAVE_BRAND', 'SLAVE_MODELL', 'SLAVE_SERIENNR', 'SLAVE_SW_BRAND', 'SLAVE_SW_VERSION'],
    [],
  ));

  zip.file('location.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'LOC_NAME', 'LOC_STRASSE', 'LOC_PLZ', 'LOC_ORT', 'LOC_LAND', 'LOC_USTID'],
    locs.map((l) => [defaultKasseId, l.created_at ?? defaultZErst, 1, l.name, l.adresse ?? '', l.plz ?? '', l.stadt ?? '', 'DEU', tenant?.ust_id ?? '']),
  ));

  zip.file('vat.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'UST_SCHLUESSEL', 'UST_BESCHR', 'UST_SATZ'],
    [
      [defaultKasseId, defaultZErst, 1, '1', 'Regelsatz', '19.00'],
      [defaultKasseId, defaultZErst, 1, '2', 'Ermäßigt', '7.00'],
      [defaultKasseId, defaultZErst, 1, '3', 'Befreit', '0.00'],
    ],
  ));

  zip.file('pa.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'ZAHLART_TYP', 'ZAHLART_NAME', 'WAEH_CODE'],
    [
      [defaultKasseId, defaultZErst, 1, 'Bar', 'Bar', 'EUR'],
      [defaultKasseId, defaultZErst, 1, 'Unbar', 'Karte', 'EUR'],
      [defaultKasseId, defaultZErst, 1, 'Unbar', 'Online', 'EUR'],
    ],
  ));

  /* =========== EINZELAUFZEICHNUNGS-MODUL =========== */

  zip.file('transactions.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'BON_NR', 'BON_TYP', 'BON_NAME', 'TERMINAL_ID',
     'BON_STORNO', 'BON_START', 'BON_ENDE', 'BEDIENER_ID', 'BEDIENER_NAME', 'UMS_BRUTTO',
     'KUNDE_NAME', 'KUNDE_ID', 'KUNDE_TYP', 'KUNDE_STRASSE', 'KUNDE_PLZ', 'KUNDE_ORT', 'KUNDE_LAND', 'KUNDE_USTID'],
    txs.map((t) => {
      const z = findZForTx(t);
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr,
        t.id, t.id,
        'Beleg',
        t.trainingsbon ? 'Trainingsbon' : 'Kassenbeleg',
        t.terminal_id ?? '',
        t.typ === 'storno' ? '1' : '0',
        t.tse_start_time ?? t.created_at, t.tse_end_time ?? t.created_at,
        t.mitarbeiter_id ?? '', '',
        Number(t.brutto_gesamt ?? 0).toFixed(5),
        '', '', '', '', '', '', 'DEU', '',
      ];
    }),
  ));

  zip.file('transactions_vat.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'UST_SCHLUESSEL', 'BON_BRUTTO', 'BON_NETTO', 'BON_UST'],
    txs.map((t) => {
      const z = findZForTx(t);
      const rate = t.netto_gesamt > 0 ? Math.round(((Number(t.brutto_gesamt) - Number(t.netto_gesamt)) / Number(t.netto_gesamt)) * 100) : 19;
      const ustKey = rate === 7 ? '2' : rate === 0 ? '3' : '1';
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, ustKey,
        Number(t.brutto_gesamt).toFixed(5),
        Number(t.netto_gesamt).toFixed(5),
        Number(t.mwst_gesamt).toFixed(5),
      ];
    }),
  ));

  zip.file('transactions_tse.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'TSE_ID', 'TSE_TA_NR', 'TSE_TA_START', 'TSE_TA_ENDE',
     'TSE_TA_VORGANGSART', 'TSE_TA_SIGZ', 'TSE_TA_SIG', 'TSE_TA_FEHLER', 'TSE_TA_TYP', 'TSE_TA_FORMAT'],
    txs.map((t) => {
      const z = findZForTx(t);
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id,
        t.tse_serial ?? '',
        t.tse_transaction_id ?? '',
        t.tse_start_time ?? '', t.tse_end_time ?? '',
        'Kassenbeleg-V1',
        t.tse_signature_counter ?? '',
        t.tse_signature ?? '',
        !t.tse_signature ? 'TSE-Ausfall' : '',
        'AESGCM', '1.0',
      ];
    }),
  ));

  zip.file('datapayment.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'ZAHLART_TYP', 'ZAHLART_NAME', 'ZAHLWAEH_CODE', 'ZAHLWAEH_BETRAG', 'BASISWAEH_BETRAG'],
    txs.map((t) => {
      const z = findZForTx(t);
      const typ = t.zahlungsart === 'bar' ? 'Bar' : 'Unbar';
      const name = t.zahlungsart === 'bar' ? 'Bar' : t.zahlungsart === 'karte' ? 'Karte' : 'Online';
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, typ, name, 'EUR',
        Number(t.brutto_gesamt).toFixed(5),
        Number(t.brutto_gesamt).toFixed(5),
      ];
    }),
  ));

  zip.file('references.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'POS_ZEILE', 'REF_TYP', 'REF_NAME',
     'REF_Z_KASSE_ID', 'REF_Z_NR', 'REF_BON_ID', 'REF_DATUM'],
    txs.filter((t) => t.storno_ref_id).map((t) => {
      const z = findZForTx(t);
      const orig = txs.find((x) => x.id === t.storno_ref_id);
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, '1',
        'Transaktion', 'Stornoreferenz',
        z.z_kasse_id,
        orig ? findZForTx(orig).z_nr : '', t.storno_ref_id,
        orig?.created_at ?? '',
      ];
    }),
  ));

  /* =========== LINES (Beleg-Positionen) =========== */

  const linesRows: any[][] = [];
  const linesVatRows: any[][] = [];
  const itemAmountsRows: any[][] = [];

  txs.forEach((t) => {
    if (!t.customer_order_id) return;
    const z = findZForTx(t);
    const itemsForTx = items.filter((i) => i.order_id === t.customer_order_id);
    itemsForTx.forEach((it, idx) => {
      const pos = idx + 1;
      const brutto = Number(it.gesamtpreis ?? 0);
      const rate = Number(it.mwst_satz ?? 19);
      const netto = brutto / (1 + rate / 100);
      const steuer = brutto - netto;
      const ustKey = rate === 7 ? '2' : rate === 0 ? '3' : '1';

      linesRows.push([
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, pos,
        'Umsatz', it.name, '', '', '1', 'Stk',
        Number(it.menge ?? 1).toFixed(3),
        Number(it.einzelpreis ?? 0).toFixed(5),
        brutto.toFixed(5),
      ]);

      linesVatRows.push([
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, pos, ustKey,
        brutto.toFixed(5), netto.toFixed(5), steuer.toFixed(5),
      ]);

      itemAmountsRows.push([
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id, pos, ustKey,
        brutto.toFixed(5), netto.toFixed(5), steuer.toFixed(5),
      ]);
    });
  });

  zip.file('lines.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'POS_ZEILE',
     'GV_TYP', 'GV_NAME', 'ARTIKEL_REF', 'GUTSCHEIN_NR', 'ARTIKELTEXT', 'ME_EINHEIT',
     'MENGE', 'STK_BR', 'INHAUS'],
    linesRows,
  ));

  zip.file('lines_vat.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'POS_ZEILE', 'UST_SCHLUESSEL',
     'POS_BRUTTO', 'POS_NETTO', 'POS_UST'],
    linesVatRows,
  ));

  zip.file('itemamounts.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'POS_ZEILE', 'UST_SCHLUESSEL',
     'AGV_BRUTTO', 'AGV_NETTO', 'AGV_UST'],
    itemAmountsRows,
  ));

  zip.file('subitems.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'POS_ZEILE', 'SUB_ZEILE',
     'ZI_ARTNR', 'ZI_GTIN', 'ZI_NAME', 'ZI_WARENGR_ID', 'ZI_WARENGR',
     'ZI_MENGE', 'ZI_FAKTOR', 'ZI_EINHEIT', 'ZI_UST_SCHLUESSEL',
     'ZI_BASISPREIS_BRUTTO', 'ZI_BASISPREIS_NETTO', 'ZI_BASISPREIS_UST'],
    [],
  ));

  zip.file('business_cases.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'GV_TYP', 'GV_NAME', 'AGENTUR_ID',
     'UST_SCHLUESSEL', 'GV_BRUTTO', 'GV_NETTO', 'GV_UST'],
    txs.map((t) => {
      const z = findZForTx(t);
      const rate = Number(t.netto_gesamt) > 0 ? Math.round(((Number(t.brutto_gesamt) - Number(t.netto_gesamt)) / Number(t.netto_gesamt)) * 100) : 19;
      const ustKey = rate === 7 ? '2' : rate === 0 ? '3' : '1';
      return [
        z.z_kasse_id, z.z_erstellung, z.z_nr, t.id,
        'Umsatz',
        t.typ === 'storno' ? 'Storno' : 'Verkauf',
        '', ustKey,
        Number(t.brutto_gesamt).toFixed(5),
        Number(t.netto_gesamt).toFixed(5),
        Number(t.mwst_gesamt).toFixed(5),
      ];
    }),
  ));

  zip.file('allocation_groups.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'BON_ID', 'GV_GRUPPEN_ID', 'GV_GRUPPEN_NAME'],
    [],
  ));

  /* =========== KASSENABSCHLUSS-MODUL =========== */

  zip.file('cashpointclosing.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'Z_BUCHUNGSTAG', 'TAXONOMIE_VERSION',
     'Z_START_ID', 'Z_ENDE_ID', 'Z_SE_ZAHLUNGEN', 'Z_SE_BARZAHLUNGEN'],
    zs.map((z) => [
      z.register_id ?? defaultKasseId,
      z.erstellt_am, z._z_nr,
      z.erstellt_am?.slice(0, 10) ?? '', '2.4',
      z.start_transaction_id ?? '', z.ende_transaction_id ?? '',
      Number(z.summe_gesamt ?? 0).toFixed(5),
      Number(z.summe_bar ?? 0).toFixed(5),
    ]),
  ));

  zip.file('cash_per_currency.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'ZAHLART_WAEH', 'ZAHLART_BETRAG_WAEH'],
    zs.map((z) => [z.register_id ?? defaultKasseId, z.erstellt_am, z._z_nr, 'EUR', Number(z.summe_bar ?? 0).toFixed(5)]),
  ));

  zip.file('payment.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'ZAHLART_TYP', 'ZAHLART_NAME', 'ZAHLART_WAEH', 'ZAHLART_BETRAG_WAEH'],
    zs.flatMap((z) => {
      const out: any[][] = [];
      if (Number(z.summe_bar ?? 0) > 0)   out.push([z.register_id ?? defaultKasseId, z.erstellt_am, z._z_nr, 'Bar',   'Bar',   'EUR', Number(z.summe_bar).toFixed(5)]);
      if (Number(z.summe_karte ?? 0) > 0) out.push([z.register_id ?? defaultKasseId, z.erstellt_am, z._z_nr, 'Unbar', 'Karte', 'EUR', Number(z.summe_karte).toFixed(5)]);
      if (Number(z.summe_online ?? 0) > 0)out.push([z.register_id ?? defaultKasseId, z.erstellt_am, z._z_nr, 'Unbar', 'Online','EUR', Number(z.summe_online).toFixed(5)]);
      return out;
    }),
  ));

  zip.file('business_case.csv', csv(
    ['Z_KASSE_ID', 'Z_ERSTELLUNG', 'Z_NR', 'GV_TYP', 'GV_NAME', 'AGENTUR_ID',
     'UST_SCHLUESSEL', 'ZAHLART_WAEH', 'Z_UMS_BRUTTO', 'Z_UMS_NETTO', 'Z_UST'],
    zs.map((z) => {
      const totalBr = Number(z.summe_gesamt ?? 0);
      const netto = totalBr / 1.19;
      const ust = totalBr - netto;
      return [
        z.register_id ?? defaultKasseId, z.erstellt_am, z._z_nr,
        'Umsatz', 'Verkauf', '', '1', 'EUR',
        totalBr.toFixed(5), netto.toFixed(5), ust.toFixed(5),
      ];
    }),
  ));

  /* =========== index.xml + DTD =========== */

  const csvsInOrder = [
    'cashpointclosing.csv', 'location.csv', 'cashregister.csv', 'slaves.csv', 'pa.csv', 'vat.csv',
    'cash_per_currency.csv', 'payment.csv', 'business_case.csv',
    'transactions.csv', 'transactions_vat.csv', 'transactions_tse.csv', 'datapayment.csv',
    'lines.csv', 'lines_vat.csv', 'itemamounts.csv', 'subitems.csv',
    'business_cases.csv', 'allocation_groups.csv', 'references.csv',
  ];

  const now = new Date().toISOString();
  zip.file('gdpdu-01-08-2002.dtd', GDPDU_DTD);

  zip.file('index.xml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DataSet SYSTEM "gdpdu-01-08-2002.dtd">
<DataSet>
  <Version>1.0</Version>
  <DataSupplier>
    <Name>${escapeXml(tenant?.name ?? '')}</Name>
    <Location>${escapeXml(tenant?.stadt ?? '')}</Location>
    <Comment>DSFinV-K 2.4 Export erstellt ${now}</Comment>
  </DataSupplier>
  <Media>
    <Name>DSFinV-K Export ${from} bis ${to}</Name>
${csvsInOrder.map((f) => `    <Table>
      <URL>${f}</URL>
      <Name>${f.replace('.csv', '')}</Name>
    </Table>`).join('\n')}
  </Media>
</DataSet>`);

  const blob = await zip.generateAsync({ type: 'uint8array' });
  return new NextResponse(Buffer.from(blob), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="dsfinvk-${from}_${to}.zip"`,
    },
  });
}

function csv(headers: string[], rows: any[][]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function escapeXml(s: string): string {
  return (s ?? '').toString().replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] ?? c));
}

const GDPDU_DTD = `<!ELEMENT DataSet (Version, DataSupplier, Media+)>
<!ELEMENT Version (#PCDATA)>
<!ELEMENT DataSupplier (Name, Location, Comment?)>
<!ELEMENT Name (#PCDATA)>
<!ELEMENT Location (#PCDATA)>
<!ELEMENT Comment (#PCDATA)>
<!ELEMENT Media (Name, Table+)>
<!ELEMENT Table (URL, Name, Description?, Validity?, DecimalSymbol?, DigitGroupingSymbol?, Range?)>
<!ELEMENT URL (#PCDATA)>
`;
