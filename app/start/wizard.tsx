'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, MapPin, Mail, Store, User, Lock, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'restaurant', label: 'Restaurant', icon: Store },
  { id: 'owner',      label: 'Du',         icon: User },
  { id: 'location',   label: 'Standort',   icon: MapPin },
  { id: 'account',    label: 'Konto',      icon: Lock },
] as const;

type Form = {
  restaurant_name: string;
  slug: string;
  inhaber_vollname: string;
  telefon: string;
  adresse: string;
  plz: string;
  stadt: string;
  email: string;
  password: string;
};

export function StartWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    restaurant_name: '',
    slug: '',
    inhaber_vollname: '',
    telefon: '',
    adresse: '',
    plz: '',
    stadt: '',
    email: '',
    password: '',
  });

  function upd<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === 'restaurant_name' && !form.slug) {
      setForm((f) => ({ ...f, slug: slugify(v as string) }));
    }
    setError(null);
  }

  const canAdvance = (() => {
    switch (step) {
      case 0: return form.restaurant_name.trim().length >= 2 && /^[a-z0-9-]+$/.test(form.slug);
      case 1: return form.inhaber_vollname.trim().length >= 2 && form.telefon.trim().length >= 5;
      case 2: return form.adresse.trim().length >= 3 && form.plz.trim().length >= 4 && form.stadt.trim().length >= 2;
      case 3: return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) && form.password.length >= 8;
      default: return false;
    }
  })();

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/signup/tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Registrierung fehlgeschlagen');
        return;
      }

      // Auto-Login nach erfolgreicher Registrierung
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const { error: signInErr } = await sb.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      // Preset oder Modul-Liste aus URL weiterreichen
      const sp = new URLSearchParams(window.location.search);
      const preset = sp.get('preset');
      const modules = sp.get('modules');
      const next = preset
        ? `/setup?preset=${preset}`
        : modules
        ? `/setup?modules=${encodeURIComponent(modules)}`
        : '/setup';

      if (signInErr) {
        // Fallback: Login-Page mit Email vorausgefüllt
        router.push(`/login?welcome=1&email=${encodeURIComponent(form.email)}&next=${encodeURIComponent(next)}`);
        return;
      }

      // Session gesetzt → direkt ins Setup
      window.location.href = next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Netzwerkfehler');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero/Header */}
      <header className="border-b bg-matcha-900 text-matcha-50">
        <div className="mx-auto max-w-4xl px-5 py-4 flex items-center gap-3">
          <div className="text-2xl">🍵</div>
          <div>
            <div className="font-display text-lg font-bold leading-none">mise</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-matcha-300 mt-0.5">Das Betriebssystem für dein Restaurant</div>
          </div>
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3" />
            <span>14 Tage alle Module gratis</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Progress */}
        <div className="mb-10 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition shrink-0',
                  done && 'border-matcha-700 bg-matcha-700 text-white',
                  active && 'border-matcha-700 bg-white text-matcha-700 ring-4 ring-matcha-500/20',
                  !done && !active && 'border-border bg-card text-muted-foreground',
                )}>
                  {done ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <div className="hidden sm:block">
                  <div className={cn('text-xs font-bold uppercase tracking-wider', active ? 'text-matcha-700' : 'text-muted-foreground')}>
                    Schritt {i + 1}
                  </div>
                  <div className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {s.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-[2px] flex-1 transition', i < step ? 'bg-matcha-700' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border bg-card p-6 md:p-10 shadow-subtle">
          {step === 0 && (
            <Section
              title="Wie heißt dein Restaurant?"
              sub="Das ist der Name, den deine Kunden später auf der Bestellseite sehen."
            >
              <Field
                label="Restaurant-Name"
                value={form.restaurant_name}
                onChange={(v) => upd('restaurant_name', v)}
                placeholder="z.B. Franky's Farm"
                autoFocus
              />
              <Field
                label="URL-Slug"
                value={form.slug}
                onChange={(v) => upd('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="frankys-farm"
                hint={form.slug ? `Deine Bestellseite: mise-gastro.de/order/${form.slug}` : 'a-z, 0-9, Bindestriche'}
                mono
              />
            </Section>
          )}

          {step === 1 && (
            <Section title="Wer bist du?" sub="Damit wir wissen, wem das Restaurant gehört.">
              <Field
                label="Dein voller Name"
                value={form.inhaber_vollname}
                onChange={(v) => upd('inhaber_vollname', v)}
                placeholder="z.B. Tahar Galai"
                autoFocus
              />
              <Field
                label="Telefon"
                value={form.telefon}
                onChange={(v) => upd('telefon', v)}
                placeholder="+49 151 12345678"
                inputMode="tel"
              />
            </Section>
          )}

          {step === 2 && (
            <Section title="Wo steht dein Restaurant?" sub="Kunden & Fahrer brauchen die Adresse für Lieferungen.">
              <Field
                label="Straße & Hausnummer"
                value={form.adresse}
                onChange={(v) => upd('adresse', v)}
                placeholder="z.B. Pontstraße 42"
                autoFocus
              />
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Field small label="PLZ" value={form.plz} onChange={(v) => upd('plz', v)} placeholder="52062" inputMode="numeric" />
                <Field label="Stadt" value={form.stadt} onChange={(v) => upd('stadt', v)} placeholder="Aachen" />
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="Dein Admin-Konto" sub="Damit meldest du dich später im Cockpit an.">
              <Field
                label="E-Mail"
                value={form.email}
                onChange={(v) => upd('email', v)}
                placeholder="du@restaurant.de"
                icon={<Mail size={14} />}
                inputMode="email"
                autoFocus
              />
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Passwort</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => upd('password', e.target.value)}
                    placeholder="Mind. 8 Zeichen"
                    className="w-full rounded-xl border bg-background px-4 py-3 pr-12 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Passwort anzeigen"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Mit der Registrierung akzeptierst du unsere AGB und Datenschutzbestimmungen.
              </p>
            </Section>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ArrowLeft size={14} /> Zurück
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold font-display transition',
                  canAdvance ? 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800' : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                Weiter <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canAdvance || submitting}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold font-display transition',
                  canAdvance && !submitting ? 'bg-accent text-matcha-900 hover:bg-accent/90' : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {submitting ? 'Richte ein …' : 'Restaurant starten'}
              </button>
            )}
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          Schon dabei? <a href="/login" className="text-matcha-700 font-semibold underline">Anmelden</a>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, icon, hint, mono, small, inputMode, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  hint?: string;
  mono?: boolean;
  small?: boolean;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
  autoFocus?: boolean;
}) {
  return (
    <div className={small ? 'w-28' : undefined}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          className={cn(
            'w-full rounded-xl border bg-background py-3 outline-none transition focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20',
            icon ? 'pl-10 pr-4' : 'px-4',
            mono && 'font-mono text-sm',
          )}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
