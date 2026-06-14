'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useCustomerPush } from '../hooks/use-customer-push';

export function PushOptinBanner({
  locationId,
  orderId,
  email,
}: {
  locationId: string;
  orderId?:   string;
  email?:     string;
}) {
  const { state, subscribe } = useCustomerPush({ locationId, orderId, email });
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state === 'unsupported' || state === 'denied' || state === 'subscribed') {
    return null;
  }

  if (state === 'granted') {
    // Silently subscribe without asking again
    void subscribe();
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3 text-sm shadow-sm">
      <Bell className="h-5 w-5 flex-shrink-0 text-matcha-600" />
      <div className="flex-1">
        <div className="font-semibold text-matcha-900">Lieferstatus per Browser-Push?</div>
        <div className="text-xs text-matcha-700 mt-0.5">Wir benachrichtigen dich wenn dein Fahrer startet und ankommt.</div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={subscribe}
          disabled={state === 'requesting'}
          className="rounded-lg bg-matcha-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-matcha-700 disabled:opacity-50 transition"
        >
          {state === 'requesting' ? '...' : 'Ja, bitte!'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-matcha-200 px-2 py-1.5 text-xs text-matcha-600 hover:bg-matcha-100 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
