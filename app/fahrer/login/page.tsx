'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Btn, Icon, Spinner, type IconName, SAFE_TOP, SAFE_BOTTOM } from '../app/drive-ui';
import { BUILD_VERSION } from '../build-version';

/* Brand-Mark im Drive-Stil — Lieferdienst „Mise". */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 6px 16px -6px var(--accent)',
        }}
      >
        <Icon name="bag" size={size * 0.58} stroke={2.1} style={{ color: 'var(--on-accent)' }} />
      </div>
      <span style={{ fontSize: size * 0.62, fontWeight: 800, letterSpacing: '-0.04em' }}>Mise</span>
    </div>
  );
}

/* Stilisierter Karten-Hintergrund (CSS, kein Leaflet) — Strassen + Park-Bloecke. */
function MapHero() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--map-bg, #E7ECE7)',
        backgroundImage: [
          'linear-gradient(90deg, var(--map-road, #fff) 0 6px, transparent 6px)',
          'linear-gradient(0deg, var(--map-road, #fff) 0 6px, transparent 6px)',
        ].join(','),
        backgroundSize: '74px 74px, 74px 74px',
        backgroundPosition: '18px 0, 0 26px',
        opacity: 0.5,
      }}
    >
      {/* ein paar Block-Flaechen fuer Tiefe */}
      {[
        { l: 14, t: 30, w: 46, h: 40 },
        { l: 78, t: 22, w: 58, h: 34, park: true },
        { l: 64, t: 92, w: 70, h: 46 },
        { l: 168, t: 54, w: 52, h: 56, park: true },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.l,
            top: b.t,
            width: b.w,
            height: b.h,
            borderRadius: 8,
            background: b.park ? 'var(--map-park, #D5E6D8)' : 'var(--map-block, #DBE2DC)',
          }}
        />
      ))}
      {/* Hub-Pin links unten */}
      <div style={{ position: 'absolute', left: 56, top: 196, color: 'var(--accent)' }}>
        <Icon name="pin-fill" size={30} />
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  placeholder,
  autoComplete,
  rightSlot,
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'email' | 'numeric' | 'tel' | 'text';
  placeholder?: string;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        height: 60,
        background: 'var(--surface)',
        borderRadius: 16,
        boxShadow: `inset 0 0 0 ${focus ? 2 : 1.5}px ${focus ? 'var(--accent)' : 'var(--line)'}`,
        transition: 'box-shadow .15s ease',
      }}
    >
      <Icon
        name={icon}
        size={21}
        stroke={2}
        style={{ color: focus ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          required
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontSize: 16.5,
            fontWeight: 600,
            color: 'var(--ink)',
            padding: '2px 0 0',
            fontFamily: 'inherit',
          }}
        />
      </div>
      {rightSlot}
    </label>
  );
}

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
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--ink)',
      }}
    >
      {/* Hero mit dezenter Karte */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden', flexShrink: 0 }}>
        <MapHero />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 30%, var(--bg) 92%)',
          }}
        />
        <div style={{ position: 'absolute', top: SAFE_TOP + 8, left: 22 }}>
          <BrandMark size={32} />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '4px 22px 0',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 460,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
          Schicht starten
        </div>
        <div style={{ fontSize: 15.5, color: 'var(--ink-2)', marginTop: 7, fontWeight: 500 }}>
          Melde dich mit deinem Fahrer-Zugang an.
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field
              icon="user"
              label="E-Mail"
              value={email}
              onChange={setEmail}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="du@beispiel.de"
            />
            <Field
              icon="lock"
              label="Passwort"
              value={password}
              onChange={setPassword}
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label="Passwort anzeigen"
                  className="press"
                  style={{ color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, padding: 4 }}
                >
                  {showPwd ? 'verbergen' : 'zeigen'}
                </button>
              }
            />
          </div>

          <button
            type="button"
            onClick={onForgot}
            className="press"
            style={{
              alignSelf: 'flex-start',
              marginTop: 14,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--accent)',
              padding: 0,
            }}
          >
            Passwort vergessen?
          </button>

          {err && (
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--danger-tint)',
                color: 'var(--danger)',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              <Icon name="alert" size={18} stroke={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{err}</span>
            </div>
          )}
          {resetSent && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--accent-tint)',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Falls die E-Mail als Fahrer registriert ist, haben wir dir einen Link zum
              Passwort-Zuruecksetzen geschickt.
            </div>
          )}

          <div style={{ flex: 1, minHeight: 18 }} />
          <div style={{ paddingBottom: SAFE_BOTTOM + 14 }}>
            <Btn type="submit" disabled={busy} icon={busy ? undefined : 'power'}>
              {busy ? <Spinner /> : 'Anmelden & online gehen'}
            </Btn>
            <div
              style={{
                textAlign: 'center',
                marginTop: 14,
                fontSize: 13,
                color: 'var(--ink-3)',
                fontWeight: 500,
              }}
            >
              Nur fuer Fahrer:innen · Zugang per Einladung vom Restaurant
            </div>
            <div className="mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)', opacity: 0.7, textAlign: 'center' }}>v {BUILD_VERSION}</div>
          </div>
        </form>
      </div>
    </div>
  );
}

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/email not confirmed/i.test(msg)) return 'E-Mail noch nicht bestaetigt. Schau in dein Postfach.';
  return 'Anmeldung fehlgeschlagen. Bitte nochmal versuchen.';
}
