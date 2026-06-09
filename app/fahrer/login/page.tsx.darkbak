'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Loader2, Mail, Lock, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function FahrerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr(translate(error.message));
      return;
    }
    // Fahrer-Gate: nur wer ausliefern darf, kommt rein
    try {
      const res = await fetch('/api/fahrer/whoami', { cache: 'no-store' });
      const j = await res.json();
      if (!j.isDriver) {
        await sb.auth.signOut();
        setBusy(false);
        setErr('Kein Fahrer-Zugang — diese App ist nur fuer Fahrer:innen. Frag dein Restaurant nach einer Einladung.');
        return;
      }
    } catch {
      // im Zweifel weiterleiten — das Server-Gate auf /fahrer/app greift ohnehin
    }
    router.replace('/fahrer/app');
    router.refresh();
  }

  async function onForgot() {
    if (!email.trim()) {
      setErr('Bitte zuerst deine E-Mail eintragen.');
      return;
    }
    setErr(null);
    const sb = createClient();
    await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/driver/setup` : undefined,
    });
    setResetSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-matcha-900 to-matcha-700 text-white">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 flex items-center justify-center">
            <Bike size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-matcha-200">Mise</div>
            <div className="font-display text-xl font-bold">Fahrer</div>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Anmelden</h1>
        <p className="text-matcha-200 text-sm mb-8">Mit deinem Fahrer-Zugang einloggen.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-matcha-200">E-Mail</label>
            <div className="mt-1 relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-matcha-300" />
              <input
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-white/10 border border-white/15 pl-10 pr-3 py-3.5 text-white placeholder-matcha-300 focus:outline-none focus:border-accent"
                placeholder="du@beispiel.de"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-matcha-200">Passwort</label>
            <div className="mt-1 relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-matcha-300" />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-white/10 border border-white/15 pl-10 pr-11 py-3.5 text-white placeholder-matcha-300 focus:outline-none focus:border-accent"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label="Passwort anzeigen"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-matcha-300"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-2xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
          {resetSent && (
            <div className="rounded-2xl bg-accent/15 border border-accent/30 p-3 text-sm text-accent">
              Falls die E-Mail als Fahrer registriert ist, haben wir dir einen Link zum Passwort-Zuruecksetzen geschickt.
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent text-matcha-900 py-4 font-display font-bold disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Anmelden…
              </>
            ) : (
              <>
                Anmelden <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <button
          onClick={onForgot}
          className="mt-5 text-sm text-matcha-200 underline-offset-2 hover:underline mx-auto"
        >
          Passwort vergessen?
        </button>

        <p className="text-xs text-matcha-300 text-center mt-8">
          Diese App ist nur fuer Fahrer:innen. Deinen Zugang bekommst du per Einladung von deinem Restaurant.
        </p>
      </div>
    </div>
  );
}

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/email not confirmed/i.test(msg)) return 'E-Mail noch nicht bestaetigt. Schau in dein Postfach.';
  return 'Anmeldung fehlgeschlagen. Bitte nochmal versuchen.';
}
