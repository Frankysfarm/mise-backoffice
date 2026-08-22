'use client';

import { useState } from 'react';
import {
  Loader2, ArrowRight, CheckCircle2, AlertCircle, Sparkles,
  CreditCard, Eye, EyeOff, Copy, ExternalLink, Key,
  Banknote, Shield, Trash2, RefreshCw, Smartphone, ShoppingBag,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  tenantName: string;
  publishableKey: string | null;
  accountEmail: string | null;
  country: string | null;
  mode: 'test' | 'live' | null;
  connectedAt: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export function StripeSelfServiceClient(props: Props) {
  const isConnected = !!props.publishableKey;

  if (isConnected) return <ConnectedState {...props} />;
  return <SetupWizard {...props} />;
}

// ─── CONNECTED STATE ─────────────────────────────────

function ConnectedState(props: Props) {
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!confirm('Wirklich Stripe trennen? Online-Zahlungen sind dann deaktiviert.')) return;
    setBusy(true);
    await fetch('/api/stripe/connect-tenant', { method: 'DELETE' });
    window.location.reload();
  }

  const fully = props.chargesEnabled && props.payoutsEnabled && props.detailsSubmitted;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-emerald-50/40 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle2 size={22} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-emerald-900">Stripe ist verbunden</h3>
              {props.mode === 'test' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Test-Modus
                </span>
              )}
              {props.mode === 'live' && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Live
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-emerald-900/80">
              {props.accountEmail ?? 'Konto'}{props.country ? ` · ${props.country.toUpperCase()}` : ''}
              {props.connectedAt && (
                <> · seit {new Date(props.connectedAt).toLocaleDateString('de-DE')}</>
              )}
            </p>
            {!fully && (
              <p className="mt-2 text-xs text-amber-700">
                ⚠️ Stripe-Onboarding noch nicht ganz fertig — manche Felder fehlen. Auf <a href="https://dashboard.stripe.com" target="_blank" className="underline">dashboard.stripe.com</a> komplettieren.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-emerald-200/50 pt-4">
          <StatusItem icon={<Shield size={14} />} label="Daten OK" ok={props.detailsSubmitted} />
          <StatusItem icon={<CreditCard size={14} />} label="Karten aktiv" ok={props.chargesEnabled} />
          <StatusItem icon={<Banknote size={14} />} label="Auszahlungen" ok={props.payoutsEnabled} />
        </div>
      </Card>

      <Card className="p-5">
        <h4 className="text-sm font-semibold mb-3">Was Kunden jetzt sehen</h4>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: '🍎', label: 'Apple Pay', enabled: props.chargesEnabled },
            { icon: 'G', label: 'Google Pay', enabled: props.chargesEnabled },
            { icon: '💳', label: 'Visa / Mastercard / Amex', enabled: props.chargesEnabled },
            { icon: '🏦', label: 'SEPA-Lastschrift', enabled: props.chargesEnabled && props.country === 'DE' },
            { icon: 'K', label: 'Klarna', enabled: props.chargesEnabled },
          ].map((p) => (
            <span
              key={p.label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
                p.enabled
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-50 text-zinc-400 line-through',
              )}
            >
              <span>{p.icon}</span> {p.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50"
        >
          <ExternalLink size={14} /> Stripe-Dashboard öffnen
        </a>
        <button
          onClick={disconnect}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Trennen
        </button>
      </div>
    </div>
  );
}

// ─── SETUP WIZARD ────────────────────────────────────

function SetupWizard(props: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pk, setPk] = useState('');
  const [sk, setSk] = useState('');
  const [showSk, setShowSk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setBusy(true);
    const res = await fetch('/api/stripe/connect-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishableKey: pk.trim(), secretKey: sk.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Verbinden fehlgeschlagen.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition',
                step >= n
                  ? 'border-violet-600 bg-violet-600 text-white'
                  : 'border-zinc-200 bg-white text-zinc-400',
              )}
            >
              {step > n ? <CheckCircle2 size={14} /> : n}
            </div>
            {n < 3 && (
              <div
                className={cn(
                  'h-0.5 flex-1 transition',
                  step > n ? 'bg-violet-600' : 'bg-zinc-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1 — Account-Erklärung */}
      {step === 1 && (
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-6 text-white">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={11} /> Schritt 1 von 3
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">
              Hast du schon einen Stripe-Account?
            </h2>
            <p className="mt-1 text-sm text-violet-100">
              Stripe ist der Bezahl-Dienst, der die Online-Zahlung abwickelt — Apple Pay, Google Pay und Karten.
            </p>
          </div>
          <div className="p-6 space-y-3">
            <button
              onClick={() => setStep(2)}
              className="group flex w-full items-center gap-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/80 transition"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <CheckCircle2 size={18} />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Ja, ich habe schon einen</div>
                <div className="text-xs text-muted-foreground mt-0.5">Direkt zur API-Eingabe</div>
              </div>
              <ArrowRight size={16} className="text-emerald-700 transition-transform group-hover:translate-x-0.5" />
            </button>

            <a
              href="https://dashboard.stripe.com/register"
              target="_blank"
              rel="noreferrer"
              onClick={() => setStep(2)}
              className="group flex w-full items-center gap-4 rounded-xl border-2 border-violet-200 bg-violet-50/40 p-4 text-left hover:border-violet-300 hover:bg-violet-50/80 transition"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Key size={18} />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Nein, jetzt erstellen</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Öffnet stripe.com in neuem Tab → Account anlegen → komm zurück
                </div>
              </div>
              <ExternalLink size={16} className="text-violet-700" />
            </a>

            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-muted-foreground">
              <strong>Was ist Stripe?</strong> Marktführer für Online-Zahlungen, in 47 Ländern aktiv. Du brauchst nur deine IBAN, USt-ID und Personalausweis. <strong>Keine monatlichen Kosten</strong> — du zahlst nur ~1,5 % + 0,25 € pro erfolgreicher Zahlung.
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2 — Keys finden */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-6 text-white">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles size={11} /> Schritt 2 von 3
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold">
                API-Schlüssel finden & kopieren
              </h2>
              <p className="mt-1 text-sm text-violet-100">
                Wir brauchen 2 Schlüssel von deinem Stripe-Account. Nimm dir 2 Min Zeit — danach läuft alles automatisch.
              </p>
            </div>

            {/* Was ist ein API-Key — Erklär-Box */}
            <div className="border-b bg-violet-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Key size={16} />
                </div>
                <div className="text-sm text-zinc-700">
                  <strong className="text-violet-900">Was ist ein API-Key?</strong> Stell dir das wie einen <em>digitalen Generalschlüssel</em> für dein Stripe-Konto vor. Damit darf unser System in deinem Namen Zahlungen einsammeln. Es gibt zwei davon: <strong>Publishable</strong> (öffentlich, harmlos — der erscheint im Browser) und <strong>Secret</strong> (geheim, nur Server — niemals teilen).
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Schritt 1: Direkt-Link */}
              <Step
                n={1}
                title="Auf die Stripe API-Seite gehen"
                action={
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    🔓 Seite öffnen <ExternalLink size={11} />
                  </a>
                }
              >
                Klick den Button. Falls du noch nicht eingeloggt bist, log dich bei Stripe ein. Du landest direkt auf der API-Schlüssel-Seite.
              </Step>

              {/* Schritt 2: Test/Live mit Mockup */}
              <Step n={2} title="Test- oder Live-Modus wählen (oben rechts)">
                <div className="mt-2 space-y-3">
                  <p>
                    Oben rechts in Stripe siehst du einen Schalter:
                  </p>
                  {/* Mock Stripe header */}
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3 border-b pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-gradient-to-br from-violet-500 to-violet-700" />
                        <span className="text-xs font-bold">Stripe Dashboard</span>
                      </div>
                      <div className="relative">
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800 ring-2 ring-amber-300 ring-offset-1">
                          🔘 Test-Modus
                        </div>
                        <div className="absolute -bottom-1 -right-1 animate-bounce">
                          <div className="text-base">👈</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      🟡 Test-Modus = orange/gelber Banner oben &nbsp;·&nbsp; 🟢 Live-Modus = grau/dunkel
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                    <strong>💡 Empfehlung:</strong> Starte mit <strong>Test-Modus</strong>! Dann kannst du mit fake-Karten Probe-Bestellungen machen, ohne echtes Geld zu bewegen.
                  </div>
                </div>
              </Step>

              {/* Schritt 3: Publishable Key Mockup */}
              <Step n={3} title="Publishable Key kopieren">
                <div className="mt-2 space-y-3">
                  <p>
                    Auf der Seite siehst du eine Zeile <strong>„Publishable key"</strong>. Klick rechts auf das <strong>👁 Auge / „Reveal"</strong> oder direkt das <strong>📋 Copy-Symbol</strong>:
                  </p>
                  {/* Mock row */}
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-700">Publishable key</div>
                        <code className="text-[11px] font-mono text-zinc-600">pk_test_51AbCdEfGhIjKlMnOpQrStUv…</code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">öffentlich</span>
                        <button className="rounded p-1.5 text-zinc-500 hover:bg-violet-100 hover:text-violet-700 ring-2 ring-violet-300 animate-pulse">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Beginnt mit <code className="rounded bg-zinc-100 px-1 py-0.5">pk_test_</code> (Test) oder <code className="rounded bg-zinc-100 px-1 py-0.5">pk_live_</code> (Live).
                  </p>
                </div>
              </Step>

              {/* Schritt 4: Secret Key Mockup */}
              <Step n={4} title="Secret Key kopieren 🔒 (geheim!)">
                <div className="mt-2 space-y-3">
                  <p>
                    Direkt darunter: <strong>„Secret key"</strong>. Hier musst du erst auf <strong>„Reveal test key"</strong> oder <strong>„Reveal live key"</strong> klicken — Stripe zeigt den Wert nur einmal:
                  </p>
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-700">Secret key</div>
                        <code className="text-[11px] font-mono text-zinc-600">sk_test_51AbCdEf••••••••••••</code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">geheim</span>
                        <button className="rounded bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 ring-2 ring-violet-300 animate-pulse">
                          Reveal
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-900">
                    ⚠️ <strong>Niemals</strong> diesen Key in WhatsApp, Mail, Slack oder Code committen. Er gibt vollen Zugriff auf dein Konto.
                  </div>
                </div>
              </Step>

              <button
                onClick={() => setStep(3)}
                className="group inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"
              >
                Habe beide Keys → Eintragen <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </Card>

          {/* FAQ */}
          <details className="group rounded-xl border border-zinc-200 bg-white">
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold flex items-center justify-between hover:bg-zinc-50 list-none">
              <span>❓ Häufige Fragen</span>
              <span className="text-zinc-400 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div className="border-t px-5 py-4 space-y-3 text-xs">
              <Faq q="Stripe verlangt Identitäts-Verifikation — muss ich das vorher abschließen?">
                Für <strong>Test-Modus</strong> nein, du kannst sofort starten. Für <strong>Live-Modus</strong> ja: Stripe verlangt Personalausweis, IBAN, USt-ID. Dauert ~5 Min auf <a href="https://dashboard.stripe.com/account/onboarding" target="_blank" className="underline">stripe.com</a>. Erst dann werden die Live-Keys aktiv.
              </Faq>
              <Faq q="Was kostet Stripe?">
                Keine Monatskosten. ~1,4 % + 0,25 € pro erfolgreicher EU-Karten-Zahlung. Apple/Google Pay: gleicher Tarif. American Express: ~2,5 %. SEPA: 0,80 € fix.
              </Faq>
              <Faq q="Wo geht das Geld hin?">
                Direkt auf deine bei Stripe hinterlegte IBAN. Auszahlungen täglich oder wöchentlich konfigurierbar — meist 2–7 Bankarbeitstage nach Zahlung.
              </Faq>
              <Faq q="Wenn ich mehr als ein Restaurant habe — brauche ich mehrere Stripe-Accounts?">
                Nein. Du kannst denselben Stripe-Account für alle deine Filialen / Marken verbinden. Pro Tenant trägst du nur einmal die Keys ein.
              </Faq>
              <Faq q="Kann ich später vom Test-Modus auf Live wechseln?">
                Ja. Geh zurück auf <code>/settings/stripe</code>, klick „Trennen", trag die Live-Keys ein.
              </Faq>
            </div>
          </details>

          {/* Test-Karten Cheatsheet */}
          <Card className="bg-amber-50/60 border-amber-200 p-5">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              💳 Test-Karten für den Test-Modus
            </h4>
            <p className="text-xs text-amber-900/80 mb-3">
              Diese Nummern funktionieren nur im Test-Modus — kein echtes Geld wird abgebucht. Beliebiges zukünftiges Ablaufdatum + 3 Ziffern als CVC.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <TestCard nr="4242 4242 4242 4242" desc="Visa · funktioniert immer" />
              <TestCard nr="5555 5555 5555 4444" desc="Mastercard" />
              <TestCard nr="3782 822463 10005" desc="American Express" />
              <TestCard nr="4000 0000 0000 9995" desc="Wird abgelehnt (Test für Fehlerfall)" />
            </div>
          </Card>
        </div>
      )}


      {/* STEP 3 — Keys eintragen */}
      {step === 3 && (
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-6 text-white">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={11} /> Schritt 3 von 3
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">
              Schlüssel hier einfügen
            </h2>
            <p className="mt-1 text-sm text-violet-100">
              Wir prüfen automatisch, ob die Schlüssel funktionieren. Geht in 3 Sekunden.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700">
                Publishable Key
              </label>
              <input
                value={pk}
                onChange={(e) => setPk(e.target.value)}
                placeholder="pk_test_51AbCdEf… oder pk_live_…"
                className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Beginnt mit <code>pk_</code> — von <a href="https://dashboard.stripe.com/apikeys" target="_blank" className="underline">dashboard.stripe.com/apikeys</a>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700">
                Secret Key 🔒
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showSk ? 'text' : 'password'}
                  value={sk}
                  onChange={(e) => setSk(e.target.value)}
                  placeholder="sk_test_51AbCdEf… oder sk_live_…"
                  className="block w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-10 font-mono text-xs focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowSk((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {showSk ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Geheim! Wird verschlüsselt gespeichert und nie wieder angezeigt.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-900">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(2); setError(null); }}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium hover:bg-zinc-50"
              >
                Zurück
              </button>
              <button
                onClick={connect}
                disabled={busy || !pk || !sk}
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Prüfe Schlüssel…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Verbinden
                  </>
                )}
              </button>
            </div>

            <div className="rounded-lg border bg-zinc-50/60 p-3 text-xs text-muted-foreground">
              <strong>Was passiert dann?</strong> Wir machen einen Test-Aufruf bei Stripe, um zu prüfen, ob die Schlüssel gültig sind. Wenn ja → speichern wir sie verschlüsselt und auf deinem Liefer-Shop sehen Kunden sofort „Online bezahlen" als Option.
            </div>
          </div>
        </Card>
      )}

      {/* Vorschau: Was Kunden sehen */}
      <Card className="border-zinc-100 bg-zinc-50/40 p-5">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ShoppingBag size={14} /> Vorschau — so sieht's für Kunden aus
        </h4>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold mb-2">Bezahlmethode</div>
          <div className="space-y-2">
            {[
              { icon: '🍎', label: 'Apple Pay', sub: 'Touch ID / Face ID' },
              { icon: 'G', label: 'Google Pay', sub: 'Sofort & sicher' },
              { icon: '💳', label: 'Kreditkarte', sub: 'Visa, Mastercard, Amex' },
              { icon: '🏦', label: 'SEPA-Lastschrift', sub: 'Per IBAN' },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-3 rounded-lg border p-2.5 opacity-60">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold">
                  {p.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900 text-center">
            🔒 Verfügbar sobald Stripe verbunden
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────

function Step({
  n, title, children, action,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
          {n}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{title}</h4>
            {action}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusItem({
  icon, label, ok,
}: { icon: React.ReactNode; label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full',
          ok ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-400',
        )}
      >
        {ok ? <CheckCircle2 size={13} /> : icon}
      </div>
      <span className={cn('text-xs', ok ? 'font-medium' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold list-none flex items-start gap-2 hover:text-violet-700">
        <span className="text-violet-600 mt-0.5">▸</span>
        <span className="flex-1">{q}</span>
      </summary>
      <div className="mt-1.5 ml-5 text-xs text-muted-foreground leading-relaxed">{children}</div>
    </details>
  );
}

function TestCard({ nr, desc }: { nr: string; desc: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(nr.replace(/ /g, "")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="group flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:bg-amber-50/40 transition"
    >
      <code className="font-mono text-[11px] tabular-nums text-zinc-900 flex-1">{nr}</code>
      <span className="text-[10px] text-amber-900/70">{desc}</span>
      <span className="ml-1 text-zinc-400 group-hover:text-violet-600">{copied ? '✓' : '📋'}</span>
    </button>
  );
}
