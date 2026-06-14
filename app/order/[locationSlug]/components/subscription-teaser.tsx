'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, CreditCard, Loader2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  planType: 'weekly' | 'monthly' | 'annual';
  priceEur: number;
  freeDeliveriesPerPeriod: number | null;
  discountPct: number;
  minOrderValueEur: number | null;
};

type CurrentSub = {
  id: string;
  planName: string;
  planType: 'weekly' | 'monthly' | 'annual';
  currentPeriodEnd: string;
  deliveriesUsedThisPeriod: number;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  priceEur: number;
  freeDeliveriesPerPeriod: number | null;
  discountPct: number;
} | null;

const PLAN_TYPE_LABEL: Record<string, string> = {
  weekly: 'Woche',
  monthly: 'Monat',
  annual: 'Jahr',
};

const PLAN_TYPE_PERIOD: Record<string, string> = {
  weekly: 'pro Woche',
  monthly: 'pro Monat',
  annual: 'pro Jahr',
};

function formatEuro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

type Props = {
  locationId: string;
  email: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: string;
};

export function SubscriptionTeaser({ locationId, email, customerName, customerPhone, orderType }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  useEffect(() => {
    if (!locationId || orderType !== 'lieferung') return;
    setLoading(true);
    const url = `/api/delivery/subscriptions?location_id=${encodeURIComponent(locationId)}${email && email.includes('@') ? `&email=${encodeURIComponent(email)}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans ?? []);
        setCurrentSub(data.currentSubscription ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, email, orderType]);

  async function handleSubscribe() {
    if (!selectedPlan || !email) return;
    setSubscribing(true);
    setSubscribeError(null);
    try {
      const res = await fetch('/api/delivery/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          planId: selectedPlan.id,
          customerEmail: email,
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Abonnieren');
      setSubscribeSuccess(true);
      setCurrentSub(data.subscription);
      setExpanded(false);
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubscribing(false);
    }
  }

  if (orderType !== 'lieferung') return null;
  if (loading) return null;
  if (!plans.length && !currentSub) return null;

  // Active sub: show status + delivery counter
  if (currentSub && currentSub.status === 'active') {
    const remaining = currentSub.freeDeliveriesPerPeriod != null
      ? Math.max(0, currentSub.freeDeliveriesPerPeriod - currentSub.deliveriesUsedThisPeriod)
      : null;
    return (
      <div className="rounded-2xl border border-matcha-300 bg-matcha-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-700 text-white shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-matcha-900">Flatrate aktiv: {currentSub.planName}</div>
            <div className="text-xs text-matcha-700">
              {remaining != null
                ? remaining > 0
                  ? `${remaining} Gratis-Lieferung${remaining !== 1 ? 'en' : ''} übrig diesen ${PLAN_TYPE_LABEL[currentSub.planType]}`
                  : `Kontingent aufgebraucht — nächste Gratis-Lieferung ab ${formatDate(currentSub.currentPeriodEnd)}`
                : currentSub.discountPct > 0
                ? `${currentSub.discountPct}% Rabatt auf jede Lieferung`
                : 'Unbegrenzte Gratis-Lieferungen'}
            </div>
          </div>
          <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-matcha-700 text-white">
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>
        {subscribeSuccess && (
          <div className="mt-2 text-xs font-semibold text-matcha-700">
            ✓ Abo erfolgreich gebucht — gilt ab sofort!
          </div>
        )}
      </div>
    );
  }

  if (!plans.length) return null;

  const bestPlan = plans[0];

  return (
    <div className="rounded-2xl border border-matcha-200 bg-gradient-to-br from-matcha-50 to-white overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <CreditCard className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-matcha-900">Spare mit Liefer-Flatrate</div>
          <div className="text-xs text-matcha-700">
            Ab {formatEuro(bestPlan.priceEur)} € / {PLAN_TYPE_LABEL[bestPlan.planType]} —{' '}
            {bestPlan.freeDeliveriesPerPeriod != null
              ? `${bestPlan.freeDeliveriesPerPeriod} Gratis-Lieferungen inklusive`
              : bestPlan.discountPct > 0
              ? `${bestPlan.discountPct}% Rabatt auf alle Lieferungen`
              : 'Unbegrenzt gratis liefern'}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-matcha-600 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-matcha-600 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-matcha-100 px-4 pb-4 pt-3 space-y-3">
          <div className="space-y-2">
            {plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                    isSelected
                      ? 'border-matcha-700 bg-matcha-50 ring-2 ring-matcha-700/20'
                      : 'border-black/10 bg-white hover:border-matcha-400',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                      isSelected ? 'border-matcha-700 bg-matcha-700 text-white' : 'border-black/20',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-matcha-900">{plan.name}</span>
                      <span className="text-sm font-bold text-matcha-700 whitespace-nowrap">
                        {formatEuro(plan.priceEur)} € / {PLAN_TYPE_LABEL[plan.planType]}
                      </span>
                    </div>
                    {plan.description && (
                      <div className="mt-0.5 text-xs text-matcha-700">{plan.description}</div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {plan.freeDeliveriesPerPeriod != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-semibold text-matcha-800">
                          <Zap className="h-2.5 w-2.5" />
                          {plan.freeDeliveriesPerPeriod}× gratis {PLAN_TYPE_PERIOD[plan.planType]}
                        </span>
                      )}
                      {plan.discountPct > 0 && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                          {plan.discountPct}% Rabatt
                        </span>
                      )}
                      {plan.minOrderValueEur != null && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                          ab {formatEuro(plan.minOrderValueEur)} €
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPlan && (
            <div className="space-y-2">
              {!email || !email.includes('@') ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Bitte gib deine E-Mail-Adresse im Schritt davor ein, um ein Abo zu buchen.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    className={cn(
                      'flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-bold transition',
                      subscribing
                        ? 'bg-matcha-100 text-matcha-900/40 cursor-not-allowed'
                        : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
                    )}
                  >
                    {subscribing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {subscribing
                      ? 'Wird gebucht…'
                      : `${selectedPlan.name} buchen — ${formatEuro(selectedPlan.priceEur)} € / ${PLAN_TYPE_LABEL[selectedPlan.planType]}`}
                  </button>
                  {subscribeError && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      <X className="h-3.5 w-3.5 shrink-0" />
                      {subscribeError}
                    </div>
                  )}
                  <p className="text-[10px] text-matcha-800/50 text-center">
                    Keine automatische Verlängerung ohne deine Zustimmung. Jederzeit kündbar.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
