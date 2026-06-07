/**
 * APNs Alert-Push Sender (Standard Notifications) — HTTP/2 mit Token-Auth (.p8 Key).
 *
 * 2026-06-07: Für die Capacitor-Mise-Driver-App. Capacitor liefert ROHE APNs-Device-Tokens
 * (kein Expo-Token), daher braucht es echten APNs-Versand. Token-Auth (.p8) statt Cert:
 * EIN Key (kid/iss) gilt für ALLE Topics + läuft nicht ab wie ein Zertifikat.
 *
 * Aktivierung (einmalig, Apple Developer → Keys → "+" → Apple Push Notifications service):
 *   - .p8-Key herunterladen → auf Server legen
 *   - ENV: APNS_KEY_P8_PATH=/opt/mise/secrets/apns-key.p8
 *          APNS_KEY_ID=<10-stellige Key-ID>
 *          APNS_TEAM_ID=T82KC2CU9V
 *          APNS_BUNDLE_ID=app.mise.driver        (default)
 *          APNS_PRODUCTION=true                    (TestFlight + App Store = production APNs)
 * Solange ENV fehlt, ist isApnsAlertConfigured()=false und push-flush überspringt den Alert-Pfad.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import * as http2 from 'node:http2';
import { createSign } from 'node:crypto';

export interface AlertPayload {
  title: string;
  body: string;
  sound?: string | null;
  badge?: number;
  /** beliebige Zusatzdaten (z.B. batch_id) — landen unter aps-fremden Keys */
  data?: Record<string, unknown>;
}

export interface AlertSendResult {
  ok: boolean;
  status?: number;
  apnsId?: string;
  tokenDead?: boolean;
  error?: string;
}

export function isApnsAlertConfigured(): boolean {
  return Boolean(process.env.APNS_KEY_P8_PATH && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
}

function host(): string {
  return process.env.APNS_PRODUCTION === 'true'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

function bundleId(): string {
  return process.env.APNS_BUNDLE_ID ?? 'app.mise.driver';
}

let _p8: string | null = null;
function getKey(): string {
  if (_p8) return _p8;
  const path = process.env.APNS_KEY_P8_PATH;
  if (!path) throw new Error('APNS_KEY_P8_PATH fehlt');
  _p8 = readFileSync(path, 'utf8');
  return _p8;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// APNs-JWT (ES256) — gecacht ~50 Min (Apple verlangt Erneuerung < 60 Min, > 20 Min).
let _jwt: { token: string; iat: number } | null = null;
function getJwt(): string {
  const nowSec = Math.floor(Date.now() / 1000);
  if (_jwt && nowSec - _jwt.iat < 3000) return _jwt.token;
  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: nowSec }));
  const signingInput = `${header}.${claims}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  // APNs erwartet JOSE-Signatur (rohe R||S), nicht DER → dsaEncoding ieee-p1363.
  const sig = signer.sign({ key: getKey(), dsaEncoding: 'ieee-p1363' });
  const token = `${signingInput}.${b64url(sig)}`;
  _jwt = { token, iat: nowSec };
  return token;
}

export async function sendAlertPush(deviceToken: string, payload: AlertPayload): Promise<AlertSendResult> {
  if (!isApnsAlertConfigured()) return { ok: false, error: 'apns-alert nicht konfiguriert' };

  const aps: Record<string, unknown> = {
    alert: { title: payload.title, body: payload.body },
    sound: payload.sound ?? 'default',
  };
  if (typeof payload.badge === 'number') aps.badge = payload.badge;
  const body = JSON.stringify({ aps, ...(payload.data ?? {}) });

  let lastErr: AlertSendResult | null = null;
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

function sendOnce(deviceToken: string, body: string): Promise<AlertSendResult> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (r: AlertSendResult) => {
      if (resolved) return;
      resolved = true;
      try { client.close(); } catch { /* noop */ }
      resolve(r);
    };

    const client = http2.connect(host());
    client.on('error', (e: NodeJS.ErrnoException) => finish({ ok: false, error: `connect: ${e.message}` }));

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${getJwt()}`,
      'apns-topic': bundleId(),
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    });

    req.setTimeout(8000, () => { req.close(); finish({ ok: false, error: 'timeout' }); });

    let status = 0;
    let apnsId: string | undefined;
    const chunks: Buffer[] = [];
    req.on('response', (h) => {
      status = Number(h[':status']) || 0;
      apnsId = (h['apns-id'] as string | undefined) ?? undefined;
    });
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (status === 200) { finish({ ok: true, status, apnsId }); return; }
      let reason: string | undefined;
      try { reason = (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { reason?: string }).reason; } catch { /* not JSON */ }
      const tokenDead = status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic';
      finish({ ok: false, status, apnsId, tokenDead, error: reason ?? `apns ${status}` });
    });
    req.on('error', (e: NodeJS.ErrnoException) => finish({ ok: false, error: `req: ${e.message}` }));
    req.write(body);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
