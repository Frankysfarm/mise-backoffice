'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Loader2, QrCode, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { QRScanner } from '@/app/login/QRScanner';

export type TeamBrand = {
  name: string;
  slug: string | null;
  logoUrl: string | null;
  primary: string;
  accent: string;
  stadt?: string | null;
};

/** Begrüßung nach Berliner Uhrzeit – die Seite ist die Tür zur Schicht. */
function greetingFor(hour: number): string {
  if (hour < 5) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 14) return 'Mahlzeit';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht. Bitte noch einmal prüfen.';
  if (m.includes('email not confirmed')) return 'Deine E-Mail-Adresse ist noch nicht bestätigt. Schau in dein Postfach.';
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Zu viele Versuche. Bitte kurz warten und dann erneut anmelden.';
  if (m.includes('network') || m.includes('fetch')) return 'Keine Verbindung. Prüfe dein WLAN oder Mobilfunknetz.';
  return 'Anmeldung nicht möglich. Bitte erneut versuchen.';
}

export function TeamLogin({ brand }: { brand: TeamBrand }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const berlin = Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }).format(new Date()));
    setHour(Number.isFinite(berlin) ? berlin : new Date().getHours());
  }, []);

  const greeting = hour === null ? 'Hallo' : greetingFor(hour);
  const monogram = useMemo(() => initials(brand.name) || 'M', [brand.name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr(translateAuthError(error.message));
      return;
    }
    router.replace('/mitarbeiter');
    router.refresh();
  }

  return (
    <div
      className="team-login min-h-[100dvh] flex flex-col"
      style={{ ['--brand' as string]: brand.primary, ['--brand-accent' as string]: brand.accent }}
    >
      {/* Markenbühne: die Tür zur Schicht */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: 'var(--brand)' }}>
        <div aria-hidden className="team-glow" />

        <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-6 pt-14 pb-24 sm:pt-20 sm:pb-28">
          <div className="team-badge relative grid h-28 w-28 place-items-center">
            <svg aria-hidden viewBox="0 0 112 112" className="absolute inset-0 h-full w-full">
              <circle cx="56" cy="56" r="52" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <circle
                className="team-ring"
                cx="56" cy="56" r="52" fill="none"
                stroke="var(--brand-accent)" strokeWidth="3" strokeLinecap="round"
                pathLength={1}
                transform="rotate(-90 56 56)"
              />
            </svg>
            <div className="team-logo grid h-[88px] w-[88px] place-items-center overflow-hidden rounded-full bg-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.5)]">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt={`${brand.name} Logo`} className="h-full w-full object-contain p-2" />
              ) : (
                <span className="font-display text-3xl font-bold tracking-tight" style={{ color: 'var(--brand)' }}>{monogram}</span>
              )}
            </div>
          </div>

          <h1 className="team-greeting mt-8 text-center font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.02em] sm:text-4xl">
            {greeting},<br />Team {brand.name}.
          </h1>
          <p className="team-greeting-sub mt-3 text-center text-[15px] leading-relaxed text-white/80">
            Melde dich an – dann siehst du deine Schichten, Aufgaben und Übergaben.
          </p>
        </div>
      </section>

      {/* Anmeldebogen: schiebt sich über die Bühne */}
      <section className="team-sheet relative -mt-10 flex-1 rounded-t-[28px] bg-white px-6 pb-10 pt-7 shadow-[0_-18px_48px_-24px_rgba(0,0,0,0.35)] sm:mx-auto sm:mt-[-3.5rem] sm:w-full sm:max-w-md sm:rounded-[28px] sm:pb-8">
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-md" noValidate>
          {err && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-[14px] leading-snug text-red-800">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">E-Mail</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vorname@…"
              className="team-input"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-slate-700">
              Passwort
              <a href="/auth/forgot-password" className="font-semibold" style={{ color: 'var(--brand)' }}>Vergessen?</a>
            </span>
            <span className="relative block">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="team-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-slate-800"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="team-cta mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white transition disabled:opacity-70"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : (<>Anmelden <ArrowRight size={18} /></>)}
          </button>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <QrCode size={18} /> Mit QR-Code anmelden
          </button>

          <p className="mt-7 text-center text-[13px] leading-relaxed text-slate-500">
            Noch keinen Zugang? Deine Schichtleitung lädt dich ein – du bekommst dann eine E-Mail.
          </p>
        </form>

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 text-[12px] text-slate-400">
          <span className="font-display font-semibold tracking-tight text-slate-500">mise team</span>
          <a href="/login?mode=backoffice" className="hover:text-slate-700">Inhaber-Login</a>
        </div>
      </section>

      <QRScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(url) => { setScannerOpen(false); window.location.href = url; }}
        expectedOrigin={typeof window !== 'undefined' ? window.location.origin : ''}
      />

      <style jsx global>{`
        .team-login { background: #fff; }
        .team-glow {
          position: absolute; inset: -40% -20% auto -20%; height: 120%;
          background:
            radial-gradient(60% 55% at 30% 30%, color-mix(in oklab, var(--brand-accent) 55%, transparent) 0%, transparent 70%),
            radial-gradient(50% 45% at 80% 70%, rgba(255,255,255,0.14) 0%, transparent 70%);
          filter: blur(20px);
          transform: translate3d(0,0,0);
          animation: team-drift 18s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .team-input {
          display: block; width: 100%; height: 3.25rem; border-radius: 0.875rem;
          border: 1.5px solid #e2e8f0; background: #fff; padding: 0 0.95rem;
          font-size: 16px; color: #0f172a; outline: none;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .team-input::placeholder { color: #94a3b8; }
        .team-input:focus { border-color: var(--brand); box-shadow: 0 0 0 4px color-mix(in oklab, var(--brand) 18%, transparent); }
        .team-cta {
          background: var(--brand);
          box-shadow: 0 10px 24px -12px color-mix(in oklab, var(--brand) 80%, black);
        }
        .team-cta:hover:not(:disabled) { background: color-mix(in oklab, var(--brand) 88%, black); }
        .team-cta:active:not(:disabled) { transform: translateY(1px); }

        /* Ein choreografierter Moment: Ring stempelt ein → Logo → Gruß → Bogen. */
        .team-ring { stroke-dasharray: 1; stroke-dashoffset: 1; animation: team-stamp 1.1s cubic-bezier(.16,1,.3,1) .1s forwards; }
        .team-logo { opacity: 0; transform: scale(.86); animation: team-rise .7s cubic-bezier(.16,1,.3,1) .55s forwards; }
        .team-greeting, .team-greeting-sub { opacity: 0; transform: translateY(10px); animation: team-rise .7s cubic-bezier(.16,1,.3,1) forwards; }
        .team-greeting { animation-delay: .8s; }
        .team-greeting-sub { animation-delay: .95s; }
        .team-sheet { opacity: 0; transform: translateY(28px); animation: team-rise .8s cubic-bezier(.16,1,.3,1) 1s forwards; }

        @keyframes team-stamp { to { stroke-dashoffset: 0; } }
        @keyframes team-rise { to { opacity: 1; transform: none; } }
        @keyframes team-drift { from { transform: translate3d(-3%, -2%, 0) scale(1); } to { transform: translate3d(3%, 4%, 0) scale(1.08); } }

        @media (prefers-reduced-motion: reduce) {
          .team-ring { stroke-dashoffset: 0; animation: none; }
          .team-logo, .team-greeting, .team-greeting-sub, .team-sheet { opacity: 1; transform: none; animation: none; }
          .team-glow { animation: none; }
        }
      `}</style>
    </div>
  );
}
