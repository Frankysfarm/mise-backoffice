'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertCircle, Building2, Check, CreditCard, ExternalLink, Euro, Globe, Landmark, Loader2,
  MapPin, Palette, Receipt, Store, Truck,
} from 'lucide-react';
import { saveRestaurantSettings } from './actions';

type Tenant = {
  id: string; name: string; slug: string; email: string | null; telefon: string | null;
  inhaber_vollname: string | null; adresse: string | null; stadt: string | null; plz: string | null;
  ustid: string | null; steuernummer: string | null; handelsregister: string | null;
  impressum_text: string | null;
  agb_url: string | null; widerruf_url: string | null; datenschutz_url: string | null;
  bank_iban: string | null; bank_bic: string | null; bank_inhaber: string | null;
  lieferradius_km: number | null; liefergebuehr: number | null; mindestbestellwert: number | null;
  theme_primary: string | null; theme_accent: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean; stripe_connect_payouts_enabled: boolean;
  stripe_connect_details_submitted: boolean;
  plan: string;
};

export function RestaurantSettings({
  tenant, stripeFlash, stripeError, stripeConfigured,
}: {
  tenant: Tenant; stripeFlash?: string; stripeError?: string; stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'stammdaten' | 'zahlung' | 'lieferung' | 'recht' | 'design'>('stammdaten');
  const [saving, startSaving] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  async function onSave(formData: FormData) {
    startSaving(async () => {
      const res = await saveRestaurantSettings(formData);
      if (res.ok) {
        setFlash('Gespeichert ✓');
        setTimeout(() => setFlash(null), 2000);
      } else {
        setFlash(`Fehler: ${res.error}`);
      }
    });
  }

  async function connectStripe() {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
      } else {
        setFlash(`Stripe-Fehler: ${json.error}`);
        setStripeLoading(false);
      }
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Fehler');
      setStripeLoading(false);
    }
  }

  const TABS = [
    { id: 'stammdaten', label: 'Stammdaten', icon: Building2 },
    { id: 'zahlung',    label: 'Zahlung',    icon: CreditCard },
    { id: 'lieferung',  label: 'Lieferung',  icon: Truck },
    { id: 'recht',      label: 'Recht',      icon: Receipt },
    { id: 'design',     label: 'Design',     icon: Palette },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Flash */}
      {(stripeFlash || stripeError || flash) && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm flex items-center gap-2',
          stripeError ? 'border-red-300 bg-red-50 text-red-900' : 'border-matcha-300 bg-matcha-50 text-matcha-900',
        )}>
          {stripeError ? <AlertCircle size={16} /> : <Check size={16} />}
          {stripeError ? `Stripe-Fehler: ${stripeError}` :
           stripeFlash === 'done' ? 'Stripe-Verbindung aktualisiert.' :
           stripeFlash === 'refresh' ? 'Bitte Onboarding erneut starten.' :
           flash}
        </div>
      )}

      {/* Tenant-Header */}
      <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-matcha-900 to-matcha-700 text-white">
        <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center text-3xl">
          🍵
        </div>
        <div className="flex-1">
          <div className="font-display text-2xl font-bold">{tenant.name}</div>
          <div className="text-sm text-matcha-200 font-mono">mise-gastro.de/order/{tenant.slug}</div>
        </div>
        <a
          href={`/order/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs hover:bg-white/20"
        >
          <ExternalLink size={12} /> Bestellseite öffnen
        </a>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition whitespace-nowrap border-b-2 -mb-[1px]',
                active ? 'border-matcha-700 text-matcha-900' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <form action={onSave} className="space-y-4">
        {tab === 'stammdaten' && (
          <Card className="p-6 space-y-4">
            <Section title="Restaurant" icon={<Store size={14} />}>
              <TwoCol>
                <Field name="name" label="Name" defaultValue={tenant.name} required />
                <Field name="inhaber_vollname" label="Inhaber (Vollname)" defaultValue={tenant.inhaber_vollname} />
              </TwoCol>
              <TwoCol>
                <Field name="email" label="E-Mail" type="email" defaultValue={tenant.email} />
                <Field name="telefon" label="Telefon" defaultValue={tenant.telefon} />
              </TwoCol>
            </Section>

            <Section title="Adresse" icon={<MapPin size={14} />}>
              <Field name="adresse" label="Straße & Hausnummer" defaultValue={tenant.adresse} />
              <TwoCol cols="3fr 1fr">
                <Field name="stadt" label="Stadt" defaultValue={tenant.stadt} />
                <Field name="plz" label="PLZ" defaultValue={tenant.plz} />
              </TwoCol>
            </Section>
          </Card>
        )}

        {tab === 'zahlung' && (
          <div className="space-y-4">
            {/* Stripe Connect Card */}
            <Card className="p-6">
              <Section title="Stripe Connect — Online-Zahlung" icon={<Globe size={14} />}>
                {!stripeConfigured ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold">Stripe noch nicht eingerichtet</div>
                      <div>Der Plattform-Betreiber muss <code className="bg-amber-100 px-1 rounded">STRIPE_SECRET_KEY</code> in <code className="bg-amber-100 px-1 rounded">.env</code> setzen, damit du deinen Stripe-Account verbinden kannst.</div>
                    </div>
                  </div>
                ) : tenant.stripe_connect_charges_enabled && tenant.stripe_connect_payouts_enabled ? (
                  <div className="flex items-center gap-3 rounded-xl border border-matcha-300 bg-matcha-50 px-4 py-3">
                    <div className="h-10 w-10 rounded-full bg-matcha-500 text-white flex items-center justify-center">
                      <Check size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-matcha-900">Stripe ist verbunden & aktiv.</div>
                      <div className="text-xs text-matcha-700">
                        Kunden können online bezahlen. Account-ID: <span className="font-mono">{tenant.stripe_connect_account_id}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={connectStripe}
                      className="text-xs underline text-matcha-700"
                    >
                      Dashboard öffnen
                    </button>
                  </div>
                ) : tenant.stripe_connect_account_id ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900">Stripe-Onboarding noch nicht abgeschlossen</div>
                      <div className="text-xs text-amber-800 mt-1">
                        Charges: {tenant.stripe_connect_charges_enabled ? '✓' : '✗'} ·{' '}
                        Payouts: {tenant.stripe_connect_payouts_enabled ? '✓' : '✗'} ·{' '}
                        Details: {tenant.stripe_connect_details_submitted ? '✓' : '✗'}
                      </div>
                      <button
                        type="button"
                        onClick={connectStripe}
                        disabled={stripeLoading}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-700 text-white px-4 py-2 text-sm font-bold hover:bg-amber-800 disabled:opacity-50"
                      >
                        {stripeLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                        Onboarding fortsetzen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-matcha-500/30 bg-matcha-50/50 p-6 text-center">
                    <div className="h-14 w-14 mx-auto rounded-full bg-matcha-100 flex items-center justify-center mb-3">
                      <CreditCard size={22} className="text-matcha-700" />
                    </div>
                    <div className="font-display font-bold text-lg">Jetzt Stripe verbinden</div>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      Damit Kunden online mit Karte, PayPal oder Apple Pay bezahlen können. Das Geld geht direkt auf dein Konto. 2% Plattform-Gebühr.
                    </p>
                    <button
                      type="button"
                      onClick={connectStripe}
                      disabled={stripeLoading}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-3 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
                    >
                      {stripeLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Mit Stripe verbinden
                    </button>
                  </div>
                )}
              </Section>
            </Card>

            {/* Bank */}
            <Card className="p-6">
              <Section title="Bankverbindung (für Rechnungen)" icon={<Landmark size={14} />}>
                <Field name="bank_inhaber" label="Kontoinhaber" defaultValue={tenant.bank_inhaber} />
                <TwoCol>
                  <Field name="bank_iban" label="IBAN" defaultValue={tenant.bank_iban} mono />
                  <Field name="bank_bic" label="BIC" defaultValue={tenant.bank_bic} mono />
                </TwoCol>
              </Section>
            </Card>

            <div className="rounded-xl border bg-muted/50 p-4 text-sm">
              <a href="/settings/payments" className="text-matcha-700 font-semibold hover:underline">
                → Zahlungsmethoden-Matrix (Bar, Karte, Online für Lieferung/Abholung)
              </a>
            </div>
          </div>
        )}

        {tab === 'lieferung' && (
          <Card className="p-6">
            <Section title="Lieferzone & Kosten" icon={<Truck size={14} />}>
              <TwoCol>
                <Field name="lieferradius_km" label="Lieferradius (km)" type="number" step="0.5" defaultValue={tenant.lieferradius_km?.toString()} suffix="km" />
                <Field name="liefergebuehr" label="Liefergebühr" type="number" step="0.10" defaultValue={tenant.liefergebuehr?.toString()} suffix="€" />
              </TwoCol>
              <Field name="mindestbestellwert" label="Mindestbestellwert für Lieferung" type="number" step="1" defaultValue={tenant.mindestbestellwert?.toString()} suffix="€" />
            </Section>
          </Card>
        )}

        {tab === 'recht' && (
          <Card className="p-6">
            <Section title="Steuer" icon={<Receipt size={14} />}>
              <TwoCol>
                <Field name="ustid" label="USt-ID" defaultValue={tenant.ustid} placeholder="DE123456789" mono />
                <Field name="steuernummer" label="Steuernummer" defaultValue={tenant.steuernummer} />
              </TwoCol>
              <Field name="handelsregister" label="Handelsregister" defaultValue={tenant.handelsregister} placeholder="HRB 12345 · AG Aachen" />
            </Section>

            <Section title="Pflichtangaben">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Impressum-Text</label>
                <textarea
                  name="impressum_text"
                  defaultValue={tenant.impressum_text ?? ''}
                  rows={6}
                  className="mt-1.5 w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
                  placeholder="Franky's Farm GmbH · Pontstr. 42 · 52062 Aachen · Geschäftsführer: ..."
                />
              </div>
              <TwoCol>
                <Field name="agb_url" label="AGB (URL)" defaultValue={tenant.agb_url} placeholder="https://..." />
                <Field name="widerruf_url" label="Widerruf (URL)" defaultValue={tenant.widerruf_url} placeholder="https://..." />
              </TwoCol>
              <Field name="datenschutz_url" label="Datenschutz (URL)" defaultValue={tenant.datenschutz_url} placeholder="https://..." />
            </Section>
          </Card>
        )}

        {tab === 'design' && (
          <Card className="p-6">
            <Section title="Farben" icon={<Palette size={14} />}>
              <TwoCol>
                <Field name="theme_primary" label="Primärfarbe (hex)" defaultValue={tenant.theme_primary} mono />
                <Field name="theme_accent" label="Akzentfarbe (hex)" defaultValue={tenant.theme_accent} mono />
              </TwoCol>
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground mb-2">Vorschau:</div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: tenant.theme_primary ?? '#14532d' }} />
                  <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: tenant.theme_accent ?? '#4ae68a' }} />
                  <div className="text-xs text-muted-foreground">Hex-Werte wie <code>#14532d</code>. Änderungen werden auf der Bestellseite angewendet (kommt bald).</div>
                </div>
              </div>
            </Section>
          </Card>
        )}

        {/* Submit-Bar — immer sichtbar außer bei Zahlung (da ist Stripe-Flow separat) */}
        {tab !== 'zahlung' && (
          <div className="sticky bottom-4 z-10 rounded-2xl border bg-card shadow-strong p-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground pl-2">
              Änderungen werden für dein Restaurant übernommen.
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Speichern
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TwoCol({ children, cols = '1fr 1fr' }: { children: React.ReactNode; cols?: string }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: cols }}>{children}</div>;
}

function Field({
  name, label, defaultValue, placeholder, type = 'text', step, required, mono, suffix,
}: {
  name: string; label: string; defaultValue?: string | number | null; placeholder?: string;
  type?: string; step?: string; required?: boolean; mono?: boolean; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <input
          name={name}
          type={type}
          step={step}
          required={required}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20',
            mono && 'font-mono text-sm',
            suffix && 'pr-12',
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
