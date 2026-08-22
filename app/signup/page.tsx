'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, Loader2, Sparkles, Mail, Lock, User, Building2,
  Eye, EyeOff, AlertCircle, Check, Phone,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}

function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Restaurant
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');

  // Step 2: Account
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [accept, setAccept] = useState(false);

  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function validateStep1(): boolean {
    if (restaurantName.trim().length < 2) {
      setErr('Restaurant-Name fehlt.');
      return false;
    }
    return true;
  }

  function nextStep() {
    setErr(null);
    if (step === 1 && !validateStep1()) return;
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErr('Bitte Vor- und Nachname eingeben.');
      return;
    }
    if (password.length < 8) {
      setErr('Passwort: mindestens 8 Zeichen.');
      return;
    }
    if (!accept) {
      setErr('Bitte AGB & Datenschutz akzeptieren.');
      return;
    }

    setBusy(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName,
        city,
        firstName,
        lastName,
        email,
        phone,
        password,
      }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErr(json.error ?? 'Registrierung fehlgeschlagen.');
      return;
    }

    router.replace(`/login?signed_up=1&email=${encodeURIComponent(email)}`);
  }

  async function onGoogle() {
    setErr(null);
    if (!validateStep1()) return;
    setOauthBusy(true);
    const sb = createClient();

    // Tenant-Daten via cookie temporär parken — wird vom callback aufgegriffen
    document.cookie = `mise_signup=${encodeURIComponent(
      JSON.stringify({ restaurantName, city }),
    )};path=/;max-age=600;SameSite=Lax`;

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/api/auth/google-signup-finish`,
      },
    });
    if (error) {
      setOauthBusy(false);
      setErr(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-matcha-900 lg:grid lg:grid-cols-[minmax(420px,520px)_1fr]">
      {/* ─── Form Panel ─── */}
      <div className="flex flex-col min-h-screen lg:min-h-0 px-6 sm:px-12 py-10 bg-white">
        {/* Logo + back */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/welcome" className="inline-flex items-center gap-2 text-matcha-900 hover:text-matcha-700">
            <svg viewBox="0 0 40 40" className="h-7 w-7">
              <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-xl font-bold">mise</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Bereits Konto? <span className="font-semibold underline-offset-2 hover:underline">Anmelden</span>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-matcha-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-matcha-700 mb-4">
            <Sparkles size={11} /> 14 Tage gratis · Keine Kreditkarte
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight">
            {step === 1 ? 'Lass uns starten.' : 'Fast geschafft!'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 1
              ? 'Wie heißt dein Restaurant?'
              : 'Dein Login — damit du wieder reinkommst.'}
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center gap-2">
            <div className={cn('h-1.5 flex-1 rounded-full', step >= 1 ? 'bg-matcha-700' : 'bg-zinc-200')} />
            <div className={cn('h-1.5 flex-1 rounded-full', step >= 2 ? 'bg-matcha-700' : 'bg-zinc-200')} />
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Schritt {step} von 2
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {step === 1 ? (
              <>
                <Field
                  label="Restaurant"
                  icon={<Building2 size={15} />}
                  value={restaurantName}
                  onChange={setRestaurantName}
                  placeholder="z. B. Frankys Farm"
                  autoFocus
                />
                <Field
                  label="Stadt (optional)"
                  icon={null}
                  value={city}
                  onChange={setCity}
                  placeholder="Aachen"
                />

                {err && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-900">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {err}
                  </div>
                )}

                <button
                  type="button"
                  onClick={nextStep}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 hover:shadow-xl"
                >
                  Weiter <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>

                <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <div className="h-px flex-1 bg-zinc-200" />
                  oder
                  <div className="h-px flex-1 bg-zinc-200" />
                </div>

                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={oauthBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {oauthBusy ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                  Mit Google starten
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vorname" icon={<User size={15} />} value={firstName} onChange={setFirstName} placeholder="Max" autoFocus />
                  <Field label="Nachname" icon={null} value={lastName} onChange={setLastName} placeholder="Mustermann" />
                </div>
                <Field label="E-Mail" icon={<Mail size={15} />} value={email} onChange={setEmail} type="email" placeholder="du@restaurant.de" />
                <Field label="Telefon (optional)" icon={<Phone size={15} />} value={phone} onChange={setPhone} type="tel" placeholder="+49 …" />

                <div>
                  <label htmlFor="pwd" className="text-xs font-semibold text-zinc-700">
                    Passwort
                  </label>
                  <div className="relative mt-1.5">
                    <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="pwd"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 Zeichen"
                      className="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm placeholder:text-zinc-400 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={accept}
                    onChange={(e) => setAccept(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-matcha-700 focus:ring-matcha-700"
                  />
                  <span>
                    Ich akzeptiere die{' '}
                    <a href="/agb" target="_blank" className="underline underline-offset-2 hover:text-foreground">AGB</a>{' und '}
                    <a href="/datenschutz" target="_blank" className="underline underline-offset-2 hover:text-foreground">Datenschutz-Erklärung</a>.
                  </span>
                </label>

                {err && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-900">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {err}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <ArrowLeft size={14} /> Zurück
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Account anlegen…
                      </>
                    ) : (
                      <>
                        Trial starten <Sparkles size={15} />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      {/* ─── Brand Panel ─── */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between bg-matcha-900 text-white p-12 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-gold opacity-15 blur-3xl" />

        <div className="relative z-10 max-w-md">
          <div className="font-display text-5xl xl:text-6xl font-bold leading-[0.95] tracking-[-0.02em]">
            Alles in einem<br />
            <span className="text-accent italic">System</span>.
          </div>
          <p className="mt-6 text-lg text-matcha-100/90 leading-relaxed">
            Dienstplan, Online-Shop, Kasse, Lieferung, Telefon-KI — kein Tool-Chaos mehr.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-matcha-100">
            {[
              'Alle 13 Module 14 Tage gratis',
              'Eigener Liefer-Shop in 5 Min',
              'KI nimmt Telefon-Bestellungen',
              'TSE-konform für DE & AT',
              'Du kündigst jederzeit',
            ].map((f) => (
              <li key={f} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-matcha-900">
                  <Check size={12} strokeWidth={3} />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-matcha-100/60">
          „In 2 Wochen hatten wir alle Telefon-Bestellungen automatisiert."<br />
          <span className="text-matcha-100/40">— frühere Beta-Tester</span>
        </div>
      </div>
    </div>
  );
}

// ─── Components ──────────────────────────────────────

function Field({
  label, icon, value, onChange, placeholder, type = 'text', autoFocus,
}: {
  label: string;
  icon: React.ReactNode | null;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700">{label}</label>
      <div className="relative mt-1.5">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</span>}
        <input
          type={type}
          required={!label.includes('optional')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'block w-full rounded-xl border border-zinc-200 bg-white py-3 pr-3 text-sm placeholder:text-zinc-400 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20',
            icon ? 'pl-10' : 'pl-3.5',
          )}
        />
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
