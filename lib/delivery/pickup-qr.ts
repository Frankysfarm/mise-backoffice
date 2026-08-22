import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'MISE:PICKUP:v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PickupQr = {
  orderId: string;
  bagIndex: number;
  payload: string;
  fallbackCode: string;
};

function pickupSecret(): string {
  const secret = process.env.DELIVERY_PICKUP_QR_SECRET?.trim()
    || process.env.DRIVER_OTP_SECRET?.trim();
  if (!secret) throw new Error('DELIVERY_PICKUP_QR_SECRET or DRIVER_OTP_SECRET is required');
  return secret;
}

function signature(orderId: string, bagIndex: number): string {
  return createHmac('sha256', pickupSecret())
    .update(`${PREFIX}:${orderId.toLowerCase()}:${bagIndex}`)
    .digest('base64url')
    .slice(0, 24);
}

export function buildPickupQr(orderId: string, bagIndex: number): PickupQr {
  if (!UUID_RE.test(orderId)) throw new Error('Invalid pickup order id');
  if (!Number.isInteger(bagIndex) || bagIndex < 1 || bagIndex > 12) {
    throw new Error('Invalid pickup bag index');
  }
  const sig = signature(orderId, bagIndex);
  return {
    orderId: orderId.toLowerCase(),
    bagIndex,
    payload: `${PREFIX}:${orderId.toLowerCase()}:${bagIndex}:${sig}`,
    fallbackCode: sig.slice(0, 8).toUpperCase(),
  };
}

export function parseAndVerifyPickupQr(raw: string): PickupQr | null {
  const parts = raw.trim().split(':');
  if (parts.length !== 6 || parts.slice(0, 3).join(':') !== PREFIX) return null;
  const orderId = parts[3]?.toLowerCase() ?? '';
  const bagIndex = Number(parts[4]);
  const supplied = parts[5] ?? '';
  if (!UUID_RE.test(orderId) || !Number.isInteger(bagIndex) || bagIndex < 1 || bagIndex > 12) return null;
  const expected = signature(orderId, bagIndex);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  return { orderId, bagIndex, payload: `${PREFIX}:${orderId}:${bagIndex}:${expected}`, fallbackCode: expected.slice(0, 8).toUpperCase() };
}

export function isPickupFallbackCode(raw: string): boolean {
  return /^[A-Z0-9_-]{8}$/i.test(raw.trim());
}
