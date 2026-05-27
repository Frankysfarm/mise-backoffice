'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';
import { Check, Download, FileText, Loader2, Printer, Receipt } from 'lucide-react';
import { euro } from '@/lib/utils';

type Tenant = {
  name: string; logo_url: string | null;
  theme_primary: string | null; theme_accent: string | null;
  adresse: string | null; stadt: string | null; plz: string | null;
  telefon: string | null; email: string | null;
  steuernummer: string | null; ust_id: string | null;
};
type Location = { name: string; adresse: string | null; stadt: string | null; plz: string | null; telefon: string | null } | null;
type Transaction = {
  id: string; bon_token: string;
  brutto_gesamt: number; mwst_gesamt: number; netto_gesamt: number;
  zahlungsart: string; tisch_id: string | null;
  created_at: string;
  tse_signature: string | null; tse_serial: string | null;
  tse_transaction_id: string | null;
  tse_signature_counter: number | null;
  tse_start_time: string | null;
  tse_end_time: string | null;
  qr_code_data: string | null;
  trainingsbon: boolean | null;
  typ: string | null;
};
type Order = {
  bestellnummer: string;
  items: { name: string; menge: number; einzelpreis: number; gesamtpreis: number; notiz: string | null }[];
} | null;
type Bewirtung = {
  id: string; anlass: string; bewirtete_personen: string;
  bewirtender_name: string | null; bewirtender_firma: string | null;
  trinkgeld: number | null; ort: string | null; datum: string;
} | null;

