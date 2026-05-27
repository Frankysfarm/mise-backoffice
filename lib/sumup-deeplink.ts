/**
 * Baut den SumUp-App-Deep-Link für Karten-Zahlung am Tablet.
 *
 * Schema (sumup://pay-1.0): öffnet die SumUp-App, startet eine Card-Reader-Transaktion,
 * navigiert nach Abschluss zur callback-URL mit smp-status, smp-tx-code, smp-tx-info.
 *
 * Doku: https://developer.sumup.com/api-mobile/payments
 */
export interface SumUpDeepLinkParams {
  affiliateKey: string;
  amount: number;
  currency?: 'EUR' | 'GBP' | 'CHF' | 'PLN' | 'BRL' | 'USD';
  title: string;
  callbackUrl: string;
  receiptEmail?: string;
}

export function buildSumUpDeepLink(p: SumUpDeepLinkParams): string {
  const params = new URLSearchParams();
  params.set('affiliate-key', p.affiliateKey);
  params.set('app-id', 'de.mise-gastro.pos');
  params.set('total', p.amount.toFixed(2));
  params.set('currency', p.currency ?? 'EUR');
  params.set('title', p.title);
  params.set('callback', p.callbackUrl);
  params.set('callbacksuccess', p.callbackUrl);
  params.set('callbackfail', p.callbackUrl);
  if (p.receiptEmail) params.set('receipt-email', p.receiptEmail);
  return `sumup://pay-1.0?${params.toString()}`;
}

/** SumUp callback returns smp-status=success | failed | cancelled. */
export type SumUpCallbackStatus = 'success' | 'failed' | 'cancelled';

export function parseSumUpCallback(url: URL): {
  status: SumUpCallbackStatus | null;
  txCode: string | null;
  txInfo: string | null;
  foreignTx: string | null;
} {
  const status = url.searchParams.get('smp-status') as SumUpCallbackStatus | null;
  return {
    status: status === 'success' || status === 'failed' || status === 'cancelled' ? status : null,
    txCode: url.searchParams.get('smp-tx-code'),
    txInfo: url.searchParams.get('smp-tx-info'),
    foreignTx: url.searchParams.get('smp-foreign-tx-id'),
  };
}
