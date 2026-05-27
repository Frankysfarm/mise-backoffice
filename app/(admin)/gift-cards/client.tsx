'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { AlertCircle, Check, Copy, Gift, Loader2, Plus, Printer, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type GiftCard = {
  id: string;
  code: string;
  initial_value_cents: number;
  current_balance_cents: number;
  ausgestellt_am: string;
  gueltig_bis: string | null;
  status: 'aktiv' | 'gesperrt' | 'abgelaufen' | 'aufgebraucht' | 'storniert';
  empfaenger_name: string | null;
  verkauft_an_email: string | null;
  batch_id: string | null;
};

const STATUS_LABEL: Record<GiftCard['status'], { label: string; color: string }> = {
  aktiv:        { label: 'Aktiv',        color: 'bg-emerald-100 text-emerald-800' },
  aufgebraucht: { label: 'Aufgebraucht', color: 'bg-gray-100 text-gray-700' },
  gesperrt:     { label: 'Gesperrt',     color: 'bg-red-100 text-red-800' },
  abgelaufen:   { label: 'Abgelaufen',   color: 'bg-amber-100 text-amber-800' },
  storniert:    { label: 'Storniert',    color: 'bg-gray-200 text-gray-600' },
};

function euro(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

export function GiftCardsManager({ tenantId, initialCards, aktivCount, outstandingCents }: {
  tenantId: string;
  initialCards: GiftCard[];
  aktivCount: number;
  outstandingCents: number;
}) {
  const supabase = createClient();
  const [cards, setCards] = useState<GiftCard[]>(initialCards);
  const [showNew, setShowNew] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New-Card-Form-State
  const [newValue, setNewValue] = useState(50);
  const [newRecipient, setNewRecipient] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newValidUntil, setNewValidUntil] = useState('');

  // Bulk-Form
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkValue, setBulkValue] = useState(50);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  function issueOne() {
    setErr(null);
    startBusy(async () => {
      const { data, error } = await supabase.rpc('issue_gift_card', {
        p_tenant_id: tenantId,
        p_value_cents: newValue * 100,
        p_recipient_name: newRecipient || null,
        p_recipient_email: newEmail || null,
        p_valid_until: newValidUntil || null,
      });
      if (error) { setErr(error.message); return; }
      const result = data as { ok: boolean; gift_card_id?: string; code?: string; error?: string };
      if (!result.ok) { setErr(result.error || 'Fehler'); return; }
      // Reload list
      const { data: fresh } = await supabase
        .from('gift_cards').select('*').eq('id', result.gift_card_id).single();
      if (fresh) setCards((c) => [fresh as GiftCard, ...c]);
      setShowNew(false);
      setNewRecipient(''); setNewEmail(''); setNewValidUntil('');
    });
  }

  function issueBulk() {
    setErr(null);
    startBusy(async () => {
      const batchId = crypto.randomUUID();
      const promises = Array.from({ length: bulkCount }, () =>
        supabase.rpc('issue_gift_card', {
          p_tenant_id: tenantId,
          p_value_cents: bulkValue * 100,
          p_batch_id: batchId,
        }),
      );
      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error).map((r) => r.error?.message).filter(Boolean);
      if (errors.length > 0) { setErr(`${errors.length} Fehler bei Bulk-Generation`); return; }
      // Reload list (limit 100)
      const { data: fresh } = await supabase
        .from('gift_cards').select('*').eq('tenant_id', tenantId)
        .order('ausgestellt_am', { ascending: false }).limit(100);
      if (fresh) setCards(fresh as GiftCard[]);
      setShowBulk(false);
      // Print page für Batch
      window.open(`/api/gift-cards/print?batch=${batchId}`, '_blank');
    });
  }

  async function block(id: string) {
    if (!confirm('Gutschein wirklich sperren? Restguthaben bleibt erhalten, aber kann nicht mehr eingelöst werden.')) return;
    await supabase.from('gift_cards').update({ status: 'gesperrt', updated_at: new Date().toISOString() }).eq('id', id);
    setCards((c) => c.map((x) => x.id === id ? { ...x, status: 'gesperrt' } : x));
  }

  async function unblock(id: string) {
    await supabase.from('gift_cards').update({ status: 'aktiv', updated_at: new Date().toISOString() }).eq('id', id);
    setCards((c) => c.map((x) => x.id === id ? { ...x, status: 'aktiv' } : x));
  }

  const filteredCards = search
    ? cards.filter((c) =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        (c.empfaenger_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.verkauft_an_email ?? '').toLowerCase().includes(search.toLowerCase()))
    : cards;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Aktive Gutscheine" value={aktivCount.toString()} icon={Gift} />
        <Stat label="Ausstehend (Restguthaben)" value={euro(outstandingCents)} icon={Gift} hint="Was Gäste noch einlösen können" />
        <Stat label="Insgesamt ausgestellt" value={cards.length.toString()} icon={Gift} />
        <Stat label="Letzter Verkauf" value={cards[0]?.ausgestellt_am ? new Date(cards[0].ausgestellt_am).toLocaleDateString('de-DE') : '—'} icon={Gift} />
      </div>

      {/* Actions + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 px-4 py-2 text-sm font-bold">
          <Plus className="h-4 w-4" /> Neuer Gutschein
        </button>
        <button onClick={() => setShowBulk(true)} className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-matcha-900 text-matcha-900 hover:bg-matcha-50 px-4 py-2 text-sm font-bold">
          <Printer className="h-4 w-4" /> Bulk-Generation
        </button>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Code / Name / Email suchen…"
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-300 text-sm"
          />
        </div>
      </div>

      {/* Tabelle */}
      {filteredCards.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <Gift className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{search ? 'Kein Gutschein gefunden.' : 'Noch keine Gutscheine. Leg den ersten an oder mach Bulk-Generation für 50× á 25 €.'}</p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-right">Wert</th>
                <th className="px-4 py-3 text-right">Rest</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ausgestellt</th>
                <th className="px-4 py-3 text-left">Empfänger</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCards.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button onClick={() => copyCode(c.code)} className="font-mono text-sm hover:text-matcha-900 inline-flex items-center gap-1">
                      {c.code}
                      {copiedCode === c.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{euro(c.initial_value_cents)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-sm">{euro(c.current_balance_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded', STATUS_LABEL[c.status].color)}>
                      {STATUS_LABEL[c.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{new Date(c.ausgestellt_am).toLocaleDateString('de-DE')}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.empfaenger_name || c.verkauft_an_email || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/gift-cards/${c.id}/print`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-matcha-900 hover:underline mr-3">Drucken</a>
                    {c.status === 'aktiv' && <button onClick={() => block(c.id)} className="text-xs text-red-600 hover:underline">Sperren</button>}
                    {c.status === 'gesperrt' && <button onClick={() => unblock(c.id)} className="text-xs text-emerald-700 hover:underline">Entsperren</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New-Single Modal */}
      {showNew && (
        <Modal title="Neuer Gutschein" onClose={() => setShowNew(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Wert in €</label>
              <input type="number" value={newValue} onChange={(e) => setNewValue(Math.max(1, Number(e.target.value)))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 font-mono" />
              <div className="flex gap-1 mt-2">
                {[10, 25, 50, 100, 200].map((v) => (
                  <button key={v} onClick={() => setNewValue(v)}
                    className={cn('flex-1 py-1 rounded-lg text-xs font-bold', newValue === v ? 'bg-matcha-900 text-white' : 'bg-gray-100 hover:bg-gray-200')}>
                    {v} €
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Empfänger-Name (optional)</label>
              <input value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="Maria Müller" className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Verkauft an (Email, optional)</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="kunde@example.com" className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Gültig bis (optional, Default: 3 Jahre)</label>
              <input type="date" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300" />
            </div>
            {err && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-2 inline-flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold">Abbrechen</button>
              <button onClick={issueOne} disabled={busy || newValue < 1} className="flex-1 py-3 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Ausstellen + drucken
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk-Modal */}
      {showBulk && (
        <Modal title="Bulk-Generation" onClose={() => setShowBulk(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Generiere viele Gutscheine auf einmal. Z. B. 50 × 25 € für deinen Weihnachts-Verkauf.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Anzahl</label>
                <input type="number" value={bulkCount} onChange={(e) => setBulkCount(Math.max(1, Math.min(500, Number(e.target.value))))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Wert pro Stück (€)</label>
                <input type="number" value={bulkValue} onChange={(e) => setBulkValue(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 font-mono" />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
              <strong>Gesamt-Wert:</strong> {euro(bulkCount * bulkValue * 100)} ({bulkCount} Stück × {bulkValue} €)
            </div>
            {err && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-2 inline-flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowBulk(false)} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold">Abbrechen</button>
              <button onClick={issueBulk} disabled={busy || bulkCount < 1 || bulkValue < 1} className="flex-1 py-3 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Generieren + drucken
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="text-xs text-gray-500 leading-relaxed pt-4 border-t">
        <strong>Hinweis:</strong> Gutscheine werden in <code>gift_cards</code> mit vollem Audit-Trail (jede Einlösung loggt) gespeichert.
        Mehrfach-Einlösung möglich bis Restguthaben 0 €. Empfänger-Email-Versand kommt in einer eigenen Session.
      </div>
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-2xl font-black mt-1">{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden">
        <header className="px-5 py-4 border-b flex items-center gap-3 bg-gradient-to-br from-matcha-50 to-matcha-100">
          <h2 className="font-display text-xl font-black flex-1">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-white/60 grid place-items-center"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
