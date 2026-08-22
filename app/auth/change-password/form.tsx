'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, Loader2, Lock, Shield } from 'lucide-react';

export function ChangePasswordForm({ vorname, forced, next }: { vorname: string; forced: boolean; next: string }) {
  const router = useRouter();
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = (() => {
    if (pw1.length === 0) return { label: '', pct: 0, color: 'bg-muted' };
    let score = 0;
    if (pw1.length >= 8) score++;
    if (pw1.length >= 12) score++;
    if (/[a-z]/.test(pw1) && /[A-Z]/.test(pw1)) score++;
    if (/\d/.test(pw1)) score++;
    if (/[^a-zA-Z0-9]/.test(pw1)) score++;
    if (score <= 2) return { label: 'Schwach', pct: 33, color: 'bg-red-400' };
    if (score <= 3) return { label: 'Mittel', pct: 66, color: 'bg-gold' };
    return { label: 'Stark', pct: 100, color: 'bg-matcha-500' };
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) return setError('Mindestens 8 Zeichen');
    if (pw1 !== pw2) return setError('Passwörter stimmen nicht überein');
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw1 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Fehler');
        return;
      }
      setDone(true);
      setTimeout(() => router.push(next), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Netzwerk-Fehler');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-matcha-900 flex items-center justify-center p-6 text-white">
        <div className="max-w-sm w-full text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-accent text-matcha-900 flex items-center justify-center mb-4">
            <Check size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold">Passwort gesetzt!</h1>
          <p className="text-matcha-200 mt-2">Einen Moment, weiter geht's …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matcha-900 flex items-center justify-center p-6 text-white">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-accent" />
          </div>
          {forced ? (
            <>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                Willkommen, {vorname}.
              </h1>
              <p className="text-matcha-200 mt-2">
                Bevor du loslegst — setz ein eigenes Passwort. Das aus der Einladung war nur temporär.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold tracking-tight">Passwort ändern</h1>
              <p className="text-matcha-200 mt-2">Wähle ein neues, sicheres Passwort.</p>
            </>
          )}
        </div>

        <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 backdrop-blur">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-matcha-200">Neues Passwort</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-matcha-300" />
              <input
                type={show ? 'text' : 'password'}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                autoFocus
                className="w-full rounded-xl bg-matcha-950/50 border border-white/10 pl-10 pr-12 py-3 text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="Mind. 8 Zeichen"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-matcha-300 hover:text-white"
                aria-label="Anzeigen"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Stärke-Balken */}
            {pw1.length > 0 && (
              <div className="mt-2">
                <div className="h-1 bg-matcha-950/50 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                </div>
                <div className="text-xs text-matcha-300 mt-1">{strength.label}</div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-matcha-200">Wiederholen</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-matcha-300" />
              <input
                type={show ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-xl bg-matcha-950/50 border border-white/10 pl-10 pr-3 py-3 text-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || pw1.length < 8 || pw1 !== pw2}
            className="w-full h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold hover:bg-accent/90 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Passwort festlegen
          </button>
        </form>

        <p className="text-center text-xs text-matcha-400 mt-4">
          Dein Passwort wird verschlüsselt gespeichert. Wir sehen es nicht.
        </p>
      </div>
    </div>
  );
}
