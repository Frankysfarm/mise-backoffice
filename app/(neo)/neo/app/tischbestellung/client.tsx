'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import {
  AlertCircle, Check, Copy, CreditCard, ExternalLink, Layers, MonitorDot,
  Pencil, Plus, Printer, QrCode, Save, Settings, Trash2, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Table = {
  id: string;
  tenant_id: string;
  location_id: string;
  nummer: string;
  name: string | null;
  kapazitaet: number | null;
  bereich: string | null;
  qr_token: string;
  aktiv: boolean;
  sort_order: number;
};

type FormState = {
  id?: string;
  nummer: string;
  name: string;
  bereich: string;
  kapazitaet: string;
};

const EMPTY_FORM: FormState = { nummer: '', name: '', bereich: 'Innen', kapazitaet: '2' };
const AREA_TINT: Record<string, string> = { Innen: '#EEF2FF', Außen: '#ECFDF5', Bar: '#FEF3C7', Terrasse: '#F5F3FF' };

export function TischbestellungClient({ tables: initialTables, tenantId, locationId, slug }: {
  tables: Table[];
  tenantId: string;
  locationId: string;
  slug: string;
}) {
  const supabase = createClient();
  const [tables, setTables] = useState(initialTables);
  const [tab, setTab] = useState<'tische' | 'einstellungen'>('tische');
  const [areaFilter, setAreaFilter] = useState('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  const areas = useMemo(() => Array.from(new Set(tables.map((table) => table.bereich).filter(Boolean))) as string[], [tables]);
  const filtered = areaFilter === 'all' ? tables : tables.filter((table) => table.bereich === areaFilter);
  const firstGuestUrl = tables.find((table) => table.aktiv)?.qr_token ? `/t/${tables.find((table) => table.aktiv)!.qr_token}` : null;
  const qrUrl = (token: string) => `https://mise-gastro.de/t/${token}`;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  }

  async function copyUrl(table: Table) {
    await navigator.clipboard.writeText(qrUrl(table.qr_token));
    setCopied(table.id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  function openEdit(table: Table) {
    setError('');
    setForm({
      id: table.id,
      nummer: table.nummer,
      name: table.name ?? '',
      bereich: table.bereich ?? 'Innen',
      kapazitaet: String(table.kapazitaet ?? 2),
    });
  }

  function saveTable() {
    if (!form?.nummer.trim()) {
      setError('Bitte eine Tischnummer eingeben.');
      return;
    }
    const capacity = Math.max(1, Math.min(50, Math.trunc(Number(form.kapazitaet) || 1)));
    const payload = {
      nummer: form.nummer.trim(),
      name: form.name.trim() || null,
      bereich: form.bereich || null,
      kapazitaet: capacity,
    };
    setError('');
    startTransition(async () => {
      if (form.id) {
        const { data, error: updateError } = await supabase.from('restaurant_tables').update(payload).eq('id', form.id).select().single();
        if (updateError || !data) {
          setError(updateError?.message ?? 'Tisch konnte nicht gespeichert werden.');
          return;
        }
        setTables((current) => current.map((table) => table.id === data.id ? data as Table : table));
        flash(`Tisch ${payload.nummer} gespeichert.`);
      } else {
        const { data, error: insertError } = await supabase.from('restaurant_tables').insert({
          ...payload,
          tenant_id: tenantId,
          location_id: locationId,
          aktiv: true,
          sort_order: tables.length + 1,
        }).select().single();
        if (insertError || !data) {
          setError(insertError?.message ?? 'Tisch konnte nicht angelegt werden.');
          return;
        }
        setTables((current) => [...current, data as Table]);
        flash(`Tisch ${payload.nummer} angelegt.`);
      }
      setForm(null);
    });
  }

  function toggleTable(table: Table) {
    setError('');
    startTransition(async () => {
      const { data, error: updateError } = await supabase.from('restaurant_tables').update({ aktiv: !table.aktiv }).eq('id', table.id).select().single();
      if (updateError || !data) {
        setError(updateError?.message ?? 'Status konnte nicht geändert werden.');
        return;
      }
      setTables((current) => current.map((item) => item.id === data.id ? data as Table : item));
    });
  }

  function deleteTable(table: Table) {
    if (!window.confirm(`Tisch ${table.nummer} wirklich löschen? Der QR-Code wird danach ungültig.`)) return;
    setError('');
    startTransition(async () => {
      const { error: deleteError } = await supabase.from('restaurant_tables').delete().eq('id', table.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      setTables((current) => current.filter((item) => item.id !== table.id));
      flash(`Tisch ${table.nummer} gelöscht.`);
    });
  }

  const tabStyle = (active: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px',
    border: 0, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: active ? '#4F46E5' : 'transparent', color: active ? '#fff' : '#64748B',
  });

  return (
    <div>
      {(error || notice) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, borderRadius: 11, padding: '10px 13px', border: `1px solid ${error ? '#FECACA' : '#C7D2FE'}`, background: error ? '#FEF2F2' : '#EEF2FF', color: error ? '#B91C1C' : '#3730A3', fontSize: 13, fontWeight: 700 }}>
          {error ? <AlertCircle size={16} /> : <Check size={16} />}{error || notice}
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: 4, padding: 4, marginBottom: 18, borderRadius: 12, background: '#E2E8F0' }}>
        <button style={tabStyle(tab === 'tische')} onClick={() => setTab('tische')}><QrCode size={15} /> Tische & QR-Codes</button>
        <button style={tabStyle(tab === 'einstellungen')} onClick={() => setTab('einstellungen')}><Settings size={15} /> Verknüpfte Einstellungen</button>
      </div>

      {tab === 'tische' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} style={{ height: 39, minWidth: 180, border: '1px solid #CBD5E1', borderRadius: 10, background: '#fff', padding: '0 12px', color: '#475569', fontSize: 13, fontWeight: 650 }}>
              <option value="all">Alle Bereiche ({tables.length})</option>
              {areas.map((area) => <option key={area} value={area}>{area} ({tables.filter((table) => table.bereich === area).length})</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              {tables.length > 0 && <a href="/pos/tables/print" target="_blank" style={secondaryButton}><Printer size={15} /> Alle QR-Codes</a>}
              <button onClick={() => { setError(''); setForm({ ...EMPTY_FORM }); }} style={primaryButton}><Plus size={15} /> Tisch hinzufügen</button>
            </div>
          </div>

          {form && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr .8fr auto', gap: 10, alignItems: 'end', marginBottom: 15, padding: 15, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 14 }}>
              <Field label="Tischnummer"><input autoFocus value={form.nummer} onChange={(event) => setForm({ ...form, nummer: event.target.value })} onKeyDown={(event) => event.key === 'Enter' && saveTable()} style={inputStyle} placeholder="z. B. 12" /></Field>
              <Field label="Name (optional)"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={inputStyle} placeholder="Fensterplatz" /></Field>
              <Field label="Bereich"><select value={form.bereich} onChange={(event) => setForm({ ...form, bereich: event.target.value })} style={inputStyle}>{['Innen', 'Außen', 'Bar', 'Terrasse'].map((area) => <option key={area}>{area}</option>)}</select></Field>
              <Field label="Plätze"><input type="number" min={1} max={50} value={form.kapazitaet} onChange={(event) => setForm({ ...form, kapazitaet: event.target.value })} style={inputStyle} /></Field>
              <div style={{ display: 'flex', gap: 6 }}><button disabled={pending} onClick={saveTable} style={primaryButton}><Save size={14} /> Speichern</button><button onClick={() => setForm(null)} style={iconButton} aria-label="Abbrechen"><X size={16} /></button></div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ padding: '46px 24px', textAlign: 'center', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16 }}>
              <div style={{ width: 50, height: 50, margin: '0 auto 11px', borderRadius: 14, background: '#EEF2FF', color: '#4F46E5', display: 'grid', placeItems: 'center' }}><QrCode size={24} /></div>
              <div style={{ fontSize: 15, fontWeight: 750, color: '#334155' }}>Noch keine Tische in diesem Bereich</div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#94A3B8' }}>Lege den ersten Tisch an; der QR-Token wird automatisch erzeugt.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 12 }}>
              {filtered.map((table) => (
                <div key={table.id} style={{ padding: 16, background: '#fff', border: `1px solid ${table.aktiv ? '#E2E8F0' : '#F1F5F9'}`, borderRadius: 15, opacity: table.aktiv ? 1 : .58 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                    <div><div style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 19, fontWeight: 700, color: '#0F172A' }}>Tisch {table.nummer}</div>{table.name && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{table.name}</div>}</div>
                    <div style={{ textAlign: 'right' }}>{table.bereich && <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 7, background: AREA_TINT[table.bereich] ?? '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 700 }}>{table.bereich}</span>}<div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{table.kapazitaet ?? 1} Plätze</div></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 11, borderRadius: 9, background: '#F8FAFC', color: '#64748B' }}><QrCode size={14} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{qrUrl(table.qr_token)}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => copyUrl(table)} style={smallButton}>{copied === table.id ? <Check size={13} /> : <Copy size={13} />}{copied === table.id ? 'Kopiert' : 'Link'}</button>
                    <a href={qrUrl(table.qr_token)} target="_blank" rel="noreferrer" style={smallButton}><ExternalLink size={13} /> Gastansicht</a>
                    <a href={`/api/pos/tables/${table.qr_token}/qr`} target="_blank" style={smallButton}><Printer size={13} /> QR</a>
                    <button onClick={() => openEdit(table)} style={iconButton} aria-label={`Tisch ${table.nummer} bearbeiten`}><Pencil size={14} /></button>
                    <button onClick={() => toggleTable(table)} style={{ ...smallButton, color: table.aktiv ? '#047857' : '#64748B', background: table.aktiv ? '#ECFDF5' : '#F8FAFC' }}>{table.aktiv ? 'Aktiv' : 'Inaktiv'}</button>
                    <button onClick={() => deleteTable(table)} style={{ ...iconButton, color: '#DC2626', background: '#FEF2F2', borderColor: '#FECACA' }} aria-label={`Tisch ${table.nummer} löschen`}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'einstellungen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          <ActionCard href="/neo/app/zahlungen" icon={<CreditCard size={20} />} title="Zahlungsarten" text="Karte, Apple Pay und Barzahlung im echten Zahlungsmodul verwalten." />
          <ActionCard href="/neo/app/menu" icon={<Layers size={20} />} title="Speisekarte" text="Artikel, Preise und Verfügbarkeit für die Gastansicht pflegen." />
          <ActionCard href="/neo/app/lieferzentrale" icon={<MonitorDot size={20} />} title="Lieferzentrale" text="Tischbestellungen zusammen mit Lieferung und Abholung bearbeiten." />
          <ActionCard href="/pos/tables/print" icon={<Printer size={20} />} title="Druckvorlagen" text="Alle Tisch-QR-Codes als druckfertige Vorlage öffnen." external />
          {firstGuestUrl && <ActionCard href={firstGuestUrl} icon={<QrCode size={20} />} title="Gastansicht prüfen" text={`Bestellseite für ${slug || 'deinen Betrieb'} mit einem aktiven Tisch öffnen.`} external />}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 750, color: '#475569' }}>{label}</span>{children}</label>;
}

function ActionCard({ href, icon, title, text, external }: { href: string; icon: React.ReactNode; title: string; text: string; external?: boolean }) {
  return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} style={{ display: 'flex', gap: 13, padding: 18, borderRadius: 15, border: '1px solid #E2E8F0', background: '#fff', color: '#0F172A', textDecoration: 'none' }}><span style={{ width: 42, height: 42, borderRadius: 11, background: '#EEF2FF', color: '#4F46E5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</span><span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 750 }}>{title}</span><span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.5, color: '#64748B' }}>{text}</span></span><ExternalLink size={15} style={{ color: '#94A3B8' }} /></a>;
}

const inputStyle: CSSProperties = { width: '100%', height: 39, boxSizing: 'border-box', border: '1px solid #C7D2FE', borderRadius: 9, background: '#fff', padding: '0 10px', color: '#0F172A', fontSize: 13, outline: 'none' };
const primaryButton: CSSProperties = { height: 39, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 14px', border: 0, borderRadius: 9, background: '#4F46E5', color: '#fff', textDecoration: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 750, whiteSpace: 'nowrap' };
const secondaryButton: CSSProperties = { ...primaryButton, border: '1px solid #CBD5E1', background: '#fff', color: '#475569' };
const smallButton: CSSProperties = { minHeight: 31, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0 9px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#475569', textDecoration: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 };
const iconButton: CSSProperties = { width: 31, height: 31, display: 'inline-grid', placeItems: 'center', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#64748B', cursor: 'pointer' };
