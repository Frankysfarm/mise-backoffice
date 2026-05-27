/**
 * APNs VoIP-Push Sender (PushKit) — HTTP/2 mit Certificate-Auth.
 *
 * Phase 4 (2026-05-06): VoIP-Pushes für die Mise Driver App.
 * Apple APNs spricht ausschließlich HTTP/2 — daher node:http2 statt node:https.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import * as http2 from 'node:http2';

interface VoipPayload {
  reason_text?: string;
  batch_id: string;
  order_count: number;
  restaurant_name: string;
  distance_km?: number | null;
  payout_eur?: number | null;
  decision_id?: string;
}

export interface VoipSendResult {
  ok: boolean;
  status?: number;
  apnsId?: string;
  tokenDead?: boolean;
  error?: string;
}

let _pfx: Buffer | null = null;
let _pass: string | null = null;

function getCert(): { pfx: Buffer; passphrase: string } {
  if (_pfx && _pass) return { pfx: _pfx, passphrase: _pass };
  const path = process.env.APNS_VOIP_P12_PATH;
  const pass = process.env.APNS_VOIP_P12_PASS;
  if (!path || !pass) throw new Error('APNS_VOIP_P12_PATH/PASS fehlen');
  _pfx = readFileSync(path);
  _pass = pass;
  return { pfx: _pfx, passphrase: _pass };
}

function host(): string {
  return process.env.APNS_VOIP_PRODUCTION === 'true'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

function topic(): string {
  return process.env.APNS_VOIP_TOPIC ?? 'app.mise.driver.voip';
}

export async function sendVoipPush(
  deviceToken: string,
  payload: VoipPayload,
): Promise<VoipSendResult> {
  const body = JSON.stringify({ aps: { 'content-available': 1 }, ...payload });
  let lastErr: VoipSendResult | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await sendOnce(deviceToken, body);
    if (r.ok) return r;
    if (r.tokenDead) return r;
    if (r.status && r.status >= 400 && r.status < 500) return r;
    lastErr = r;
    if (attempt < 3) await sleep(1000 * Math.pow(2, attempt - 1));
  }
  return lastErr ?? { ok: false, error: 'unknown' };
}

function sendOnce(deviceToken: string, body: string): Promise<VoipSendResult> {
  return new Promise((resolve) => {
    const cert = getCert();
    let resolved = false;
    const finish = (r: VoipSendResult) => {
      if (resolved) return;
      resolved = true;
      try { client.close(); } catch { /* noop */ }
      resolve(r);
    };

    const client = http2.connect(host(), {
      pfx: cert.pfx,
      passphrase: cert.passphrase,
    });

    client.on('error', (e: NodeJS.ErrnoException) => {
      finish({ ok: false, error: `connect: ${e.message}` });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'apns-topic': topic(),
      'apns-push-type': 'voip',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    });

    req.setTimeout(8000, () => {
      req.close();
      finish({ ok: false, error: 'timeout' });
    });

    let status = 0;
    let apnsId: string | undefined;
    const chunks: Buffer[] = [];

    req.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
      apnsId = (headers['apns-id'] as string | undefined) ?? undefined;
    });
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const respBody = Buffer.concat(chunks).toString('utf8');
      if (status === 200) {
        finish({ ok: true, status, apnsId });
        return;
      }
      let reason: string | undefined;
      try {
        reason = (JSON.parse(respBody) as { reason?: string }).reason;
      } catch { /* not JSON */ }
      const tokenDead =
        status === 410 ||
        reason === 'BadDeviceToken' ||
        reason === 'Unregistered' ||
        reason === 'DeviceTokenNotForTopic';
      finish({ ok: false, status, apnsId, tokenDead, error: reason ?? `apns ${status}` });
    });
    req.on('error', (e: NodeJS.ErrnoException) => {
      finish({ ok: false, error: `req: ${e.message}` });
    });

    req.write(body);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
