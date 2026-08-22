'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, ExternalLink, Eye, EyeOff, Loader2, Wifi } from 'lucide-react';

export function SumUpSettings({
  tenantId, initialApiKey, initialMerchantCode, verbundenAm,
}: {
  tenantId: string;
  initialApiKey: string;
  initialMerchantCode: string;
  verbundenAm: string | null;
}) {
  const supabase = createClient();
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [merchant, setMerchant] = useState(initialMerchantCode);
  const [showKey, setShowKey] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function save() {
    startSaving(async () => {
      await supabase.from('tenants').update({
        sumup_api_key: apiKey.trim() || null,
        sumup_merchant_code: merchant.trim() || null,
        sumup_verbunden_am: apiKey.trim() && merchant.trim() ? new Date().toISOString() : null,
      }).eq('id', tenantId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/pos/sumup/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      setTestResult(data.ok
        ? { ok: true, msg: `Verbunden ✓ Merchant: ${data.merchant_name ?? merchant}` }
        : { ok: false, msg: data.error ?? 'Verbindung fehlgeschlagen' });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Netzwerkfehler' });
    } finally {
      setTesting(false);
    }
  }

  const isConnected = Boolean(verbundenAm && initialApiKey && initialMerchantCode);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 ${
            isConnected ? 'bg-matcha-700 text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            <Wifi className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">
              {isConnected ? 'SumUp verbunden' : 'Noch nicht verbunden'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isConnected
                ? `Verbunden seit ${new Date(verbundenAm!).toLocaleDateString('de-DE')}`
                : 'Trage deinen SumUp API-Key + Merchant-Code ein, um Karten-Zahlungen direkt über den SumUp Card Reader abzuwickeln.'}
            </p>
            {isConnected && (
              <button
                onClick={testConnection}
                disabled={testing}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border bg-white hover:bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                Verbindung testen
              </button>
            )}
            {testResult && (
              <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg inline-block ${
                testResult.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900'
              }`}>
                {testResult.msg}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Anleitung */}
      <Card className="p-5 bg-blue-50/50 border-blue-200">
        <h3 className="font-display font-bold text-blue-900 mb-2">So kommst du an deine Daten</h3>
        <ol className="space-y-2 text-sm text-blue-900">
          <li className="flex gap-2">
            <span className="font-mono font-bold">1.</span>
            <span>
              Öffne{' '}
              <a href="https://developer.sumup.com/" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                developer.sumup.com <ExternalLink className="h-3 w-3" />
              </a>
              {' '}und logge dich mit deinem SumUp-Konto ein
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-bold">2.</span>
            <span>Erzeuge einen neuen <strong>API-Key</strong> und kopiere ihn unten rein</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-bold">3.</span>
            <span>Der <strong>Merchant-Code</strong> steht in deinem SumUp-Dashboard oben rechts (z.B. <code>M1A2B3C4</code>)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-bold">4.</span>
            <span>Speichern und testen — fertig!</span>
          </li>
        </ol>
      </Card>

      {/* Form */}
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SumUp API-Key</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 flex items-center bg-muted rounded-xl overflow-hidden">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sup_sk_..."
                  className="flex-1 h-11 bg-transparent px-3 font-mono text-sm outline-none"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="h-11 w-11 hover:bg-black/5 grid place-items-center"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Merchant-Code</label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="M1A2B3C4"
              className="mt-1 w-full h-11 rounded-xl border bg-background px-3 font-mono"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !apiKey.trim() || !merchant.trim()}
            className="h-11 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Verbinden
          </button>
          {saved && <span className="text-sm text-matcha-700 font-semibold">Gespeichert ✓</span>}
        </div>
      </Card>

      {/* How it works */}
      <Card className="p-5">
        <h3 className="font-display font-bold mb-3">So funktioniert's im POS</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-matcha-700 text-white font-bold text-xs grid place-items-center shrink-0">1</div>
            <div>
              <div className="font-semibold text-foreground">Kellner tippt Bestellung in POS</div>
              <div className="text-xs">Wählt „Karte" als Zahlung</div>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-matcha-700 text-white font-bold text-xs grid place-items-center shrink-0">2</div>
            <div>
              <div className="font-semibold text-foreground">POS startet Checkout über SumUp API</div>
              <div className="text-xs">Dein SumUp Card Reader (Bluetooth/App) bekommt den Betrag</div>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-matcha-700 text-white font-bold text-xs grid place-items-center shrink-0">3</div>
            <div>
              <div className="font-semibold text-foreground">Kunde hält Karte dran</div>
              <div className="text-xs">SumUp bestätigt automatisch an POS</div>
            </div>
          </li>
          <li className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-matcha-700 text-white font-bold text-xs grid place-items-center shrink-0">4</div>
            <div>
              <div className="font-semibold text-foreground">Bon wird gedruckt + Bestellung in Küche</div>
              <div className="text-xs">Fertig — alles synchron in Z-Bericht + Buchhaltung</div>
            </div>
          </li>
        </ol>
      </Card>
    </div>
  );
}
