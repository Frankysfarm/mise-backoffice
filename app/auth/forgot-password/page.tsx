'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Mail, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-surface via-white to-matcha-100/30">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft size={14} /> Zurück zum Login
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-matcha-900/5 ring-1 ring-zinc-100">
          {!sent ? (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight">Passwort vergessen?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Trag deine E-Mail ein — wir schicken dir einen Link zum Zurücksetzen.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="text-xs font-semibold text-zinc-700">
                    E-Mail
                  </label>
                  <div className="relative mt-1.5">
                    <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="du@restaurant.de"
                      className="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-3 text-sm placeholder:text-zinc-400 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
                    />
                  </div>
                </div>

                {err && (
                  <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-900">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 hover:shadow-xl disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Sende Link…
                    </>
                  ) : (
                    <>
                      Reset-Link schicken
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={26} />
              </div>
              <h2 className="mt-5 font-display text-xl font-bold tracking-tight">
                Check dein Postfach
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Wir haben einen Reset-Link an <strong className="text-foreground">{email}</strong> geschickt.
                Falls nichts ankommt, prüfe deinen Spam-Ordner.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-matcha-700 hover:text-matcha-900"
              >
                <ArrowLeft size={14} /> Zurück zum Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