export function BonView({
  transaction, tenant, location, order, bewirtung,
}: {
  transaction: Transaction; tenant: Tenant; location: Location;
  order: Order; bewirtung: Bewirtung;
}) {
  const [mode, setMode] = useState<'normal' | 'bewirtung'>(bewirtung ? 'bewirtung' : 'normal');
  const [showBewirtungForm, setShowBewirtungForm] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // QR-Code rendern (KassenSichV / BSI-TR-03153)
  useEffect(() => {
    if (!transaction.qr_code_data || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, transaction.qr_code_data, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(() => {});
  }, [transaction.qr_code_data]);

  const address = location?.adresse
    ? `${location.adresse}, ${location.plz ?? ''} ${location.stadt ?? ''}`
    : tenant.adresse
      ? `${tenant.adresse}, ${tenant.plz ?? ''} ${tenant.stadt ?? ''}`
      : '';

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Actions Bar (nur Bildschirm) */}
        <div className="print:hidden mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 min-w-0 h-11 rounded-xl bg-gray-900 text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-gray-800"
          >
            <Download className="h-4 w-4" /> Als PDF / Drucken
          </button>
          {!bewirtung && mode === 'normal' && (
            <button
              onClick={() => setShowBewirtungForm(true)}
              className="h-11 px-4 rounded-xl border-2 bg-white hover:bg-gray-50 font-bold inline-flex items-center gap-2 text-sm"
            >
              <FileText className="h-4 w-4" /> Bewirtungsbeleg
            </button>
          )}
        </div>

        {/* Bewirtungs-Form */}
        {showBewirtungForm && (
          <BewirtungForm
            transactionId={transaction.id}
            onSaved={() => {
              setShowBewirtungForm(false);
              setMode('bewirtung');
              window.location.reload();
            }}
            onClose={() => setShowBewirtungForm(false)}
          />
        )}

        {/* Receipt Paper */}
        <div className="bg-white rounded-2xl shadow-xl print:rounded-none print:shadow-none p-6 font-mono text-sm leading-snug">
          {/* Header */}
          <header className="text-center mb-4 pb-4 border-b-2 border-dashed">
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt="" className="mx-auto h-12 mb-2" />
            )}
            <div className="font-display text-lg font-black">{tenant.name}</div>
            {address && <div className="text-xs">{address}</div>}
            {tenant.telefon && <div className="text-xs">Tel. {tenant.telefon}</div>}
            {tenant.ust_id && <div className="text-[10px] mt-1">USt-IdNr: {tenant.ust_id}</div>}
            {tenant.steuernummer && !tenant.ust_id && <div className="text-[10px] mt-1">St-Nr: {tenant.steuernummer}</div>}
          </header>

          {/* Training-Banner (Pflicht §146a AO — kein steuerrelevanter Vorgang) */}
          {transaction.trainingsbon && (
            <div className="mb-3 -mx-6 -mt-2 py-2 bg-red-600 text-white text-center font-display font-black uppercase tracking-wider text-sm border-y-2 border-red-800">
              ⚠️ Trainingsbeleg<br/>
              <span className="text-[10px] font-normal opacity-90">Kein steuerrelevanter Vorgang</span>
            </div>
          )}

          {/* Receipt Title */}
          <div className="text-center mb-3">
            <div className="font-display text-xl font-black uppercase tracking-wider">
              {mode === 'bewirtung' ? 'Bewirtungsbeleg' : (transaction.typ === 'storno' ? 'Stornobeleg' : 'Kassenbeleg')}
            </div>
            <div className="text-xs mt-1">
              Beleg-Nr: <strong>{order?.bestellnummer ?? transaction.id.slice(0, 8)}</strong>
            </div>
            <div className="text-xs">
              Leistungs- und Ausstellungsdatum:{' '}
              {new Date(transaction.created_at).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>

          {/* Items */}
          {order && order.items && order.items.length > 0 && (
            <section className="mb-3 border-t-2 border-dashed pt-3">
              {order.items.map((it, i) => (
                <div key={i} className="mb-1.5">
                  <div className="flex justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-bold">{it.menge}× </span>{it.name}
                    </div>
                    <div className="font-bold shrink-0">{euro(it.gesamtpreis)}</div>
                  </div>
                  {it.notiz && <div className="text-[10px] italic text-gray-600 pl-5">→ {it.notiz}</div>}
                  {it.menge > 1 && (
                    <div className="text-[10px] text-gray-600 pl-5">
                      à {euro(it.einzelpreis)}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Summary */}
          <section className="border-t-2 border-dashed pt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span>Netto:</span>
              <span>{euro(transaction.netto_gesamt)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>MwSt:</span>
              <span>{euro(transaction.mwst_gesamt)}</span>
            </div>
            {mode === 'bewirtung' && bewirtung?.trinkgeld && bewirtung.trinkgeld > 0 && (
              <div className="flex justify-between text-xs">
                <span>Trinkgeld:</span>
                <span>{euro(bewirtung.trinkgeld)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-lg font-black pt-2 border-t">
              <span>GESAMT:</span>
              <span>{euro(transaction.brutto_gesamt + (mode === 'bewirtung' ? Number(bewirtung?.trinkgeld ?? 0) : 0))}</span>
            </div>
            <div className="text-xs pt-1">
              Zahlungsart: <strong>{paymentLabel(transaction.zahlungsart)}</strong>
            </div>
          </section>

          {/* Bewirtungsbeleg-Abschnitt */}
          {mode === 'bewirtung' && bewirtung && (
            <section className="mt-4 pt-3 border-t-2 border-dashed space-y-2 text-xs">
              <div>
                <div className="font-bold uppercase text-[10px] tracking-wider">Anlass der Bewirtung</div>
                <div>{bewirtung.anlass}</div>
              </div>
              <div>
                <div className="font-bold uppercase text-[10px] tracking-wider">Bewirtete Personen</div>
                <div className="whitespace-pre-wrap">{bewirtung.bewirtete_personen}</div>
              </div>
              {bewirtung.bewirtender_name && (
                <div>
                  <div className="font-bold uppercase text-[10px] tracking-wider">Bewirtender</div>
                  <div>{bewirtung.bewirtender_name}{bewirtung.bewirtender_firma ? ` · ${bewirtung.bewirtender_firma}` : ''}</div>
                </div>
              )}
              <div className="pt-3 text-[10px] text-gray-600">
                Angaben gem. § 4 Abs. 5 Satz 1 Nr. 2 EStG
              </div>
              <div className="mt-6 flex gap-4 text-[10px]">
                <div className="flex-1 pt-6 border-t">Ort, Datum</div>
                <div className="flex-1 pt-6 border-t">Unterschrift Bewirtender</div>
              </div>
            </section>
          )}

          {/* TSE-Block (KassenSichV / BSI-TR-03153 konform) */}
          {transaction.tse_signature && (
            <section className="mt-3 pt-3 border-t-2 border-dashed">
              {transaction.qr_code_data ? (
                <div className="flex flex-col items-center gap-2">
                  <canvas ref={qrCanvasRef} className="w-[140px] h-[140px]" />
                  <div className="text-[9px] text-gray-600 text-center leading-tight">
                    <strong>TSE · fiskaly Cloud (BSI-zertifiziert bis 2033)</strong><br/>
                    Zur Prüfung: QR-Code scannen
                  </div>
                </div>
              ) : (
                <div className="text-[9px] leading-tight text-orange-700">
                  <strong>⚠️ TSE-Ausfall dokumentiert</strong> — §146a AO erfüllt durch tse_outage_log
                </div>
              )}
              <div className="text-[8px] leading-tight text-gray-500 mt-2 space-y-0.5">
                {transaction.tse_serial && <div>Serial: {transaction.tse_serial}</div>}
                {transaction.tse_signature_counter != null && <div>Signatur-Zähler: {transaction.tse_signature_counter}</div>}
                {transaction.tse_transaction_id && <div>Tx-ID: {transaction.tse_transaction_id.slice(0, 24)}…</div>}
                {transaction.tse_start_time && (
                  <div>Start: {new Date(transaction.tse_start_time).toLocaleString('de-DE')}</div>
                )}
                {transaction.tse_end_time && (
                  <div>Ende: {new Date(transaction.tse_end_time).toLocaleString('de-DE')}</div>
                )}
              </div>
              <div className="text-[8px] text-gray-500 mt-1 break-all">
                <span className="font-bold">Signatur:</span> {transaction.tse_signature.slice(0, 80)}…
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-4 pt-3 border-t-2 border-dashed text-center text-[10px] text-gray-600 space-y-1">
            <div>Vielen Dank für deinen Besuch!</div>
            {tenant.email && <div>{tenant.email}</div>}
            <div className="mt-2">Beleg unter /bon/{transaction.bon_token.slice(0, 8)}…</div>
          </footer>
        </div>

        <div className="print:hidden mt-4 text-center text-xs text-gray-500">
          Beleg aufbewahren für Gewährleistung & Steuererklärung
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function BewirtungForm({
  transactionId, onSaved, onClose,
}: {
  transactionId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [anlass, setAnlass] = useState('');
  const [personen, setPersonen] = useState('');
  const [name, setName] = useState('');
  const [firma, setFirma] = useState('');
  const [trinkgeld, setTrinkgeld] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await supabase.from('bewirtungsbelege').insert({
        transaction_id: transactionId,
        anlass: anlass.trim(),
        bewirtete_personen: personen.trim(),
        bewirtender_name: name.trim() || null,
        bewirtender_firma: firma.trim() || null,
        trinkgeld: trinkgeld ? parseFloat(trinkgeld.replace(',', '.')) || 0 : 0,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const canSave = anlass.trim().length > 0 && personen.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid items-end sm:items-center justify-center p-4 print:hidden">
      <div className="w-full sm:max-w-md bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-xl font-black mb-1">Bewirtungsbeleg erstellen</h2>
        <p className="text-sm text-gray-600 mb-4">
          Für Steuer-Absetzbarkeit nach § 4 Abs. 5 EStG.
        </p>

        <div className="space-y-3">
          <Field label="Anlass der Bewirtung *">
            <input value={anlass} onChange={(e) => setAnlass(e.target.value)}
              placeholder="z.B. Kundenakquise Müller GmbH"
              className="w-full h-11 rounded-xl border-2 bg-white px-3" />
          </Field>
          <Field label="Teilnehmer * (Name, Funktion)">
            <textarea value={personen} onChange={(e) => setPersonen(e.target.value)}
              rows={3}
              placeholder={`Max Mustermann (Geschäftsführer Müller GmbH)\nAnna Schmidt (Einkauf Müller GmbH)`}
              className="w-full rounded-xl border-2 bg-white px-3 py-2 text-sm font-mono" />
          </Field>
          <Field label="Dein Name (Bewirtender)">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full h-11 rounded-xl border-2 bg-white px-3" />
          </Field>
          <Field label="Deine Firma">
            <input value={firma} onChange={(e) => setFirma(e.target.value)}
              className="w-full h-11 rounded-xl border-2 bg-white px-3" />
          </Field>
          <Field label="Trinkgeld (optional, €)">
            <input value={trinkgeld} onChange={(e) => setTrinkgeld(e.target.value)}
              type="text" inputMode="decimal" placeholder="0,00"
              className="w-full h-11 rounded-xl border-2 bg-white px-3 font-mono" />
          </Field>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={save} disabled={!canSave || saving}
            className="flex-1 h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Beleg erstellen
          </button>
          <button onClick={onClose} className="h-12 px-4 rounded-xl border-2 bg-white hover:bg-gray-50 font-bold">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function paymentLabel(m: string): string {
  switch (m) {
    case 'bar': return 'Bar';
    case 'karte': return 'Karte (EC/Kreditkarte)';
    case 'online': return 'Apple/Google Pay';
    default: return m;
  }
}
