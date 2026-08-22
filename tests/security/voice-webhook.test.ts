import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyElevenLabsWebhook } from '@/lib/voice-orders/webhook-signature';

describe('ElevenLabs webhook signature', () => {
  const secret = 'test-webhook-secret-with-enough-length';
  const rawBody = JSON.stringify({ type: 'conversation.ended', conversation_id: 'conv-1' });
  const now = new Date('2026-08-21T12:00:00.000Z');
  const timestamp = Math.floor(now.getTime() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  it('accepts a fresh valid HMAC signature', () => {
    expect(verifyElevenLabsWebhook({
      rawBody, signatureHeader: `t=${timestamp},v0=${signature}`, secret, now,
    })).toBe(true);
  });

  it('rejects tampered bodies, malformed headers and missing secrets', () => {
    expect(verifyElevenLabsWebhook({ rawBody: `${rawBody}x`, signatureHeader: `t=${timestamp},v0=${signature}`, secret, now })).toBe(false);
    expect(verifyElevenLabsWebhook({ rawBody, signatureHeader: 'invalid', secret, now })).toBe(false);
    expect(verifyElevenLabsWebhook({ rawBody, signatureHeader: `t=${timestamp},v0=${signature}`, secret: undefined, now })).toBe(false);
  });

  it('rejects replayed signatures outside the five-minute window', () => {
    const oldTimestamp = timestamp - 301;
    const oldSignature = createHmac('sha256', secret).update(`${oldTimestamp}.${rawBody}`).digest('hex');
    expect(verifyElevenLabsWebhook({
      rawBody, signatureHeader: `t=${oldTimestamp},v0=${oldSignature}`, secret, now,
    })).toBe(false);
  });
});
