import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
  return cached;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export const PLATFORM_FEE_BPS_DEFAULT = 200; // 2%

export function computePlatformFeeCents(amount_cents: number, fee_percent: number): number {
  return Math.round(amount_cents * (fee_percent / 100));
}
