'use client';

/**
 * /driver/setup
 *
 * Landing für den Magic-Invite-Link aus der Driver-Invite-Mail.
 *
 * Supabase leitet hierhin um nach Klick auf den Magic-Link mit access_token
 * + refresh_token im URL-Hash. Der Browser-Client liest die automatisch ein
 * (`detectSessionInUrl: true`). Danach kann der Driver sein Passwort setzen.
 */
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; email: string }
  | { kind: 'no-session' }
  | { kind: 'saving'; email: string }
  | { kind: 'done' }
  | { kind: 'error'; email: string; msg: string };

export default function DriverSetupPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: false } },
    );
    (async () => {
      // Supabase kann den Token in 3 Formaten mitgeben — alle handhaben:
      //  1. ?token_hash=xxx&type=invite|recovery   (PKCE-Style, neueres Format)
      //  2. ?token=xxx&type=invite|recovery        (legacy)
      //  3. #access_token=xxx&refresh_token=yyy    (hash-style, supabase-js liest auto)
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');
      const type = url.searchParams.get('type');
      const errorDescription =
        url.searchParams.get('error_description') ??
        new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description');

      if (errorDescription) {
        setState({ kind: 'no-session' });
        return;
      }

      if (
        tokenHash &&
        (type === 'invite' || type === 'recovery' || type === 'magiclink' || type === 'email')
      ) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite' | 'recovery' | 'magiclink' | 'email',
        });
        if (vErr) {
          setState({ kind: 'no-session' });
          return;
        }
        window.history.replaceState({}, '', '/driver/setup');
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setState({ kind: 'no-session' });
        return;
      }
      setState({ kind: 'ready', email: data.session.user.email ?? '' });
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== 'ready' && state.kind !== 'error') return;
    const email = state.email;
    if (pw1.length < 8) return setState({ kind: 'error', email, msg: 'Passwort braucht mindestens 8 Zeichen.' });
    if (pw1 !== pw2) return setState({ kind: 'error', email, msg: 'Passwörter stimmen nicht überein.' });
    setState({ kind: 'saving', email });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: false } },
    );
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) return setState({ kind: 'error', email, msg: error.message });
    setState({ kind: 'done' });
  }

  const showForm =
    state.kind === 'ready' || state.kind === 'saving' || state.kind === 'error';
  const formEmail = showForm ? state.email : '';

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#F5F1E8',
        color: '#141414',
        fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span
            style={{
              fontFamily: 'Georgia,serif',
              fontStyle: 'italic',
              fontWeight: 900,
              fontSize: 48,
              letterSpacing: -2,
            }}
          >
            Mise<span style={{ color: '#E8B105' }}>.</span>
          </span>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#6B6B6B',
            }}
          >
            Driver-Setup
          </p>
        </div>

        {state.kind === 'loading' && (
          <Card>
            <p>Einen Moment …</p>
          </Card>
        )}

        {state.kind === 'no-session' && (
          <Card>
            <h2 style={H2}>Link abgelaufen oder ungültig</h2>
            <p style={P}>
              Der Einladungs-Link ist abgelaufen oder wurde schon benutzt.
              Bitte das Restaurant um eine neue Einladung.
            </p>
          </Card>
        )}

        {showForm && (
          <Card>
            <h2 style={H2}>Passwort setzen</h2>
            <p style={{ ...P, marginBottom: 20 }}>
              Für <strong>{formEmail}</strong>. Mit diesem Passwort loggst du dich
              in der Mise Driver App ein.
            </p>
            <form onSubmit={save}>
              <Field label="Neues Passwort" value={pw1} onChange={setPw1} type="password" placeholder="mind. 8 Zeichen" />
              <Field label="Passwort wiederholen" value={pw2} onChange={setPw2} type="password" />
              {state.kind === 'error' && (
                <p style={{ color: '#E8542A', fontSize: 14, margin: '8px 0 0 0' }}>{state.msg}</p>
              )}
              <button
                disabled={state.kind === 'saving'}
                style={{
                  marginTop: 20,
                  width: '100%',
                  padding: '16px',
                  borderRadius: 14,
                  background: '#E8B105',
                  color: '#141414',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 'none',
                  cursor: state.kind === 'saving' ? 'wait' : 'pointer',
                }}
              >
                {state.kind === 'saving' ? 'Speichere …' : 'Passwort speichern'}
              </button>
            </form>
          </Card>
        )}

        {state.kind === 'done' && (
          <Card>
            <h2 style={H2}>Fertig 👍</h2>
            <p style={P}>
              Dein Passwort ist gesetzt. Lade jetzt die <strong>Mise Driver</strong> App
              aus dem App Store und logge dich mit deiner Email + dem neuen Passwort ein.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ECE5D3', borderRadius: 20, padding: 28 }}>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 13, color: '#6B6B6B', marginBottom: 6 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid #D9D1BC',
          fontSize: 16,
          background: '#FAF6EE',
          color: '#141414',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

const H2: React.CSSProperties = { margin: '0 0 12px 0', fontSize: 22, fontWeight: 700 };
const P: React.CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.55, color: '#141414' };
