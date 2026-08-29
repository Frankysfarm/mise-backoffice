'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle, Bell, Check, Copy, CreditCard, Download, ExternalLink, Layers, MonitorDot,
  Pencil, Plus, Printer, QrCode, RotateCcw, Save, Settings, ShieldCheck, Trash2, X,
} from 'lucide-react';

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
  status?: 'frei' | 'belegt' | 'reserviert' | 'reinigung' | 'gesperrt';
  qr_version?: number;
  service_department_id?: string | null;
  service_confirmation_required?: boolean;
  session_ttl_minutes?: number;
  menu_locale?: string | null;
  menu_variant?: string | null;
};

type ServiceDepartment = { id: string; name: string };

type ServiceRequest = {
  id: string;
  table_id: string;
  request_type: string;
  message: string | null;
  status: 'offen' | 'angenommen';
  assigned_to: string | null;
  created_at: string;
  table: { nummer: string; name: string | null; bereich: string | null } | null;
};

type PendingSession = {
  id: string;
  table_id: string;
  status: 'wartet_auf_bestaetigung';
  created_at: string;
  expires_at: string;
  table: { nummer: string; name: string | null; bereich: string | null } | null;
};

type FormState = {
  id?: string;
  nummer: string;
  name: string;
  bereich: string;
  kapazitaet: string;
  status: 'frei' | 'belegt' | 'reserviert' | 'reinigung' | 'gesperrt';
  serviceDepartmentId: string;
  confirmationRequired: boolean;
  sessionTtlMinutes: string;
  menuLocale: string;
  menuVariant: string;
};

const EMPTY_FORM: FormState = { nummer: '', name: '', bereich: 'Innenbereich', kapazitaet: '2', status: 'frei', serviceDepartmentId: '', confirmationRequired: false, sessionTtlMinutes: '180', menuLocale: 'de', menuVariant: '' };
const AREA_TINT: Record<string, string> = { Innen: '#EEF2FF', Außen: '#ECFDF5', Bar: '#FEF3C7', Terrasse: '#F5F3FF' };

