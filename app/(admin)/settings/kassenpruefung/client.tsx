'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Token = {
  id: string;
  token: string;
  gueltig_bis: string;
  pruefer_name: string | null;
  pruefer_amt: string | null;
  created_at: string;
  revoked_at: string | null;
};

export function KassenPruefungClient({
  tenantId, employeeId, initialTokens,
}: {
  tenantId: string;
  employeeId: string;
  initialTokens: Token[];
}) {
  const supabase = createClient();
  const [tokens, setTokens] = useState(initialTokens);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('Finanzamt');
  const [hours, setHours] = useState(4);
  const [pending, setPending] = useState(false);

  async function createToken() {
    setPending(true);
    try {
      const { data } = await supabase.from('kassenpruefung_tokens').insert({
        tenant_id: tenantId,
        erstellt_von: employeeId,
        pruefer_name: name.trim() || null,
        pruefer_amt: amt.trim() || null,
        gueltig_bis: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
      }).select().single();
      if (data) {
        setTokens((xs) => [data as any, ...xs]);
        setCreating(false);
        setName('');
      }
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm('Zugriff sofort widerrufen?')) return;
    await supabase.from('kassenpruefung_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    setTokens((xs) => xs.map((t) => t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Anleitung */}
      <Card className="p-5 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-900 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>§ 146b AO — Unangekündigte Kassen-Nachschau.</strong><br />
            Wenn ein Finanzbeamter vor der Tür steht: Klicke unten „Neuer Zugang" → Link per Tablet/Handy dem Beamten zeigen.
            Der Beamte sieht in Read-only alle Transaktionen, Z-Berichte, TSE-Signaturen, Ausfall-Logs und kann DSFinV-K + Meldepaket herunterladen.
          </div>
        </div>
      </Card>

      {/* Create */}
      {!creating ? (
        <button onClick={() => setCreating(true)} className="w-full h-12 rounded-xl bg-matcha-900 text-matcha-50 font-bold inline-flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> Neuer Nachschau-Zugang
        </button>
      ) : (
        <Card className="p-5">
          <h3 className="font-display font-bold mb-3">Nachschau-Token anlegen</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Prüfer-Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-11 rounded-xl border bg-background px-3" placeholder="z.B. Hr. Mustermann" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Amt</label>
              <input value={amt} onChange={(e) => setAmt(e.target.value)} className="mt-1 w-full h-11 rounded-xl border bg-background px-3" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Gültigkeit</label>
              <div className="mt-1 flex gap-1">
                {[1, 4, 8, 24].map((h) => (
                  <button key={h} onClick={() => setHours(h)}
                    className={cn('flex-1 h-11 rounded-xl border-2 font-bold', hours === h ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50')}>
                    {h} Std
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createToken} disabled={pending} className="flex-1 h-12 rounded-xl bg-matcha-900 text-matcha-50 font-bold inline-flex items-center justify-center gap-2">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Zugang erstellen
              </button>
              <button onClick={() => setCreating(false)} className="h-12 px-4 rounded-xl border hover:bg-muted">Abbrechen</button>
            </div>
          </div>
        </Card>
      )}

      {/* Tokens */}
      {tokens.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-bold">Aktive & vergangene Zugänge</h3>
          {tokens.map((t) => <TokenRow key={t.id} token={t} onRevoke={() => revoke(t.id)} />)}
        </div>
      )}
    </div>
  );
}

function TokenRow({ token: t, onRevoke }: { token: Token; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false);
  const expired = new Date(t.gueltig_bis) < new Date();
  const revoked = !!t.revoked_at;
  const active = !expired && !revoked;

  const url = typeof window !== 'undefined' ? `${window.location.origin}/pruefung/${t.token}` : `/pruefung/${t.token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className={cn('p-4', active ? 'border-matcha-300 bg-matcha-50' : 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl grid place-items-center shrink-0', active ? 'bg-matcha-700 text-white' : 'bg-gray-300 text-gray-600')}>
          {active ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold">
            {t.pruefer_name ?? 'Unbenannt'}
            {t.pruefer_amt && <span className="text-muted-foreground font-normal"> · {t.pruefer_amt}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            Gültig bis <strong>{new Date(t.gueltig_bis).toLocaleString('de-DE')}</strong>
            {revoked && ' · WIDERRUFEN'}
            {!revoked && expired && ' · ABGELAUFEN'}
          </div>
          {active && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <code className="flex-1 font-mono text-[10px] bg-white rounded px-2 py-1 border truncate">{url}</code>
              <button onClick={copy} className="h-7 w-7 rounded border bg-white hover:bg-muted grid place-items-center" title="Kopieren">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <a href={url} target="_blank" className="h-7 w-7 rounded border bg-white hover:bg-muted grid place-items-center" title="Öffnen">
                <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={onRevoke} className="h-7 px-2 rounded bg-red-600 text-white text-[10px] font-bold">
                Widerrufen
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
