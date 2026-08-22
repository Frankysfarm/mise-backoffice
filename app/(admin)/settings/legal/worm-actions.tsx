'use client';

import { useState } from 'react';
import { Archive, CheckCircle2, Loader2, XCircle } from 'lucide-react';

export function WormActions({ tenantId }: { tenantId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runBackup() {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/pos/backup/worm?tenant_id=${tenantId}`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Fehler' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={runBackup}
        disabled={pending}
        className="h-10 px-4 rounded-xl bg-gray-900 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        {pending ? 'Sichert Vormonat...' : 'Jetzt Vormonat sichern'}
      </button>

      {result && (
        <div className={`mt-3 text-xs rounded-lg p-3 ${result.ok ? 'bg-matcha-50 text-matcha-900' : 'bg-red-50 text-red-900'}`}>
          {result.ok ? (
            <>
              <div className="inline-flex items-center gap-1 font-bold"><CheckCircle2 className="h-3 w-3" /> Backup erfolgreich</div>
              <div className="mt-1 font-mono text-[10px]">
                Zeitraum: {result.zeitraum?.from} – {result.zeitraum?.to}
              </div>
              {result.results?.[0]?.s3_key && (
                <>
                  <div className="mt-1 font-mono text-[10px]">S3-Key: {result.results[0].s3_key}</div>
                  <div className="font-mono text-[10px]">Größe: {((result.results[0].size ?? 0) / 1024).toFixed(1)} KB</div>
                  <div className="font-mono text-[10px]">Lock bis: {result.results[0].lock_until?.slice(0,10)}</div>
                </>
              )}
              {result.results?.[0]?.skipped && (
                <div className="mt-1 italic">{result.results[0].skipped}</div>
              )}
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1 font-bold"><XCircle className="h-3 w-3" /> Fehler</div>
              <div className="mt-1">{result.error}</div>
              {result.error?.includes('nicht konfiguriert') && (
                <div className="mt-2 text-[10px] bg-white/60 rounded p-2">
                  <strong>Setup:</strong> Admin muss in Environment-Variablen setzen:
                  <div className="mt-1 font-mono">AWS_WORM_BUCKET<br />AWS_WORM_REGION<br />AWS_ACCESS_KEY_ID<br />AWS_SECRET_ACCESS_KEY</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
