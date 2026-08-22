'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, QrCode, RefreshCw, ShieldAlert, X } from 'lucide-react';

interface Credentials { email: string; password: string; regenerated: boolean }
interface QRData { qrPngDataUrl: string; expiresAt: string; ttlMinutes: number }

export function KioskAccountSection() {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/shop/lieferservice/kiosk-account')
      .then(r => r.json())
      .then(d => {
        setExists(!!d.exists);
        setEmail(d.email ?? null);
        setCreatedAt(d.createdAt ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    setError(null);
    setCreating(true);
    try {
      const r = await fetch('/api/shop/lieferservice/kiosk-account', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? 'Fehler beim Erstellen');
        return;
      }
      setCreds(d);
      setExists(true);
      setEmail(d.email);
      setConfirming(false);
    } catch (e) {
      setError('Netzwerk-Fehler');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Lade…</p>;

  return (
    <div className="space-y-4">
      {creds ? (
        <CredentialsDisplay creds={creds} onDismiss={() => setCreds(null)} />
      ) : exists ? (
        <ExistingAccount
          email={email!}
          createdAt={createdAt}
          onRegenerate={() => setConfirming(true)}
        />
      ) : (
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {creating ? 'Erstelle…' : 'Account erstellen'}
        </button>
      )}

      {error && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {confirming && !creds && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="font-bold text-amber-900">Neues Passwort generieren?</p>
          </div>
          <p className="text-sm text-amber-800 mb-3">
            Das alte Passwort wird sofort ungültig. Bereits eingeloggte iPads bleiben
            zunächst eingeloggt — werden aber spätestens beim nächsten Token-Refresh
            (innerhalb 1 Stunde) ausgeloggt.
          </p>
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={creating}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {creating ? 'Generiere…' : 'Neu generieren'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={creating}
              className="px-3 py-1.5 rounded-lg text-sm font-bold border border-zinc-300 hover:bg-white"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExistingAccount({ email, createdAt, onRegenerate }: { email: string; createdAt: string | null; onRegenerate: () => void }) {
  const [qr, setQr] = useState<QRData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  async function generateQR() {
    setQrError(null);
    setQrLoading(true);
    try {
      const r = await fetch('/api/shop/lieferservice/kiosk-account/qr-token', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) {
        setQrError(d.error ?? 'QR-Code konnte nicht erstellt werden');
        return;
      }
      setQr({ qrPngDataUrl: d.qrPngDataUrl, expiresAt: d.expiresAt, ttlMinutes: d.ttlMinutes });
    } catch {
      setQrError('Netzwerk-Fehler');
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-700 font-bold">Login-Email</p>
        <p className="font-mono text-sm text-emerald-900 break-all mt-1">{email}</p>
        {createdAt && (
          <p className="text-xs text-emerald-700 mt-2">
            Erstellt am {new Date(createdAt).toLocaleDateString('de-DE')}
          </p>
        )}
        <p className="text-xs text-emerald-800 mt-2">
          Das Passwort wurde dir beim Erstellen einmal angezeigt. Wir speichern es
          aus Sicherheitsgründen nicht im Klartext.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={generateQR}
          disabled={qrLoading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          <QrCode className="h-3.5 w-3.5" />
          {qrLoading ? 'Generiere QR…' : 'QR-Code für iPad-Login'}
        </button>
        <button
          onClick={onRegenerate}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-zinc-200 hover:bg-zinc-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Passwort neu generieren
        </button>
      </div>

      {qrError && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {qrError}
        </div>
      )}

      {qr && <QRDisplay qr={qr} onDismiss={() => setQr(null)} onRefresh={generateQR} />}
    </div>
  );
}

function QRDisplay({ qr, onDismiss, onRefresh }: { qr: QRData; onDismiss: () => void; onRefresh: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const handle = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(handle);
  }, [qr.expiresAt]);

  const expired = secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl border-2 border-zinc-900 max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-xl font-black">QR-Code für iPad-Login</h4>
            <p className="text-sm text-zinc-600 mt-1">
              Auf dem iPad: Mise POS App öffnen → „QR scannen" → diesen Code abfotografieren.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 h-9 w-9 rounded-full border-2 border-zinc-200 grid place-items-center hover:bg-zinc-50"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-zinc-50 rounded-2xl border-2 border-zinc-200 p-4 grid place-items-center">
          {!expired ? (
            <img src={qr.qrPngDataUrl} alt="QR-Code" className="w-full max-w-[320px]" />
          ) : (
            <div className="text-center py-12">
              <ShieldAlert className="h-12 w-12 text-amber-600 mx-auto mb-3" />
              <p className="font-bold text-zinc-900">QR-Code abgelaufen</p>
              <p className="text-sm text-zinc-600 mt-1">Erzeuge einen neuen.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={expired ? 'text-red-700 font-bold' : 'text-zinc-700'}>
              {expired ? 'Abgelaufen' : `Gültig noch ${minutes}:${String(seconds).padStart(2, '0')}`}
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-zinc-200 hover:bg-zinc-50"
          >
            <RefreshCw className="h-3 w-3" />
            Neu generieren
          </button>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 leading-relaxed">
          <p className="font-bold mb-1">⚠️ Sicherheits-Hinweise:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Code ist nur einmal nutzbar — nach dem Scan ungültig</li>
            <li>Code läuft nach 15 Minuten automatisch ab</li>
            <li>Niemals fotografieren / weitergeben — kompletter Login</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function CredentialsDisplay({ creds, onDismiss }: { creds: Credentials; onDismiss: () => void }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  async function copy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  }
  return (
    <div className="rounded-2xl border-2 border-zinc-900 bg-white p-5 space-y-4 shadow-lg">
      <div>
        <h4 className="font-display font-black text-base">
          {creds.regenerated ? 'Neues Passwort generiert' : 'Account erstellt'}
        </h4>
        <p className="text-sm text-amber-700 font-bold mt-1">
          ⚠️ Speichere diese Daten jetzt — wir zeigen sie nur einmal!
        </p>
      </div>

      <Field label="Email" value={creds.email} copied={copiedField === 'email'} onCopy={() => copy('email', creds.email)} />
      <Field label="Passwort" value={creds.password} copied={copiedField === 'pw'} onCopy={() => copy('pw', creds.password)} />

      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-700 leading-relaxed">
        <p className="font-bold text-zinc-900 mb-1">So loggst du dich auf dem iPad ein:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Mise POS App öffnen</li>
          <li>„🛵 Lieferservice" antippen</li>
          <li>Email und Passwort eingeben</li>
          <li>Anmelden</li>
        </ol>
        <p className="mt-2 text-zinc-600">
          Danach bleibt die App dauerhaft eingeloggt — du musst dich nie wieder neu anmelden.
        </p>
      </div>

      <button
        onClick={onDismiss}
        className="w-full px-4 py-2 rounded-xl font-bold text-sm bg-zinc-900 text-white hover:bg-zinc-700"
      >
        Habe ich notiert
      </button>
    </div>
  );
}

function Field({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500 font-bold mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-mono break-all">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="px-3 py-2 rounded-lg border-2 border-zinc-200 hover:bg-zinc-50 text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
        >
          {copied ? <><Check className="h-3.5 w-3.5" />Kopiert</> : <><Copy className="h-3.5 w-3.5" />Kopieren</>}
        </button>
      </div>
    </div>
  );
}
