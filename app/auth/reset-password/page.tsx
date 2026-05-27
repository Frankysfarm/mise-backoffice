'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (password.length < 8) {
      setErr('Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setErr(
        error.message.includes('expired')
          ? 'Link abgelaufen — bitte neuen Reset anfordern.'
          : error.message,
      );
      return;
    }

    router.replace('/login?reset=1');
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-surface via-white to-matcha-100/30">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-matcha-900/5 ring-1 ring-zinc-100">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Lock size={20} />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold tracking-tight">
          Neues Passwort
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Wähl ein sicheres Passwort — mindestens 8 Zeichen.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="pwd" className="text-xs font-semibold text-zinc-700">
              Neues Passwort
            </label>
            <div className="relative mt-1.5">
              <input
                id="pwd"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border border-zinc-200 bg-white py-3 pl-3 pr-10 text-sm focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="text-xs font-semibold text-zinc-700">
              Bestätigen
            </label>
            <input
              id="confirm"
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white py-3 px-3 text-sm focus:border-matcha-700 focus:outline-none focus:ring-2 focus:ring-matcha-700/20"
            />
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm text-red-900">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-matcha-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-matcha-900/20 transition-all hover:bg-matcha-800 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Speichere…
              </>
            ) : (
              <>
                <Check size={15} /> Passwort setzen
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/login" className="hover:text-foreground underline-offset-2 hover:underline">
            Zum Login
          </Link>
        </p>
      </div>
    </div>
  );
}
