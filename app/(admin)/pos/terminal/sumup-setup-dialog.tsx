'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, ArrowRight, Bluetooth, Check, CreditCard, ExternalLink,
  KeyRound, Loader2, Smartphone, Sparkles, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

export function SumUpSetupDialog({
  tenantId,
  onClose,
  onConnected,
}: {
  tenantId: string;
  onClose: () => void;
  onConnected: (affiliateKey: string) => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [affiliateKey, setAffiliateKey] = useState('');
  const [saving, startSaving] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function saveKey() {
    const key = affiliateKey.trim();
    if (!key) {
      setErr('Bitte Affiliate-Key eintragen.');
      return;
    }
    setErr(null);
    startSaving(async () => {
      const { error } = await supabase.from('tenants').update({
        sumup_affiliate_key: key,
        sumup_verbunden_am: new Date().toISOString(),
      }).eq('id', tenantId);
      if (error) {
        setErr(error.message);
        return;
      }
      setStep(4);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        <header className="px-5 py-4 border-b flex items-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100 shrink-0">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white grid place-items-center">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Karten-Zahlung einrichten
            </div>
            <h2 className="font-display text-xl font-black">SumUp-Onboarding</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-white/60 grid place-items-center" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Progress */}
        <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2 shrink-0">
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div
                className={cn(
                  'h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition shrink-0',
                  n < step && 'bg-emerald-500 text-white',
                  n === step && 'bg-blue-600 text-white ring-4 ring-blue-200',
                  n > step && 'bg-gray-200 text-gray-500',
                )}
              >
                {n < step ? <Check className="h-4 w-4" /> : n}
              </div>
              {n < 4 && (
                <div className={cn('h-0.5 flex-1 transition', n < step ? 'bg-emerald-500' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && <StepInstall onNext={() => setStep(2)} />}
          {step === 2 && <StepPair onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && (
            <StepKey
              value={affiliateKey}
              onChange={setAffiliateKey}
              onSave={saveKey}
              onBack={() => setStep(2)}
              saving={saving}
              err={err}
            />
          )}
          {step === 4 && <StepDone onDone={() => onConnected(affiliateKey.trim())} />}
        </div>
      </div>
    </div>
  );
}

function StepInstall({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-blue-100 text-blue-700 grid place-items-center mx-auto">
          <Smartphone className="h-8 w-8" />
        </div>
        <h3 className="font-display text-2xl font-black">SumUp-App installieren</h3>
        <p className="text-sm text-gray-600">
          Für Karten-Zahlung am Tisch brauchst du die <strong>SumUp-App</strong> auf diesem Tablet.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href="https://apps.apple.com/de/app/sumup-card-payments/id534196532"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition group"
        >
          <div className="text-3xl mb-1">🍎</div>
          <div className="font-bold text-sm">iOS</div>
          <div className="text-[11px] text-gray-500 group-hover:text-blue-700 inline-flex items-center gap-1 mt-1">
            App Store <ExternalLink className="h-3 w-3" />
          </div>
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=com.sumup.merchant.reader"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition group"
        >
          <div className="text-3xl mb-1">🤖</div>
          <div className="font-bold text-sm">Android</div>
          <div className="text-[11px] text-gray-500 group-hover:text-blue-700 inline-flex items-center gap-1 mt-1">
            Play Store <ExternalLink className="h-3 w-3" />
          </div>
        </a>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
        <strong>Wichtig:</strong> Logge dich nach der Installation in der SumUp-App mit deinem SumUp-Konto ein.
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition"
      >
        App ist installiert <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepPair({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-blue-100 text-blue-700 grid place-items-center mx-auto">
          <Bluetooth className="h-8 w-8" />
        </div>
        <h3 className="font-display text-2xl font-black">Karten-Reader pairen</h3>
        <p className="text-sm text-gray-600">
          Verbinde deinen <strong>SumUp-Reader</strong> (Air oder Solo) per Bluetooth mit dem Tablet.
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-gray-700">In der SumUp-App machen:</div>
        <ol className="text-sm text-gray-800 space-y-2 list-decimal list-inside leading-relaxed">
          <li>SumUp-App öffnen → <strong>Einstellungen</strong></li>
          <li>Auf <strong>„Karten-Reader"</strong> tippen → „Neuen Reader hinzufügen"</li>
          <li>Reader einschalten (langer Druck auf Power-Knopf)</li>
          <li>Tablet findet ihn per <strong>Bluetooth</strong> → koppeln</li>
          <li>Optional: 1 € Test-Zahlung in der SumUp-App machen</li>
        </ol>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
        <strong>Tipp:</strong> Bluetooth muss am Tablet aktiviert sein. Mise braucht das nicht selbst — die SumUp-App regelt die Bluetooth-Verbindung.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBack}
          className="py-3 rounded-xl border border-gray-300 font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <button
          onClick={onNext}
          className="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition"
        >
          Reader läuft <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepKey({
  value, onChange, onSave, onBack, saving, err,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  err: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="h-16 w-16 rounded-2xl bg-blue-100 text-blue-700 grid place-items-center mx-auto">
          <KeyRound className="h-8 w-8" />
        </div>
        <h3 className="font-display text-2xl font-black">Affiliate-Key eintragen</h3>
        <p className="text-sm text-gray-600">
          Damit Mise die SumUp-App auslösen kann, brauchen wir deinen <strong>Affiliate-Key</strong>.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-900">So findest du den Key:</div>
        <ol className="text-sm text-amber-900 space-y-1 list-decimal list-inside">
          <li>Öffne <strong>developer.sumup.com</strong></li>
          <li>Logge dich mit deinem SumUp-Konto ein</li>
          <li>Geh zu <strong>Account → Profile</strong></li>
          <li>Kopiere den <strong>Affiliate Key</strong></li>
        </ol>
        <a
          href="https://developer.sumup.com/account/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mt-1"
        >
          SumUp-Developer öffnen <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Affiliate-Key</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sup_aff_..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none font-mono text-sm"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {err && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{err}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="py-3 rounded-xl border border-gray-300 font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Speichere…</> : <>Verbinden <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}

function StepDone({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto relative">
        <Check className="h-10 w-10" strokeWidth={3} />
        <Sparkles className="h-5 w-5 absolute -top-1 -right-1 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-2xl font-black">Karten-Zahlung ist scharf</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Tippe ab jetzt einfach auf <strong>Karte</strong> in der Bestellung — Mise öffnet automatisch die SumUp-App, dein Reader macht den Rest.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-left text-xs text-blue-900 space-y-1">
        <div className="font-bold uppercase tracking-wider">Im täglichen Betrieb:</div>
        <div>1. Bestellung aufnehmen → „Bezahlen"</div>
        <div>2. <strong>Karte</strong> antippen</div>
        <div>3. SumUp-App öffnet → Karte halten</div>
        <div>4. Fertig — Bon wird gedruckt, Order geht in die Küche</div>
      </div>

      <button
        onClick={onDone}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-emerald-800 transition"
      >
        Erste Zahlung starten
      </button>
    </div>
  );
}
