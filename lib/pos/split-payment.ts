import Stripe from 'stripe';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SplitScope =
  | { type: 'amount'; requestedCents: number; itemIds: string[]; seatNo: null }
  | { type: 'items'; requestedCents: null; itemIds: string[]; seatNo: null }
  | { type: 'seat'; requestedCents: null; itemIds: string[]; seatNo: number };

export type SplitProvider = 'sumup' | 'stripe';

export type SplitTenantPayments = {
  name: string;
  sumup_api_key: string | null;
  sumup_merchant_code: string | null;
  stripe_secret_key: string | null;
};

export function parseSplitScope(value: unknown): SplitScope {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (raw.mode === 'amount') {
    return {
      type: 'amount',
      requestedCents: requirePositiveCents(raw.amountCents, 'Teilbetrag'),
      itemIds: [],
      seatNo: null,
    };
  }
  if (raw.mode === 'items') {
    if (!Array.isArray(raw.itemIds) || raw.itemIds.length < 1 || raw.itemIds.length > 100) {
      throw new Error('Mindestens eine Position auswählen');
    }
    const itemIds = [...new Set(raw.itemIds.map((entry) => String(entry)))];
    if (itemIds.length !== raw.itemIds.length || itemIds.some((id) => !UUID_RE.test(id))) {
      throw new Error('Ungültige oder doppelte Positionsauswahl');
    }
    return { type: 'items', requestedCents: null, itemIds, seatNo: null };
  }
  if (raw.mode === 'seat') {
    const seatNo = Number(raw.seat);
    if (!Number.isInteger(seatNo) || seatNo < 1 || seatNo > 99) {
      throw new Error('Ungültiger Sitz oder Gast');
    }
    return { type: 'seat', requestedCents: null, itemIds: [], seatNo };
  }
  throw new Error('Split-Art auswählen');
}

export function requirePositiveCents(value: unknown, label = 'Betrag'): number {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 1_000_000) {
    throw new Error(`${label} muss als positiver Cent-Betrag angegeben werden`);
  }
  return cents;
}

export function requireUuid(value: unknown, label: string): string {
  const id = String(value ?? '').trim();
  if (!UUID_RE.test(id)) throw new Error(`Ungültige Angabe: ${label}`);
  return id;
}

export function mapSplitState(row: Record<string, unknown>) {
  return {
    splitSessionId: String(row.split_session_id ?? ''),
    transactionId: String(row.transaction_id ?? ''),
    orderId: String(row.order_id ?? ''),
    orderNumber: String(row.order_number ?? ''),
    bonToken: row.bon_token ? String(row.bon_token) : null,
    totalCents: Number(row.total_cents ?? 0),
    paidCents: Number(row.paid_cents ?? 0),
    remainingCents: Number(row.remaining_cents ?? 0),
    status: String(row.status ?? (row.completed ? 'paid' : 'open')),
    completed: row.completed === true || row.status === 'paid',
    wasConfirmed: row.was_confirmed !== false,
    amountCents: Number(row.amount_cents ?? 0),
    cashChangeCents: Number(row.cash_change_cents ?? 0),
    lineItems: Array.isArray(row.line_items) ? row.line_items : [],
    payments: Array.isArray(row.payments) ? row.payments : [],
    tseActive: row.tse_active === true,
  };
}

export async function createProviderCheckout(input: {
  provider: SplitProvider;
  tenant: SplitTenantPayments;
  amountCents: number;
  attemptId: string;
  tenantId: string;
  orderNumber: string;
  origin: string;
}): Promise<{ reference: string; url: string | null; status: string }> {
  const description = `Teilzahlung ${input.orderNumber} · ${input.tenant.name}`.slice(0, 120);
  if (input.provider === 'sumup') {
    if (!input.tenant.sumup_api_key || !input.tenant.sumup_merchant_code) {
      throw new Error('SumUp ist nicht eingerichtet');
    }
    const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + input.tenant.sumup_api_key,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.attemptId,
      },
      body: JSON.stringify({
        checkout_reference: 'split-' + input.attemptId,
        amount: input.amountCents / 100,
        currency: 'EUR',
        merchant_code: input.tenant.sumup_merchant_code,
        description,
      }),
    });
    if (!response.ok) throw new Error('SumUp-Checkout konnte nicht erstellt werden');
    const checkout = await response.json() as { id?: string; status?: string };
    if (!checkout.id) throw new Error('SumUp lieferte keinen Checkout');
    return { reference: checkout.id, url: null, status: checkout.status ?? 'PENDING' };
  }

  if (!input.tenant.stripe_secret_key) throw new Error('Stripe ist nicht eingerichtet');
  const stripe = stripeClient(input.tenant.stripe_secret_key);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: input.amountCents,
        product_data: { name: description },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      metadata: {
        split_attempt_id: input.attemptId,
        split_tenant_id: input.tenantId,
      },
    },
    metadata: {
      split_attempt_id: input.attemptId,
      split_tenant_id: input.tenantId,
    },
    success_url: `${input.origin}/pos/terminal-v5?split_payment=success`,
    cancel_url: `${input.origin}/pos/terminal-v5?split_payment=cancelled`,
    locale: 'de',
  }, { idempotencyKey: input.attemptId });
  if (!session.id || !session.url) throw new Error('Stripe lieferte keinen Checkout');
  return { reference: session.id, url: session.url, status: session.payment_status ?? 'unpaid' };
}

