'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro, dateDE } from '@/lib/utils';
import {
  Check, Copy, Gift, Loader2, Percent, Plus, Ticket, Trash2, Truck, X, QrCode, Euro as EuroIcon, Sparkles,
} from 'lucide-react';
import { createVoucher, toggleVoucher, deleteVoucher, toggleBonVoucher } from './actions';

type Voucher = {
  id: string;
  code: string;
  typ: 'prozent' | 'fix' | 'gratis_lieferung';
  wert: number;
  min_bestellwert: number;
  max_rabatt: number | null;
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  nutzungen_max: number | null;
  nutzungen_pro_kunde: number | null;
  nutzungen_aktuell: number;
  quelle: string;
  beschreibung: string | null;
  aktiv: boolean;
  created_at: string;
  redemptions: { count: number }[] | null;
};

export function VouchersClient({
  tenantId, vouchers: initial, bonAutoEnabled,
}: {
  tenantId: string; vouchers: Voucher[]; bonAutoEnabled: boolean;
}) {
  const [vouchers, setVouchers] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [bonAuto, setBonAuto] = useState(bonAutoEnabled);
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  const manual = vouchers.filter((v) => v.quelle === 'manual' || v.quelle === 'kampagne');
  const autogen = vouchers.filter((v) => v.quelle === 'bon_autogen');

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      {/* Bon-Auto-Voucher Feature-Card */}
      <Card className={cn('p-5 border-2', bonAuto ? 'border-gold bg-gold/5' : 'border-dashed')}>
        <div className="flex items-start gap-4">
          <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0', bonAuto ? 'bg-gold text-matcha-900' : 'bg-muted text-muted-foreground')}>
            <QrCode size={22} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-display font-bold text-lg">Auto-Voucher auf Kassenbons</div>
              {bonAuto ? <Badge variant="gold">aktiv</Badge> : <Badge variant="muted">aus</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Jeder Bon ab 10 € erhält automatisch einen einmaligen QR-Code für <strong>10 % Rabatt auf die nächste Bestellung</strong>.
              Gültig 30 Tage, Mindestbestellwert 5 €. Der Kunde scannt den QR → landet in eurer Bestellseite mit eingelöstem Code.
            </p>
          </div>
          <button
            onClick={() =>
              startTransition(async () => {
                const next = !bonAuto;
                const res = await toggleBonVoucher(next);
                if (res.ok) setBonAuto(next);
              })
            }
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold',
              bonAuto ? 'bg-muted hover:bg-red-100 hover:text-red-900' : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
            )}
          >
            {bonAuto ? <X size={14} /> : <Check size={14} />}
            {bonAuto ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>
      </Card>

      {/* Manuelle Aktions-Gutscheine */}
      <Card className="overflow-hidden">
        <header className="flex items-center justify-between p-5 border-b">
          <div>
            <div className="font-display font-bold">Aktions-Gutscheine</div>
            <div className="text-sm text-muted-foreground">{manual.length} Codes · kopierbar für Marketing & Social Media</div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-semibold hover:bg-matcha-800"
          >
            <Plus size={14} /> Neuer Gutschein
          </button>
        </header>

        {manual.length === 0 ? (
          <div className="p-10 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <div className="font-display font-bold">Noch keine Gutscheine</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Lege Welcome-Rabatte, Gratis-Lieferung oder Saison-Aktionen an — Kunden lösen sie direkt im Checkout ein.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {manual.map((v) => (
              <VoucherRow
                key={v.id}
                voucher={v}
                onCopy={() => copyCode(v.code)}
                copied={copied === v.code}
                onToggle={() =>
                  startTransition(async () => {
                    const res = await toggleVoucher(v.id, !v.aktiv);
                    if (res.ok) setVouchers((xs) => xs.map((x) => x.id === v.id ? { ...x, aktiv: !v.aktiv } : x));
                  })
                }
                onDelete={() =>
                  startTransition(async () => {
                    if (!confirm(`Code ${v.code} wirklich löschen?`)) return;
                    const res = await deleteVoucher(v.id);
                    if (res.ok) setVouchers((xs) => xs.filter((x) => x.id !== v.id));
                  })
                }
              />
            ))}
          </div>
        )}
      </Card>

      {/* Autogen-Historie */}
      {autogen.length > 0 && (
        <Card className="overflow-hidden">
          <header className="flex items-center justify-between p-5 border-b">
            <div>
              <div className="font-display font-bold flex items-center gap-2">
                <Sparkles size={16} className="text-gold" />
                Automatisch erzeugte Bon-Codes
              </div>
              <div className="text-sm text-muted-foreground">{autogen.length} Codes aus Kassenbons — eingelöst: {autogen.filter((v) => v.nutzungen_aktuell > 0).length}</div>
            </div>
          </header>
          <div className="divide-y max-h-80 overflow-y-auto">
            {autogen.slice(0, 50).map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <code className="font-mono text-xs text-matcha-700 font-bold">{v.code}</code>
                <span className="text-xs text-muted-foreground">
                  erstellt {dateDE(v.created_at)} · {v.nutzungen_aktuell > 0 ? '✓ eingelöst' : 'offen'}
                </span>
                <span className="ml-auto text-xs">bis {dateDE(v.gueltig_bis)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showNew && (
        <NewVoucherDialog
          onClose={() => setShowNew(false)}
          onSaved={(v) => { setVouchers((xs) => [v, ...xs]); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function VoucherRow({
  voucher, onCopy, copied, onToggle, onDelete,
}: {
  voucher: Voucher; onCopy: () => void; copied: boolean;
  onToggle: () => void; onDelete: () => void;
}) {
  const used = voucher.nutzungen_aktuell;
  const max = voucher.nutzungen_max;
  const icon = voucher.typ === 'prozent' ? <Percent size={16} /> :
               voucher.typ === 'fix' ? <EuroIcon size={16} /> :
               <Truck size={16} />;
  const label = voucher.typ === 'prozent' ? `${voucher.wert}%` :
                voucher.typ === 'fix' ? `${voucher.wert.toFixed(2).replace('.', ',')} €` :
                'Gratis-Lieferung';

  return (
    <div className={cn('flex items-center gap-4 px-5 py-4', !voucher.aktiv && 'opacity-50')}>
      <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono font-bold text-matcha-800">{voucher.code}</code>
          <Badge variant={voucher.aktiv ? 'accent' : 'muted'}>{voucher.aktiv ? 'aktiv' : 'pausiert'}</Badge>
          <span className="text-xs text-muted-foreground">{label}</span>
          {voucher.min_bestellwert > 0 && <span className="text-xs text-muted-foreground">· ab {euro(voucher.min_bestellwert)}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {voucher.beschreibung ?? '—'}
          {voucher.gueltig_bis && ` · gültig bis ${dateDE(voucher.gueltig_bis)}`}
        </div>
      </div>

      <div className="text-right text-xs">
        <div className="font-mono">{used}{max ? ` / ${max}` : ''}</div>
        <div className="text-muted-foreground">Einlösungen</div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onCopy}
          className="h-8 px-2 rounded-md hover:bg-muted flex items-center gap-1 text-xs"
          aria-label="Code kopieren"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          onClick={onToggle}
          className={cn('h-8 px-2 rounded-md hover:bg-muted flex items-center gap-1 text-xs', voucher.aktiv && 'text-matcha-700')}
        >
          {voucher.aktiv ? 'Pausieren' : 'Aktivieren'}
        </button>
        <button
          onClick={onDelete}
          className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-red-50 hover:text-red-700"
          aria-label="Löschen"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function NewVoucherDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (v: Voucher) => void }) {
  const [code, setCode] = useState('');
  const [typ, setTyp] = useState<'prozent' | 'fix' | 'gratis_lieferung'>('prozent');
  const [wert, setWert] = useState('10');
  const [minBestell, setMinBestell] = useState('15');
  const [gueltigBis, setGueltigBis] = useState('');
  const [nutzungenMax, setNutzungenMax] = useState('');
  const [nutzungenProKunde, setNutzungenProKunde] = useState('1');
  const [beschreibung, setBeschreibung] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setError(null);
    const w = parseFloat(wert.replace(',', '.'));
    if (!code.trim() || !Number.isFinite(w)) return setError('Code und Wert sind Pflicht');

    startSaving(async () => {
      const res = await createVoucher({
        code,
        typ,
        wert: w,
        min_bestellwert: parseFloat(minBestell.replace(',', '.')) || 0,
        gueltig_bis: gueltigBis ? new Date(gueltigBis).toISOString() : undefined,
        nutzungen_max: nutzungenMax ? parseInt(nutzungenMax, 10) : undefined,
        nutzungen_pro_kunde: parseInt(nutzungenProKunde, 10) || 1,
        beschreibung: beschreibung.trim() || undefined,
      });
      if (!res.ok) return setError(res.error ?? 'Fehler');
      // Re-fetch für id
      const sb = (await import('@/lib/supabase/client')).createClient();
      const { data } = await sb.from('vouchers').select('*, redemptions:voucher_redemptions(count)').eq('code', code.toUpperCase().replace(/\s/g, '')).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) onSaved(data as any);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md shadow-strong max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b">
          <div className="font-display font-bold">Neuer Gutschein</div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted"><X size={16} /></button>
        </header>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <Label>Code (kurz, einprägsam)</Label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="WELCOME10"
              autoFocus
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 font-mono uppercase"
            />
          </div>

          <div>
            <Label>Typ</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {[
                { id: 'prozent',          icon: Percent,  label: '%' },
                { id: 'fix',              icon: EuroIcon, label: '€' },
                { id: 'gratis_lieferung', icon: Truck,    label: 'Lieferung' },
              ].map((o) => {
                const Icon = o.icon as any;
                const active = typ === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setTyp(o.id as any)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition',
                      active ? 'border-matcha-700 bg-matcha-50' : 'border-border hover:bg-muted',
                    )}
                  >
                    <Icon size={16} />
                    <span className="text-xs font-semibold">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {typ !== 'gratis_lieferung' && (
            <div>
              <Label>{typ === 'prozent' ? 'Prozent (%)' : 'Rabatt (€)'}</Label>
              <input
                value={wert}
                onChange={(e) => setWert(e.target.value)}
                type="number"
                step={typ === 'prozent' ? '1' : '0.10'}
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min. Bestellwert (€)</Label>
              <input
                value={minBestell}
                onChange={(e) => setMinBestell(e.target.value)}
                type="number"
                step="1"
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
              />
            </div>
            <div>
              <Label>Gültig bis</Label>
              <input
                value={gueltigBis}
                onChange={(e) => setGueltigBis(e.target.value)}
                type="date"
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gesamt-Limit</Label>
              <input
                value={nutzungenMax}
                onChange={(e) => setNutzungenMax(e.target.value)}
                type="number"
                placeholder="unbegrenzt"
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
              />
            </div>
            <div>
              <Label>Pro Kunde</Label>
              <input
                value={nutzungenProKunde}
                onChange={(e) => setNutzungenProKunde(e.target.value)}
                type="number"
                className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
              />
            </div>
          </div>

          <div>
            <Label>Beschreibung (Kunden sehen das)</Label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={2}
              placeholder="z.B. Willkommen — 10% auf deine erste Bestellung"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          )}
        </div>
        <footer className="border-t px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm">Abbrechen</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Erstellen
          </button>
        </footer>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</div>;
}
