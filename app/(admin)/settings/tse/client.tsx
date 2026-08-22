'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, ExternalLink, Eye, EyeOff, Loader2, Shield, ShieldCheck } from 'lucide-react';

export function TSESettings({
  tenantId, initial,
}: {
  tenantId: string;
  initial: {
    fiskaly_api_key: string | null;
    fiskaly_api_secret: string | null;
    fiskaly_organization_id: string | null;
    fiskaly_tss_id: string | null;
    fiskaly_client_id: string | null;
    fiskaly_environment: string | null;
  };
}) {
  const supabase = createClient();
  const [apiKey, setApiKey] = useState(initial.fiskaly_api_key ?? '');
  const [apiSecret, setApiSecret] = useState(initial.fiskaly_api_secret ?? '');
  const [environment, setEnvironment] = useState(initial.fiskaly_environment ?? 'sandbox');
  const [orgId, setOrgId] = useState(initial.fiskaly_organization_id ?? '');
  const [tssId, setTssId] = useState(initial.fiskaly_tss_id ?? '');
  const [clientId, setClientId] = useState(initial.fiskaly_client_id ?? '');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isActive = Boolean(initial.fiskaly_tss_id && initial.fiskaly_client_id);

  function save() {
    startSaving(async () => {
      await supabase.from('tenants').update({
        fiskaly_api_key: apiKey.trim() || null,
        fiskaly_api_secret: apiSecret.trim() || null,
        fiskaly_environment: environment,
        fiskaly_organization_id: orgId.trim() || null,
      }).eq('id', tenantId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function provisionTSS() {
    setProvisioning(true);
    setResult(null);
    try {
      const res = await fetch('/api/pos/tse/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      if (data.ok) {
        setTssId(data.tss_id);
        setClientId(data.client_id);
        setResult({ ok: true, msg: `TSS eingerichtet · Serial ${data.serial_number ?? '—'}` });
      } else {
        setResult({ ok: false, msg: data.error ?? 'Fehler beim Provisioning' });
      }
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Status */}
      <Card className={`p-5 ${isActive ? 'bg-matcha-50 border-matcha-300' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 ${isActive ? 'bg-matcha-700 text-white' : 'bg-amber-500 text-white'}`}>
            {isActive ? <ShieldCheck className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-bold">
              {isActive ? 'TSE aktiv — KassenSichV-konform' : 'TSE noch nicht eingerichtet'}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {isActive
                ? `Environment: ${environment.toUpperCase()} · TSS-ID: ${tssId.slice(0, 8)}…`
                : 'Ohne aktive TSE dürfen Kassenbons in DE seit 2020 NICHT ausgegeben werden.'}
            </div>
          </div>
        </div>
      </Card>

      {/* Provider-Info */}
      <Card className="p-5 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center shrink-0 font-black">f</div>
          <div className="flex-1">
            <div className="font-display font-bold text-blue-900">fiskaly Cloud-TSE</div>
            <p className="text-sm text-blue-900 mt-1">
              Cloud-basierte Signatur-Einrichtung, BSI-zertifiziert.<br />
              Ab ~12 €/Monat pro Kasse · inkl. automatischer Finanzamt-Meldung (§ 146a AO).
            </p>
            <a href="https://dashboard.fiskaly.com/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-900 underline">
              fiskaly Dashboard öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>

      {/* Credentials */}
      <Card className="p-5">
        <h3 className="font-display font-bold mb-3">API-Zugang</h3>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Environment</label>
            <div className="mt-1 flex gap-2">
              {(['sandbox', 'live'] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnvironment(e)}
                  className={`flex-1 h-11 rounded-xl border-2 font-bold text-sm uppercase ${environment === e ? 'bg-matcha-900 text-matcha-50 border-matcha-900' : 'bg-white hover:bg-muted'}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {environment === 'sandbox' ? 'Zum Testen — kostenlos, keine echten Signaturen.' : 'Für Produktion — kostenpflichtig, BSI-zertifiziert.'}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API-Key</label>
            <input
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="fsky_..."
              className="mt-1 w-full h-11 rounded-xl border bg-background px-3 font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API-Secret</label>
            <div className="mt-1 flex items-center bg-muted rounded-xl overflow-hidden">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                placeholder="fsksk_..."
                className="flex-1 h-11 bg-transparent px-3 font-mono text-sm outline-none"
              />
              <button onClick={() => setShowSecret(!showSecret)} className="h-11 w-11 hover:bg-black/5 grid place-items-center">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organization-ID (optional)</label>
            <input
              value={orgId} onChange={(e) => setOrgId(e.target.value)}
              placeholder="aus dem fiskaly Dashboard"
              className="mt-1 w-full h-11 rounded-xl border bg-background px-3 font-mono text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !apiKey || !apiSecret}
            className="h-11 px-5 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Speichern
          </button>
          {saved && <span className="text-sm text-matcha-700 font-semibold">Gespeichert ✓</span>}
        </div>
      </Card>

      {/* Provisioning */}
      <Card className="p-5">
        <h3 className="font-display font-bold mb-2">TSS einrichten</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Nach dem Speichern der Zugangsdaten muss einmalig eine TSS (Technische Sicherheits-Einheit) erzeugt und ein Client (deine Kasse) registriert werden. Wir machen das automatisch.
        </p>

        <button
          onClick={provisionTSS}
          disabled={provisioning || !apiKey || !apiSecret || isActive}
          className="h-11 px-5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isActive ? 'Bereits eingerichtet' : 'TSS jetzt einrichten'}
        </button>

        {result && (
          <div className={`mt-3 text-sm px-4 py-2 rounded-xl ${result.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900'}`}>
            {result.msg}
          </div>
        )}

        {tssId && (
          <div className="mt-4 text-xs text-muted-foreground">
            <div><strong>TSS-ID:</strong> <code className="font-mono">{tssId}</code></div>
            {clientId && <div className="mt-1"><strong>Client-ID:</strong> <code className="font-mono">{clientId}</code></div>}
          </div>
        )}
      </Card>
    </div>
  );
}
