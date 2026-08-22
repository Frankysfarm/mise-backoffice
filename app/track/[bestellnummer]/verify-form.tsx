'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Loader2 } from 'lucide-react';

export function TrackingVerification({ bestellnummer }: { bestellnummer: string }) {
  const router = useRouter();
  const [last4, setLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(last4) || busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/track/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bestellnummer, last4 }),
      });
      const body = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (response.ok && body?.url) {
        router.replace(body.url);
        router.refresh();
        return;
      }
      setError(response.status === 429
        ? 'Zu viele Versuche. Bitte warte 15 Minuten.'
        : 'Bestellnummer und Telefonnummer passen nicht zusammen.');
    } catch {
      setError('Die Prüfung ist gerade nicht erreichbar. Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border bg-white p-7 shadow-soft">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-matcha-900 text-matcha-50">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-matcha-600">Geschütztes Live-Tracking</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-matcha-900">Bestellung bestätigen</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Gib die letzten vier Ziffern der bei der Bestellung verwendeten Telefonnummer ein.
          Vor der Bestätigung zeigen wir keine Bestell- oder Kundendaten.
        </p>
        <form className="mt-6" onSubmit={submit}>
          <label htmlFor="phone-last4" className="text-sm font-semibold text-matcha-900">
            Letzte vier Ziffern
          </label>
          <input
            id="phone-last4"
            autoComplete="off"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={last4}
            onChange={(event) => setLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
            className="mt-2 h-14 w-full rounded-xl border-2 border-matcha-200 bg-white px-4 text-center font-mono text-2xl tracking-[0.5em] text-matcha-900 outline-none focus:border-matcha-600"
            aria-describedby={error ? 'verify-error' : undefined}
          />
          {error && <p id="verify-error" className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy || last4.length !== 4}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-matcha-900 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sicher öffnen
          </button>
        </form>
      </div>
    </main>
  );
}
