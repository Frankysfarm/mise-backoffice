import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SECONDS = 5 * 60;

function parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
  const values = new Map<string, string[]>();
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (!key || !value) continue;
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  const timestamp = Number(values.get('t')?.[0]);
  const signatures = values.get('v0') ?? [];
  return Number.isInteger(timestamp) && signatures.length > 0 ? { timestamp, signatures } : null;
}

export function verifyElevenLabsWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string | undefined;
  now?: Date;
}): boolean {
  if (!input.secret || input.secret.length < 16 || !input.signatureHeader) return false;
  const parsed = parseHeader(input.signatureHeader);
  if (!parsed) return false;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > MAX_AGE_SECONDS) return false;

  const expected = createHmac('sha256', input.secret)
    .update(`${parsed.timestamp}.${input.rawBody}`)
    .digest();
  return parsed.signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    const supplied = Buffer.from(candidate, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
