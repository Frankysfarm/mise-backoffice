import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { signTransaction } from '@/lib/pos/tse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POS-Transaktion anlegen — mit automatischer TSE-Signierung.
 * Body: {
 *   tenant_id, location_id, register_id, terminal_id, shift_id,
 *   typ: 'verkauf'|'storno'|'einlage'|'entnahme',
 *   brutto_gesamt, netto_gesamt, mwst_gesamt, vat_rates: [{ satz, netto, brutto, steuer }],
 *   zahlungsart: 'bar'|'karte'|'online',
 *   customer_order_id?, tisch_id?, mitarbeiter_id
 * }
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json();
  const svc = createServiceClient();

  const { data: emp } = await svc.from('employees').select('id, tenant_id').eq('auth_user_id', user.id).maybeSingle();
  if (!emp || emp.tenant_id !== body.tenant_id) {
    return NextResponse.json({ ok: false, error: 'Kein Zugriff' }, { status: 403 });
  }

  // TSE-Signierung — nur für Kassenvorfälle im Sinne KassenSichV.
  // Einlage / Entnahme / Tagesabschluss sind separat und werden nicht TSE-signiert.
  const tseTypes = ['verkauf', 'storno', 'teil_storno'];
  const txTyp = body.typ ?? 'verkauf';
  let tse = null;
  if (tseTypes.includes(txTyp)) {
    try {
      tse = await signTransaction({
        tenantId: body.tenant_id,
        bruttoGesamt: body.brutto_gesamt,
        nettoGesamt: body.netto_gesamt,
        mwstGesamt: body.mwst_gesamt,
        vatRates: body.vat_rates ?? [{
          satz: 19,
          brutto: body.brutto_gesamt,
          netto: body.netto_gesamt,
          steuer: body.mwst_gesamt,
        }],
        zahlungsart: body.zahlungsart,
        isStorno: body.typ === 'storno' || body.typ === 'teil_storno',
        isTraining: body.trainingsbon === true,
      });
    } catch (e) {
      console.error('[TSE]', e);
    }
  }

  const { data: tx, error } = await svc.from('pos_transactions').insert({
    tenant_id: body.tenant_id,
    location_id: body.location_id,
    register_id: body.register_id,
    terminal_id: body.terminal_id,
    shift_id: body.shift_id,
    customer_order_id: body.customer_order_id,
    tisch_id: body.tisch_id,
    typ: body.typ ?? 'verkauf',
    mitarbeiter_id: body.mitarbeiter_id ?? emp.id,
    brutto_gesamt: body.brutto_gesamt,
    netto_gesamt: body.netto_gesamt,
    mwst_gesamt: body.mwst_gesamt,
    zahlungsart: body.zahlungsart,
    bezahlt_betrag: body.brutto_gesamt,
    trainingsbon: body.trainingsbon ?? false,
    // TSE-Felder (KassenSichV § 146a Abs. 3 — alle Pflichtfelder)
    tse_transaction_id: tse?.tse_transaction_id ?? null,
    tse_signature: tse?.tse_signature ?? null,
    tse_signature_counter: tse?.tse_signature_counter ?? null,
    tse_start_time: tse?.tse_start_time ?? null,
    tse_end_time: tse?.tse_end_time ?? null,
    tse_serial: tse?.tse_serial ?? null,
    qr_code_data: tse?.qr_code_data ?? null,
  }).select('id, bon_token').single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    transaction_id: tx.id,
    bon_token: tx.bon_token,
    tse_active: !!tse,
    tse_qr: tse?.qr_code_data,
  });
}
