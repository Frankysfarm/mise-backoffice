'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, ExternalLink, Eye, EyeOff, Loader2, Mail, Send } from 'lucide-react';
import { saveResendConfig, testResendConnection } from './actions';

type Tenant = {
  id: string;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  resend_verified_at: string | null;
};

export function EmailSettings({ tenant }: { tenant: Tenant }) {
  const [apiKey, setApiKey] = useState(tenant.resend_api_key ?? '');
  const [fromEmail, setFromEmail] = useState(tenant.resend_from_email ?? '');
  const [fromName, setFromName] = useState(tenant.resend_from_name ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saving, startSaving] = useTransition();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testTo, setTestTo] = useState('');
  const [saved, setSaved] = useState(false);

  const verified = !!tenant.resend_verified_at;

  function save() {
    startSaving(async () => {
      const res = await saveResendConfig({ apiKey, fromEmail, fromName });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  async function testConnection() {
    if (!testTo) return;
    setTesting(true);
    setTestResult(null);
    const res = await testResendConnection(testTo);
    setTestResult({ ok: res.ok, msg: res.ok ? 'E-Mail versendet! Prüfe dein Postfach.' : res.error ?? 'Fehler' });
    setTesting(false);
  }

  return (
    <div className="space-y-6">
      {/* Status-Card */}
      <Card className={cn('p-5 border-2', verified ? 'border-matcha-500 bg-matcha-50' : 'border-dashed')}>
        <div className="flex items-start gap-4">
          <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0', verified ? 'bg-matcha-500 text-white' : 'bg-muted text-muted-foreground')}>
            {verified ? <Check size={22} /> : <Mail size={22} />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-display text-lg font-bold">
                {verified ? 'Resend verbunden' : 'Resend noch nicht verbunden'}
              </div>
              {verified && (
                <span className="inline-flex items-center rounded-full bg-matcha-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  verifiziert
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {verified
                ? `Test-E-Mail gesendet am ${new Date(tenant.resend_verified_at!).toLocaleString('de-DE')}. Du kannst jetzt Kampagnen verschicken.`
                : 'Noch keinen Resend-Account? Dort starten → API-Key kopieren → hier einfügen.'}
            </p>
            {!verified && (
              <a
                href="https://resend.com/signup"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-matcha-700 hover:underline"
              >
                Resend-Account erstellen <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* API-Config */}
      <Card className="p-6 space-y-4">
        <h2 className="font-display font-bold flex items-center gap-2">
          <Mail size={16} /> API-Konfiguration
        </h2>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Resend API Key
          </label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="re_..."
                className="w-full rounded-xl border bg-background px-4 py-2.5 pr-12 font-mono text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Anzeigen"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aus dem Resend Dashboard → API Keys → „Create API Key" → Full-Access
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Absender-Name
            </label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="z.B. Franky's Farm"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Absender-E-Mail
            </label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="hallo@deine-domain.de"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 font-mono text-sm outline-none focus:border-matcha-700 focus:ring-2 focus:ring-matcha-500/20"
            />
          </div>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Tipp:</strong> Damit E-Mails nicht im Spam landen, muss deine Domain bei Resend verifiziert sein.
          Dort unter Domains → DNS-Einträge → SPF + DKIM + DMARC eintragen.
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={save}
            disabled={saving || !apiKey || !fromEmail}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Speichern
          </button>
          {saved && <span className="text-xs text-matcha-700 font-semibold">✓ gespeichert</span>}
        </div>
      </Card>

      {/* Test */}
      <Card className="p-6 space-y-4">
        <h2 className="font-display font-bold flex items-center gap-2">
          <Send size={16} /> Test-Versand
        </h2>
        <p className="text-sm text-muted-foreground">
          Schick dir selbst eine Test-E-Mail, um die Verbindung zu prüfen.
        </p>

        <div className="flex gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="test@deine-email.de"
            className="flex-1 rounded-xl border bg-background px-4 py-2.5 outline-none focus:border-matcha-700"
          />
          <button
            onClick={testConnection}
            disabled={testing || !testTo || !apiKey}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-700 text-white px-4 py-2.5 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Test senden
          </button>
        </div>

        {testResult && (
          <div className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            testResult.ok ? 'border-matcha-300 bg-matcha-50 text-matcha-900' : 'border-red-300 bg-red-50 text-red-900',
          )}>
            {testResult.msg}
          </div>
        )}
      </Card>

      {/* Next */}
      {verified && (
        <Card className="p-6 bg-matcha-50 border-matcha-200">
          <h3 className="font-display font-bold mb-2">Nächster Schritt</h3>
          <p className="text-sm text-matcha-900 mb-4">
            Erstelle deine erste E-Mail-Kampagne — etwa einen Welcome-Gutschein für alle Stammkunden der letzten 30 Tage.
          </p>
          <a
            href="/campaigns"
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2.5 text-sm font-bold hover:bg-matcha-800"
          >
            Kampagnen verwalten →
          </a>
        </Card>
      )}
    </div>
  );
}