export async function recoverProviderCheckout(input: {
  provider: SplitProvider;
  tenant: SplitTenantPayments;
  reference: string;
}): Promise<{ reference: string; url: string | null; status: string }> {
  if (input.provider === 'sumup') {
    return { reference: input.reference, url: null, status: 'PENDING' };
  }
  if (!input.tenant.stripe_secret_key) throw new Error('Stripe ist nicht eingerichtet');
  const session = await stripeClient(input.tenant.stripe_secret_key)
    .checkout.sessions.retrieve(input.reference);
  return { reference: session.id, url: session.url ?? null, status: session.payment_status ?? 'unpaid' };
}

export async function verifyProviderCheckout(input: {
  provider: SplitProvider;
  tenant: SplitTenantPayments;
  reference: string;
  amountCents: number;
  attemptId: string;
  tenantId: string;
}): Promise<{ state: 'paid' | 'pending' | 'failed'; paymentId?: string; reason?: string }> {
  if (input.provider === 'sumup') {
    if (!input.tenant.sumup_api_key || !input.tenant.sumup_merchant_code) {
      return { state: 'failed', reason: 'SumUp ist nicht eingerichtet' };
    }
    try {
      const response = await fetch(
        'https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(input.reference),
        { headers: { Authorization: 'Bearer ' + input.tenant.sumup_api_key }, cache: 'no-store' },
      );
      if (!response.ok) return { state: 'pending', reason: 'SumUp-Status ist nicht verfügbar' };
      const checkout = await response.json() as {
        id?: string; status?: string; amount?: number; currency?: string;
        checkout_reference?: string; merchant_code?: string;
      };
      if (checkout.currency !== 'EUR'
        || checkout.checkout_reference !== 'split-' + input.attemptId
        || checkout.merchant_code !== input.tenant.sumup_merchant_code
        || Math.round(Number(checkout.amount) * 100) !== input.amountCents) {
        return { state: 'failed', reason: 'SumUp-Zahlung gehört nicht zu dieser Teilzahlung' };
      }
      if (checkout.status === 'PAID') return { state: 'paid', paymentId: checkout.id ?? input.reference };
      if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(checkout.status))) {
        return { state: 'failed', reason: 'SumUp-Zahlung wurde abgelehnt oder abgebrochen' };
      }
      return { state: 'pending' };
    } catch {
      return { state: 'pending', reason: 'SumUp ist derzeit nicht erreichbar' };
    }
  }

  if (!input.tenant.stripe_secret_key) return { state: 'failed', reason: 'Stripe ist nicht eingerichtet' };
  try {
    const session = await stripeClient(input.tenant.stripe_secret_key)
      .checkout.sessions.retrieve(input.reference);
    if (session.currency !== 'eur'
      || session.amount_total !== input.amountCents
      || session.metadata?.split_attempt_id !== input.attemptId
      || session.metadata?.split_tenant_id !== input.tenantId) {
      return { state: 'failed', reason: 'Stripe-Zahlung gehört nicht zu dieser Teilzahlung' };
    }
    if (session.payment_status === 'paid') return { state: 'paid', paymentId: session.id };
    if (session.status === 'expired') return { state: 'failed', reason: 'Stripe-Zahlung ist abgelaufen' };
    return { state: 'pending' };
  } catch {
    return { state: 'pending', reason: 'Stripe ist derzeit nicht erreichbar' };
  }
}

function stripeClient(secret: string) {
  return new Stripe(secret, { apiVersion: '2024-12-18.acacia' as any });
}
