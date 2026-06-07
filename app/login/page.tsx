'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, Sparkles, Mail, Lock, AlertCircle, Eye, EyeOff, QrCode } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { QRScanner } from './QRScanner';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const reason = params.get('reason');
  const justSignedUp = params.get('signed_up') === '1';
  const justReset = params.get('reset') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const qrFailed = reason === 'qr_failed';
  const qrErrorMsg = params.get('qr_error');
  const [mode, setMode] = useState<'kasse' | 'lieferung' | 'backoffice'>(() => {
    // URL-Param hat höchste Priorität, dann next-Pfad, dann localStorage, dann Default
    const m = params.get('mode');
    if (m === 'lieferung') return 'lieferung';
    if (m === 'kasse') return 'kasse';
    if (m === 'backoffice' || m === 'admin') return 'backoffice';
    if (next.startsWith('/pos/inbox')) return 'lieferung';
    if (next.startsWith('/shop') || next === '/' || next.startsWith('/menu') || next.startsWith('/settings') || next.startsWith('/delivery') || next.startsWith('/dispatch')) return 'backoffice';
    if (typeof window !== 'undefined') {
      const remembered = window.localStorage.getItem('mise.loginMode');
      if (remembered === 'lieferung' || remembered === 'kasse' || remembered === 'backoffice') return remembered;
    }
    return 'backoffice';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mise.loginMode', mode);
    }
  }, [mode]);

  function resolveTarget(): string {
    if (mode === 'backoffice') {
      // Backoffice: Restaurant-Inhaber landet auf Dashboard '/' — dort sieht er
      // KPIs + alle Module + Schnellzugriffe. Setup-Wizard wird vom Dashboard
      // selbst gerouted falls Onboarding noch nicht abgeschlossen.
      if (next && next !== '/start' && !next.startsWith('/pos')) return next;
      return '/';
    }
    if (mode === 'lieferung') return '/pos/inbox';
    if (next.startsWith('/pos/inbox')) return '/pos';
    if (next === '/' || next === '/start') return '/pos';
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(translateAuthError(error.message));
      return;
    }
    router.replace(resolveTarget());
    router.refresh();
  }

  async function onGoogle() {
    setOauthBusy(true);
    setErr(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(resolveTarget())}`,
      },
    });
    if (error) {
      setOauthBusy(false);
      setErr(translateAuthError(error.message));
    }
  }

  return (
    <div className="min-h-screen bg-surface text-matcha-900 lg:grid lg:grid-cols-[1fr_minmax(420px,520px)]">
      {/* ─── Left Panel: Brand Visual ─── */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between bg-matcha-900 text-white p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[420px] w-[420px] rounded-full bg-gold opacity-15 blur-3xl" />

        <div className="relative z-10">
          <Link href="/welcome" className="inline-flex items-center gap-2.5 text-white/95 hover:text-white">
            <svg viewBox="0 0 40 40" className="h-7 w-7">
              <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-2xl font-bold tracking-tight">mise</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-6">
            <Sparkles size={11} /> Das Betriebssystem für dein Restaurant
          </div>
          <h1 className="font-display text-5xl xl:text-6xl font-bold leading-[0.95] tracking-[-0.02em]">
            Schön dich<br />
            wieder zu <span className="text-accent italic">sehen</span>.
          </h1>
          <p className="mt-6 text-lg text-matcha-100/90 leading-relaxed">
            Dienstplan, Kasse, Lieferung, Telefon-KI — alles griffbereit. Log dich ein und mach weiter, wo du aufgehört hast.
          </p>

          <div className="mt-10 flex items-center gap-6 text-sm text-matcha-100/70">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>13 Module</span>
            </div>
            <div className="h-3 w-px bg-matcha-100/20" />
            <div>14 Tage gratis</div>
            <div className="h-3 w-px bg-matcha-100/20" />
            <div>Made in Aachen</div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-matcha-100/60">
          © {new Date().getFullYear()} Mise · <a href="/datenschutz" className="hover:text-white">Datenschutz</a> · <a href="/impressum" className="hover:text-white">Impressum</a>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex flex-col justify-center min-h-screen lg:min-h-0 px-6 sm:px-12 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <svg viewBox="0 0 40 40" className="h-7 w-7 text-matcha-900">
            <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-xl font-bold">mise</span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold tracking-tight">Anmelden</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Noch kein Konto?{' '}
              <Link href="/signup" className="font-semibold text-matcha-700 hover:text-matcha-900 underline-offset-2 hover:underline">
                14 Tage gratis testen
              </Link>
            </p>
          </div>

          {/* Banner messages */}
          {justSignedUp && (
            <Banner type="success">
              Account erstellt. Bitte E-Mail bestätigen — dann kannst du dich einloggen.
            </Banner>
          )}
          {justReset && (
            <Banner type="success">
              Passwort gesetzt. Du kannst dich jetzt einloggen.
            </Banner>
          )}
          {reason === 'no_access' && (
            <Banner type="warn">Dein Account hat keinen Zugriff aufs Backoffice.</Banner>
          )}
          {reason === 'forbidden' && (
            <Banner type="warn">Keine Berechtigung für diese Seite.</Banner>
          )}
          {reason === 'auth_failed' && (
            <Banner type="warn">Anmeldung fehlgeschlagen. Bitte erneut versuchen.</Banner>
          )}
          {qrFailed && (
            <Banner type="warn">
              QR-Login fehlgeschlagen{qrErrorMsg ? ` — ${qrErrorMsg}` : ''}. Bitte neuen QR im Backoffice generieren oder manuell anmelden.
            </Banner>
          )}

          {/* Schnell-Login per QR (für fest installierte iPads) */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            disabled={busy || oauthBusy}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-matcha-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-matcha-800 hover:shadow disabled:opacity-60 disabled:cursor-not-allowed mb-3"
          >
            <QrCode className="h-4 w-4" />
            QR-Code scannen (Schnell-Login)
          </button>

          {/* Google */}
          <button
            type="button"
            onClick={onGoogle}
            disabled={oauthBusy || busy}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {oauthBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            Mit Google fortfahren
          </button>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-zinc-200" />
            oder mit E-Mail
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-xs font-semibold text-zinc-700">E-Mail</label>
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

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-zinc-700">Passwort</label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-matcha-700 hover:text-matcha-900 underline-offset-2 hover:underline"
                >
                  Vergessen?
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm placeholder:text-zinc-400 focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label={showPwd ? 'Passwort verstecken' : 'Passwort anzeigen'}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-900">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-matcha-200 bg-cream/40 p-1.5">
              <button
                type="button"
                onClick={() => setMode('backoffice')}
                className={cn(
                  'rounded-xl px-2 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5',
                  mode === 'backoffice' ? 'bg-matcha-900 text-white shadow-md' : 'text-matcha-700 hover:bg-cream',
                )}
              >
                <span aria-hidden>{'\u{1F3E2}'}</span> Backoffice
              </button>
              <button
                type="button"
                onClick={() => setMode('kasse')}
                className={cn(
                  'rounded-xl px-2 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5',
                  mode === 'kasse' ? 'bg-matcha-900 text-white shadow-md' : 'text-matcha-700 hover:bg-cream',
                )}
              >
                <span aria-hidden>{'\u{1F9FE}'}</span> Kasse
              </button>
              <button
                type="button"
                onClick={() => setMode('lieferung')}
                className={cn(
                  'rounded-xl px-2 py-3 text-xs font-bold transition flex items-center justify-center gap-1.5',
                  mode === 'lieferung' ? 'bg-matcha-900 text-white shadow-md' : 'text-matcha-700 hover:bg-cream',
                )}
              >
                <span aria-hidden>{'\u{1F6F5}'}</span> Lieferung
              </button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              {mode === 'backoffice'
                ? 'Restaurant-Cockpit: Menü, Bilder, Domain, Stripe, Module, alles steuern.'
                : mode === 'kasse'
                ? 'Du landest direkt im POS-Terminal (Tische, Items, Kassieren).'
                : 'Du landest direkt im Bestelleingang (Online-Lieferungen + Abholungen).'}
            </p>

            <button
              type="submit"
              disabled={busy || oauthBusy}
              className={cn(
                'group flex w-full items-center justify-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all',
                'hover:bg-matcha-800 hover:shadow-xl hover:shadow-matcha-900/30',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Anmelden…
                </>
              ) : (
                <>
                  Anmelden
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Mit der Anmeldung akzeptierst du unsere{' '}
            <a href="/agb" className="underline underline-offset-2 hover:text-foreground">AGB</a>
            {' und '}
            <a href="/datenschutz" className="underline underline-offset-2 hover:text-foreground">Datenschutz</a>.
          </p>
        </div>
      </div>

      <QRScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(url) => {
          setScannerOpen(false);
          window.location.href = url;
        }}
        expectedOrigin={typeof window !== 'undefined' ? window.location.origin : ''}
      />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────

function Banner({ type, children }: { type: 'success' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'mb-6 rounded-xl border px-4 py-3 text-sm',
        type === 'success' && 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
        type === 'warn' && 'border-amber-200 bg-amber-50/70 text-amber-900',
      )}
    >
      {children}
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

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials'))
    return 'E-Mail oder Passwort stimmt nicht.';
  if (m.includes('email not confirmed'))
    return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
  if (m.includes('too many'))
    return 'Zu viele Versuche — bitte gleich nochmal probieren.';
  if (m.includes('user not found')) return 'Kein Account mit dieser E-Mail.';
  return msg;
}
