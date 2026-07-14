'use client';

import { useEffect, useState } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1475 — Bestellstatus-Benachrichtigungs-Opt-In (Storefront)
// Kundeneinwilligung für Push-/Email-Benachrichtigung bei Status-Änderungen.
// localStorage-Guard 30 Tage. Hydration-Safe. Nach Phase 1469.

interface Props {
  locationId: string;
  orderId?: string | null;
}

const LS_KEY = (locationId: string) => `notif_optin_done:${locationId}`;
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 Tage

type Schritt = 'prompt' | 'email' | 'done' | 'hidden';
type Kanal = 'email' | 'push' | 'beide';

export function StorefrontPhase1475BenachrichtigungsOptIn({ locationId, orderId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>('hidden');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(LS_KEY(locationId));
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Date.now() - ts < DISMISS_TTL) return; // already opted in/dismissed
      }
    } catch {}
    // Show after slight delay so it doesn't pop in immediately
    const t = setTimeout(() => setSchritt('prompt'), 1200);
    return () => clearTimeout(t);
  }, [locationId]);

  if (!mounted || schritt === 'hidden') return null;

  function dismiss() {
    try { localStorage.setItem(LS_KEY(locationId), String(Date.now())); } catch {}
    setSchritt('hidden');
  }

  async function submit(kanal: Kanal, emailVal?: string) {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { location_id: locationId, kanal };
      if (orderId) body.customer_id = orderId;
      if (emailVal) body.email = emailVal;
      const res = await fetch('/api/delivery/public/benachrichtigungs-opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Fehler');
      try { localStorage.setItem(LS_KEY(locationId), String(Date.now())); } catch {}
      setSchritt('done');
    } catch {
      setError('Konnte nicht gespeichert werden. Bitte nochmal versuchen.');
    } finally {
      setSaving(false);
    }
  }

  if (schritt === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
        <Check className="h-4 w-4 shrink-0" />
        <span className="font-medium">Benachrichtigungen aktiviert — wir halten dich auf dem Laufenden!</span>
      </div>
    );
  }

  if (schritt === 'email') {
    return (
      <div className="rounded-2xl border bg-card shadow-sm px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">E-Mail-Benachrichtigung</span>
          </div>
          <button onClick={dismiss} className="p-1 rounded hover:bg-muted/40">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gib deine E-Mail-Adresse ein, um Statusupdates zu erhalten.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="deine@email.de"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => submit('email', email)}
            disabled={saving || !email.includes('@')}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-colors',
              saving || !email.includes('@')
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white',
            )}
          >
            {saving ? 'Speichern…' : 'Bestätigen'}
          </button>
          <button
            onClick={() => setSchritt('prompt')}
            className="px-4 py-2 rounded-xl text-sm bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
          >
            Zurück
          </button>
        </div>
      </div>
    );
  }

  // 'prompt'
  return (
    <div className="rounded-2xl border bg-card shadow-sm px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Bestellstatus-Updates</span>
        </div>
        <button onClick={dismiss} className="p-1 rounded hover:bg-muted/40">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Möchtest du automatisch informiert werden, wenn sich der Status deiner Bestellung ändert?
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setSchritt('email')}
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span>✉️</span>
          <span>Per E-Mail benachrichtigen</span>
        </button>
        <button
          onClick={() => submit('push')}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <span>🔔</span>
          <span>{saving ? 'Wird aktiviert…' : 'Push-Benachrichtigungen aktivieren'}</span>
        </button>
      </div>
      <button
        onClick={dismiss}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        Nein danke
      </button>
    </div>
  );
}
