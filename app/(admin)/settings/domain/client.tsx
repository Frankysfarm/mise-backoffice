'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Check, Copy, Globe, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'pending' | 'verified' | 'error' | null;

export function DomainSettings({
  tenantId, slug, name, currentDomain, status, verifiedAt, lastError,
}: {
  tenantId: string;
  slug: string;
  name: string;
  currentDomain: string | null;
  status: Status;
  verifiedAt: string | null;
  lastError: string | null;
}) {
  const supabase = createClient();
  const [domain, setDomain] = useState(currentDomain ?? '');
  const [saving, startSaving] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  function normalize(input: string): string | null {
    const v = input.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!v) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(v)) return null;
    return v;
  }

  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; status?: string; error?: string; note?: string } | null>(null);

  function save() {
    setErr(null);
    setVerifyResult(null);
    const clean = normalize(domain);
    if (!clean) {
      setErr('Bitte eine gültige Domain eintragen, z. B. bestellen.dein-restaurant.de');
      return;
    }
    startSaving(async () => {
      // 1. Speichern als pending
      const { error } = await supabase
        .from('tenants')
        .update({
          custom_domain: clean,
          custom_domain_status: 'pending',
          custom_domain_error: null,
        })
        .eq('id', tenantId);
      if (error) { setErr(error.message); return; }
      setDomain(clean);
      setSavedAt(Date.now());

      // 2. DNS-Verifikation triggern (kann erst nach DNS-Propagation klappen)
      try {
        const res = await fetch('/api/settings/domain/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: clean }),
        });
        const json = await res.json();
        setVerifyResult(json);
      } catch (e) {
        setVerifyResult({ ok: false, error: 'Verifikation fehlgeschlagen: ' + (e instanceof Error ? e.message : 'unbekannt') });
      }
    });
  }

  function reVerify() {
    if (!currentDomain) return;
    setErr(null);
    setVerifyResult(null);
    startSaving(async () => {
      try {
        const res = await fetch('/api/settings/domain/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: currentDomain }),
        });
        const json = await res.json();
        setVerifyResult(json);
        if (json.ok) setSavedAt(Date.now());
      } catch (e) {
        setVerifyResult({ ok: false, error: e instanceof Error ? e.message : 'unbekannt' });
      }
    });
  }

  function remove() {
    if (!confirm('Eigene Domain wirklich entfernen? Deine Bestellseite ist dann nur noch unter mise-gastro.de erreichbar.')) return;
    startRemoving(async () => {
      const { error } = await supabase
        .from('tenants')
        .update({
          custom_domain: null,
          custom_domain_status: null,
          custom_domain_verified_at: null,
          custom_domain_error: null,
        })
        .eq('id', tenantId);
      if (error) { setErr(error.message); return; }
      setDomain('');
      setSavedAt(null);
    });
  }

  const isPending = status === 'pending' || (savedAt !== null);
  const isVerified = status === 'verified' && !savedAt;
  const isError = status === 'error' && !savedAt;
  const fallbackUrl = `https://mise-gastro.de/biss-app/${slug}`;
  const cnameTarget = 'cname.mise-gastro.de';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Status-Karte */}
      {currentDomain && (
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              'h-12 w-12 rounded-2xl grid place-items-center shrink-0',
              isVerified ? 'bg-emerald-100 text-emerald-700' :
              isPending ? 'bg-amber-100 text-amber-700' :
              isError ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500',
            )}>
              <Globe className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-black truncate">{currentDomain}</h2>
                {isVerified && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Aktiv ✓</span>}
                {isPending && <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Wartet auf DNS</span>}
                {isError && <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Fehler</span>}
              </div>
              {isVerified && verifiedAt && (
                <div className="text-xs text-gray-600 mt-1">
                  Verifiziert am {new Date(verifiedAt).toLocaleString('de-DE')}
                </div>
              )}
              {isError && lastError && (
                <div className="text-xs text-red-700 mt-1">{lastError}</div>
              )}
            </div>
            <button
              onClick={remove}
              disabled={removing}
              className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            >
              {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Entfernen
            </button>
          </div>
        </Card>
      )}

      {/* Eingabe */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg">{currentDomain ? 'Domain ändern' : 'Domain verbinden'}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Trag hier die Web-Adresse ein, unter der Gäste deine Bestellseite finden sollen.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="bestellen.dein-restaurant.de"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-matcha-700 focus:ring-2 focus:ring-matcha-200 outline-none font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            onClick={save}
            disabled={saving || !domain.trim() || domain.trim() === currentDomain}
            className="px-5 py-3 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Speichern
          </button>
        </div>
        {err && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}
        {savedAt && (
          <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 rounded-lg p-3">
            <Check className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Domain gespeichert. Folge der DNS-Anleitung unten — die Aktivierung dauert nach DNS-Setup ca. 5 min bis 24 h.</span>
          </div>
        )}
      </Card>

      {/* DNS-Anleitung */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg">DNS einrichten</h3>
          <p className="text-sm text-gray-600 mt-1">
            Diese Einstellung machst du beim Anbieter wo du die Domain gekauft hast (IONOS, Strato, GoDaddy, Cloudflare …).
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <div>Typ</div><div>Name / Host</div><div>Wert / Ziel</div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="font-mono text-sm font-bold">CNAME</div>
            <div className="font-mono text-sm">{normalize(domain)?.split('.')[0] ?? 'bestellen'}</div>
            <div className="font-mono text-sm flex items-center gap-2">
              <span className="truncate">{cnameTarget}</span>
              <button
                onClick={() => copy(cnameTarget)}
                className="text-gray-400 hover:text-matcha-700 shrink-0"
                title="Kopieren"
              >
                {copied === cnameTarget ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-matcha-900 hover:underline">
            So macht man&apos;s bei IONOS / Strato / Cloudflare
          </summary>
          <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside leading-relaxed">
            <li>Im DNS-Bereich deines Anbieters auf <strong>„Eintrag hinzufügen"</strong> klicken.</li>
            <li>Typ: <strong>CNAME</strong> wählen.</li>
            <li>Name/Host: das Sub auf das du verweisen willst (z. B. <code>bestellen</code>).</li>
            <li>Wert/Ziel: <code>{cnameTarget}</code></li>
            <li>TTL: 3600 (oder Default).</li>
            <li>Speichern. DNS-Update dauert je nach Anbieter 5 min bis 24 h.</li>
          </ol>
        </details>
      </Card>

      {/* Fallback-Hinweis */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 leading-relaxed">
        <strong>Auch ohne eigene Domain</strong> ist deine Bestellseite immer erreichbar unter:
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 font-mono text-xs font-bold text-blue-700 hover:underline truncate"
        >
          {fallbackUrl} <ArrowRight className="inline h-3 w-3" />
        </a>
        Diese URL funktioniert weiter, auch wenn deine eigene Domain noch nicht aktiv ist.
      </div>

      <div className="text-xs text-gray-500 leading-relaxed">
        Sobald deine Domain aktiv ist, läuft <strong>{name}</strong>s komplette Online-Bestellseite und alle QR-Tisch-Codes über deine eigene Adresse. SSL-Zertifikat wird automatisch eingerichtet.
      </div>
    </div>
  );
}
