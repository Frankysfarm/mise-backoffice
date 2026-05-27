/**
 * fiskaly Cloud TSE Integration.
 * Jede pos_transaction muss über `signTransaction()` signiert werden.
 * Fiskaly speichert die Signatur-Daten, wir caches Access-Token kurzzeitig.
 */

import { createServiceClient } from '@/lib/supabase/server';

const FISKALY_BASE = process.env.FISKALY_BASE_URL ?? 'https://kassensichv.io/api/v2';
const tokenCache = new Map<string, { token: string; expires_at: number }>();

async function getAccessToken(apiKey: string, apiSecret: string): Promise<string> {
  const cacheKey = apiKey;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expires_at > Date.now() + 30_000) return cached.token;

  const res = await fetch(`${FISKALY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
  });
  if (!res.ok) throw new Error(`fiskaly Auth: ${res.status} ${await res.text()}`);
  const json = await res.json();
  tokenCache.set(cacheKey, { token: json.access_token, expires_at: Date.now() + (json.expires_in ?? 600) * 1000 });
  return json.access_token;
}

export type SignedTransaction = {
  tse_transaction_id: string;
  tse_signature: string;
  tse_signature_counter: number;
  tse_log_time: string;
  tse_start_time: string;
  tse_end_time: string;
  tse_serial: string;
  qr_code_data: string;
};

type SignInput = {
  tenantId: string;
  bruttoGesamt: number;
  nettoGesamt: number;
  mwstGesamt: number;
  vatRates: Array<{ satz: number; netto: number; brutto: number; steuer: number }>;
  zahlungsart: 'bar' | 'karte' | 'online';
  isStorno?: boolean;
  isTraining?: boolean;
};

export async function signTransaction(input: SignInput): Promise<SignedTransaction | null> {
  const svc = createServiceClient();
  const { data: tenant } = await svc.from('tenants')
    .select('fiskaly_api_key, fiskaly_api_secret, fiskaly_tss_id, fiskaly_client_id')
    .eq('id', input.tenantId).single();

  if (!tenant?.fiskaly_api_key || !tenant.fiskaly_tss_id || !tenant.fiskaly_client_id) {
    // TSE nicht konfiguriert → Ausfall-Log
    await logTSEOutage(input.tenantId, 'TSE nicht eingerichtet');
    return null;
  }

  try {
    const token = await getAccessToken(tenant.fiskaly_api_key, tenant.fiskaly_api_secret);
    const txUuid = crypto.randomUUID();
    const startTime = new Date().toISOString();

    // START
    const startRes = await fetch(`${FISKALY_BASE}/tss/${tenant.fiskaly_tss_id}/tx/${txUuid}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'ACTIVE',
        client_id: tenant.fiskaly_client_id,
      }),
    });
    if (!startRes.ok) throw new Error(`TSE Start: ${startRes.status} ${await startRes.text()}`);

    // FINISH — mit Belegdaten
    // Storno MUSS negative Beträge an fiskaly melden (BSI-TR-03153 / KassenSichV)
    const signMul = input.isStorno ? -1 : 1;
    const signedAmount = (v: number) => (signMul * Math.abs(v)).toFixed(2);

    const payments = [{
      payment_type: mapPayment(input.zahlungsart),
      amount: signedAmount(input.bruttoGesamt),
      currency_code: 'EUR',
    }];
    const amountsPerVatId = input.vatRates.map((v) => ({
      vat_rate: mapVatCode(v.satz),
      amount: signedAmount(v.brutto),
    }));

    const finishRes = await fetch(`${FISKALY_BASE}/tss/${tenant.fiskaly_tss_id}/tx/${txUuid}?last_revision=1`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'FINISHED',
        client_id: tenant.fiskaly_client_id,
        schema: {
          standard_v1: {
            receipt: {
              receipt_type: input.isStorno ? 'RECEIPT' : input.isTraining ? 'RECEIPT' : 'RECEIPT',
              amounts_per_vat_id: amountsPerVatId,
              amounts_per_payment_type: payments,
            },
          },
        },
      }),
    });
    if (!finishRes.ok) throw new Error(`TSE Finish: ${finishRes.status} ${await finishRes.text()}`);
    const result = await finishRes.json();

    return {
      tse_transaction_id: txUuid,
      tse_signature: result?.signature?.value ?? '',
      tse_signature_counter: Number(result?.signature?.counter ?? 0),
      tse_log_time: result?.log?.time_format ?? new Date().toISOString(),
      tse_start_time: startTime,
      tse_end_time: new Date().toISOString(),
      tse_serial: result?.tss_serial_number ?? '',
      qr_code_data: buildQrCode({
        kassenId: tenant.fiskaly_client_id,
        txNr: result?.number ?? 0,
        sigCount: result?.signature?.counter ?? 0,
        start: startTime,
        end: new Date().toISOString(),
        sig: result?.signature?.value ?? '',
        serial: result?.tss_serial_number ?? '',
      }),
    };
  } catch (e) {
    console.error('[TSE] Signierung fehlgeschlagen', e);
    await logTSEOutage(input.tenantId, e instanceof Error ? e.message : 'unknown');
    return null;
  }
}

async function logTSEOutage(tenantId: string, reason: string) {
  const svc = createServiceClient();
  await svc.from('tse_outage_log').insert({ tenant_id: tenantId, reason });
}

function mapPayment(z: 'bar' | 'karte' | 'online'): string {
  switch (z) {
    case 'bar': return 'CASH';
    case 'karte': return 'NON_CASH';
    case 'online': return 'NON_CASH';
  }
}

function mapVatCode(satz: number): 'NORMAL' | 'REDUCED_1' | 'NULL' | 'SPECIAL_RATE_1' | 'SPECIAL_RATE_2' | 'GREAT_REDUCTION' {
  if (satz === 19) return 'NORMAL';
  if (satz === 7) return 'REDUCED_1';
  if (satz === 0) return 'NULL';
  return 'NORMAL';
}

// DSFinV-K / BSI-TR-03153 konformer QR-Inhalt für Beleg
// Format: V0;KassenID;TxNr;Start;Ende;SigCount;Sig;AlgoSerial
function buildQrCode(p: {
  kassenId: string; txNr: number; sigCount: number;
  start: string; end: string; sig: string; serial: string;
}): string {
  return [
    'V0',
    p.kassenId,
    String(p.txNr),
    p.start,
    p.end,
    String(p.sigCount),
    p.sig,
    p.serial,
  ].join(';');
}