export function TischbestellungClient({
  tables: initialTables, slug,
  initialServiceRequests = [], initialPendingSessions = [], serviceDepartments = [],
}: {
  tables: Table[];
  slug: string;
  initialServiceRequests?: ServiceRequest[];
  initialPendingSessions?: PendingSession[];
  serviceDepartments?: ServiceDepartment[];
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tables, setTables] = useState(initialTables);
  const [tab, setTab] = useState<'tische' | 'service' | 'einstellungen'>(requestedTab === 'service' || requestedTab === 'einstellungen' ? requestedTab : 'tische');
  const [areaFilter, setAreaFilter] = useState('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serviceRequests, setServiceRequests] = useState(initialServiceRequests);
  const [pendingSessions, setPendingSessions] = useState(initialPendingSessions);
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
      status: table.status ?? 'frei',
      serviceDepartmentId: table.service_department_id ?? '',
      confirmationRequired: table.service_confirmation_required ?? false,
      sessionTtlMinutes: String(table.session_ttl_minutes ?? 180),
      menuLocale: table.menu_locale ?? 'de',
      menuVariant: table.menu_variant ?? '',
    });
  }

  function saveTable() {
    if (!form?.nummer.trim()) {
      setError('Bitte eine Tischnummer eingeben.');
      return;
    }
    const capacity = Math.max(1, Math.min(50, Math.trunc(Number(form.kapazitaet) || 1)));
    const payload = {
      action: 'save',
      id: form.id || null,
      nummer: form.nummer.trim(),
      name: form.name.trim() || null,
      bereich: form.bereich.trim(),
      kapazitaet: capacity,
      status: form.status,
      serviceDepartmentId: form.serviceDepartmentId || null,
      confirmationRequired: form.confirmationRequired,
      sessionTtlMinutes: Math.max(15, Math.min(720, Math.trunc(Number(form.sessionTtlMinutes) || 180))),
      menuLocale: form.menuLocale.trim() || null,
      menuVariant: form.menuVariant.trim() || null,
    };
    setError('');
    startTransition(async () => {
      const response = await fetch('/api/operations/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.table) { setError(result?.error ?? 'Tisch konnte nicht gespeichert werden.'); return; }
      const data = result.table as Table;
      setTables((current) => form.id ? current.map((table) => table.id === data.id ? data : table) : [...current, data]);
      flash(`Tisch ${payload.nummer} ${form.id ? 'gespeichert' : 'angelegt'}.`);
      setForm(null);
    });
  }

  function toggleTable(table: Table) {
    setError('');
    startTransition(async () => {
      const response = await fetch('/api/operations/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', id: table.id, aktiv: !table.aktiv }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.table) { setError(result?.error ?? 'Status konnte nicht geändert werden.'); return; }
      setTables((current) => current.map((item) => item.id === result.table.id ? result.table as Table : item));
    });
  }

  function deleteTable(table: Table) {
    if (!window.confirm(`Tisch ${table.nummer} archivieren? Der QR-Code und laufende Sitzungen werden gesperrt; Bestellhistorie bleibt erhalten.`)) return;
    setError('');
    startTransition(async () => {
      const response = await fetch('/api/operations/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive', id: table.id }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.table) { setError(result?.error ?? 'Tisch konnte nicht archiviert werden.'); return; }
      setTables((current) => current.map((item) => item.id === table.id ? result.table as Table : item));
      flash(`Tisch ${table.nummer} archiviert.`);
    });
  }

  async function runServiceAction(action: 'confirm_session' | 'accept_request' | 'complete_request' | 'regenerate_qr', id: string) {
    setError('');
    const response = await fetch('/api/operations/tables/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? 'Aktion fehlgeschlagen.');
      return;
    }
    if (action === 'confirm_session') {
      setPendingSessions((current) => current.filter((session) => session.id !== id));
      flash('Tischsitzung bestätigt.');
    }
    if (action === 'accept_request') {
      setServiceRequests((current) => current.map((item) => item.id === id ? { ...item, status: 'angenommen' } : item));
      flash('Serviceanfrage übernommen.');
    }
    if (action === 'complete_request') {
      setServiceRequests((current) => current.filter((item) => item.id !== id));
      flash('Serviceanfrage erledigt.');
    }
    if (action === 'regenerate_qr' && result?.qrToken) {
      setTables((current) => current.map((table) => table.id === id
        ? { ...table, qr_token: result.qrToken, qr_version: result.qrVersion }
        : table));
      flash('Alter QR-Code deaktiviert und neuer Code erzeugt.');
    }
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
        <button style={tabStyle(tab === 'service')} onClick={() => setTab('service')}><Bell size={15} /> Service {serviceRequests.length + pendingSessions.length > 0 ? `(${serviceRequests.length + pendingSessions.length})` : ''}</button>
        <button style={tabStyle(tab === 'einstellungen')} onClick={() => setTab('einstellungen')}><Settings size={15} /> Verknüpfte Einstellungen</button>
      </div>

      {tab === 'tische' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} style={{ height: 39, minWidth: 180, border: '1px solid #CBD5E1', borderRadius: 10, background: '#fff', padding: '0 12px', color: '#475569', fontSize: 13, fontWeight: 650 }}>
              <option value="all">Alle Bereiche ({tables.length})</option>
              {areas.map((area) => <option key={area} value={area}>{area} ({tables.filter((table) => table.bereich === area).length})</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tables.length > 0 && <a href="/api/pdf/table-qrs?design=karte" style={secondaryButton}><Download size={15} /> Karten-PDF</a>}
              {tables.length > 0 && <a href="/api/pdf/table-qrs?design=sticker" style={secondaryButton}><Download size={15} /> Sticker-PDF</a>}
              {tables.length > 0 && <a href="/api/pdf/table-qrs?design=aufsteller" style={secondaryButton}><Download size={15} /> Aufsteller-PDF</a>}
              {tables.length > 0 && <a href="/pos/tables/print" target="_blank" style={secondaryButton}><Printer size={15} /> Alle QR-Codes</a>}
              <button onClick={() => { setError(''); setForm({ ...EMPTY_FORM }); }} style={primaryButton}><Plus size={15} /> Tisch hinzufügen</button>
            </div>
          </div>

          {form && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end', marginBottom: 15, padding: 15, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 14 }}>
              <Field label="Tischnummer"><input autoFocus value={form.nummer} onChange={(event) => setForm({ ...form, nummer: event.target.value })} onKeyDown={(event) => event.key === 'Enter' && saveTable()} style={inputStyle} placeholder="z. B. 12" /></Field>
              <Field label="Name (optional)"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={inputStyle} placeholder="Fensterplatz" /></Field>
              <Field label="Bereich"><input list="table-areas" value={form.bereich} onChange={(event) => setForm({ ...form, bereich: event.target.value })} style={inputStyle} placeholder="z. B. Terrasse" /><datalist id="table-areas">{[...new Set(['Innenbereich', 'Terrasse', 'Obergeschoss', 'Bar', 'Außenbereich', 'Eventbereich', ...areas])].map((area) => <option value={area} key={area} />)}</datalist></Field>
              <Field label="Plätze"><input type="number" min={1} max={50} value={form.kapazitaet} onChange={(event) => setForm({ ...form, kapazitaet: event.target.value })} style={inputStyle} /></Field>
              <Field label="Tischstatus"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FormState['status'] })} style={inputStyle}><option value="frei">Frei</option><option value="belegt">Belegt</option><option value="reserviert">Reserviert</option><option value="reinigung">Reinigung</option><option value="gesperrt">Gesperrt</option></select></Field>
              <Field label="Zuständiger Servicebereich"><select value={form.serviceDepartmentId} onChange={(event) => setForm({ ...form, serviceDepartmentId: event.target.value })} style={inputStyle}><option value="">Automatisch / Service</option>{serviceDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
              <Field label="Session (Minuten)"><input type="number" min={15} max={720} value={form.sessionTtlMinutes} onChange={(event) => setForm({ ...form, sessionTtlMinutes: event.target.value })} style={inputStyle} /></Field>
              <Field label="Menüsprache"><input value={form.menuLocale} onChange={(event) => setForm({ ...form, menuLocale: event.target.value })} style={inputStyle} placeholder="de" /></Field>
              <Field label="Menüvariante"><input value={form.menuVariant} onChange={(event) => setForm({ ...form, menuVariant: event.target.value })} style={inputStyle} placeholder="z. B. Abendkarte" /></Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 39, fontSize: 11.5, fontWeight: 750, color: '#475569' }}><input type="checkbox" checked={form.confirmationRequired} onChange={(event) => setForm({ ...form, confirmationRequired: event.target.checked })} /> Service muss Sitzung bestätigen</label>
              <div style={{ display: 'flex', gap: 6 }}><button disabled={pending || !form.bereich.trim()} onClick={saveTable} style={primaryButton}><Save size={14} /> Speichern</button><button onClick={() => setForm(null)} style={iconButton} aria-label="Abbrechen"><X size={16} /></button></div>
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
                    <div style={{ textAlign: 'right' }}>{table.bereich && <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 7, background: AREA_TINT[table.bereich] ?? '#F1F5F9', color: '#475569', fontSize: 11, fontWeight: 700 }}>{table.bereich}</span>}<div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{table.kapazitaet ?? 1} Plätze · {tableStatusLabel(table.status ?? 'frei')}</div></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 11, borderRadius: 9, background: '#F8FAFC', color: '#64748B' }}><QrCode size={14} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{qrUrl(table.qr_token)}</span></div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => copyUrl(table)} style={smallButton}>{copied === table.id ? <Check size={13} /> : <Copy size={13} />}{copied === table.id ? 'Kopiert' : 'Link'}</button>
                    <a href={qrUrl(table.qr_token)} target="_blank" rel="noreferrer" style={smallButton}><ExternalLink size={13} /> Gastansicht</a>
                    <a href={`/api/pos/tables/${table.qr_token}/qr`} target="_blank" style={smallButton}><Printer size={13} /> QR</a>
                    <a href={`/api/pos/tables/${table.qr_token}/download?format=png`} style={smallButton}><Download size={13} /> PNG</a>
                    <button onClick={() => openEdit(table)} style={iconButton} aria-label={`Tisch ${table.nummer} bearbeiten`}><Pencil size={14} /></button>
                    <button onClick={() => void runServiceAction('regenerate_qr', table.id)} style={iconButton} aria-label={`QR-Code für Tisch ${table.nummer} erneuern`} title="QR-Code erneuern"><RotateCcw size={14} /></button>
                    <button onClick={() => toggleTable(table)} style={{ ...smallButton, color: table.aktiv ? '#047857' : '#64748B', background: table.aktiv ? '#ECFDF5' : '#F8FAFC' }}>{table.aktiv ? 'Aktiv' : 'Inaktiv'}</button>
                    <button onClick={() => deleteTable(table)} style={{ ...iconButton, color: '#DC2626', background: '#FEF2F2', borderColor: '#FECACA' }} aria-label={`Tisch ${table.nummer} archivieren`} title="Archivieren"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'service' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><ShieldCheck size={18} color="#4F46E5" /><h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Tischbestätigungen</h3><span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>{pendingSessions.length} offen</span></div>
            {pendingSessions.length === 0 ? <EmptyQueue text="Keine Tischsitzung wartet auf Bestätigung." /> : (
              <div style={{ display: 'grid', gap: 9 }}>
                {pendingSessions.map((session) => <QueueCard key={session.id} title={`Tisch ${session.table?.nummer ?? '–'}`} detail={`${session.table?.bereich ?? 'Bereich'} · wartet seit ${new Date(session.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`} action="Bestätigen" onAction={() => void runServiceAction('confirm_session', session.id)} />)}
              </div>
            )}
          </section>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><Bell size={18} color="#D97706" /><h3 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Serviceanfragen</h3><span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>{serviceRequests.length} offen</span></div>
            {serviceRequests.length === 0 ? <EmptyQueue text="Keine offenen Serviceanfragen." /> : (
              <div style={{ display: 'grid', gap: 9 }}>
                {serviceRequests.map((request) => <QueueCard key={request.id} title={`Tisch ${request.table?.nummer ?? '–'} · ${serviceRequestLabel(request.request_type)}`} detail={`${request.table?.bereich ?? 'Service'} · ${new Date(request.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${request.message ? ` · ${request.message}` : ''}`} action={request.status === 'offen' ? 'Übernehmen' : 'Erledigen'} onAction={() => void runServiceAction(request.status === 'offen' ? 'accept_request' : 'complete_request', request.id)} />)}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'einstellungen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          <ActionCard href="/neo/app/zahlungen" icon={<CreditCard size={20} />} title="Zahlungsarten" text="Karte, Apple Pay und Barzahlung im echten Zahlungsmodul verwalten." />
          <ActionCard href="/neo/app/menu" icon={<Layers size={20} />} title="Speisekarte" text="Artikel, Preise und Verfügbarkeit für die Gastansicht pflegen." />
          <ActionCard href="/neo/app/lieferzentrale" icon={<MonitorDot size={20} />} title="Lieferzentrale" text="Tischbestellungen zusammen mit Lieferung und Abholung bearbeiten." />
          <ActionCard href="/pos/tables/print" icon={<Printer size={20} />} title="Druckvorlagen" text="Alle Tisch-QR-Codes als druckfertige Vorlage öffnen." external />
          <ActionCard href="/api/pdf/table-qrs?design=karte" icon={<Download size={20} />} title="Karten-PDF" text="Druckfertige QR-Karten für Tische und Kartenhalter exportieren." external />
          <ActionCard href="/api/pdf/table-qrs?design=sticker" icon={<Download size={20} />} title="Sticker-PDF" text="Kompakte QR-Etiketten mit drei Stickern pro Reihe exportieren." external />
          <ActionCard href="/api/pdf/table-qrs?design=aufsteller" icon={<Download size={20} />} title="Aufsteller-PDF" text="Große QR-Vorlage für Tischaufsteller exportieren." external />
          <ActionCard href="/shop/qr-design" icon={<Settings size={20} />} title="Branding & Designs" text="Farben, Logo, Banner und Texte der mobilen Tischbestellung anpassen." />
          {firstGuestUrl && <ActionCard href={firstGuestUrl} icon={<QrCode size={20} />} title="Gastansicht prüfen" text={`Bestellseite für ${slug || 'deinen Betrieb'} mit einem aktiven Tisch öffnen.`} external />}
        </div>
      )}
    </div>
  );
}

function serviceRequestLabel(type: string) {
  return ({ service: 'Service gerufen', nachbestellen: 'Nachbestellung', rechnung: 'Rechnung', bezahlen: 'Bezahlen', besteck: 'Besteck', problem: 'Problem' } as Record<string, string>)[type] ?? type;
}

function tableStatusLabel(status: string) {
  return ({ frei: 'frei', belegt: 'belegt', reserviert: 'reserviert', reinigung: 'Reinigung', gesperrt: 'gesperrt' } as Record<string, string>)[status] ?? status;
}

function EmptyQueue({ text }: { text: string }) {
  return <div style={{ border: '1px dashed #CBD5E1', borderRadius: 13, background: '#fff', padding: 22, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{text}</div>;
}

function QueueCard({ title, detail, action, onAction }: { title: string; detail: string; action: string; onAction: () => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #E2E8F0', borderRadius: 13, background: '#fff', padding: 14 }}><span style={{ width: 38, height: 38, borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', display: 'grid', placeItems: 'center' }}><Bell size={17} /></span><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{title}</span><span style={{ display: 'block', marginTop: 2, fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span></span><button onClick={onAction} style={primaryButton}>{action}</button></div>;
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
