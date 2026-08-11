'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  QrCode, Plus, Trash2, ExternalLink, Copy, Check, Printer,
  ChevronRight, Tablet, Settings, Layers,
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
};

const BEREICH_COLORS: Record<string, string> = {
  Innen: '#dbeafe',
  Außen: '#dcfce7',
  Bar: '#fef3c7',
  Terrasse: '#f3e8ff',
};

export function TischbestellungClient({
  tables: initialTables,
  tenantId,
  locationId,
  slug,
}: {
  tables: Table[];
  tenantId: string;
  locationId: string;
  slug: string;
}) {
  const supabase = createClient();
  const [tables, setTables] = useState(initialTables);
  const [tab, setTab] = useState<'tische' | 'einstellungen'>('tische');
  const [bereichFilter, setBereichFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newNummer, setNewNummer] = useState('');
  const [newBereich, setNewBereich] = useState('Innen');
  const [tableInputMode, setTableInputMode] = useState<'fixed' | 'manual'>('fixed');
  const [paymentMethods, setPaymentMethods] = useState({ applePay: true, creditCard: true, paypal: true, barzahlung: true });
  const [pending, startTransition] = useTransition();

  const bereiche = Array.from(new Set(tables.map((t) => t.bereich).filter(Boolean))) as string[];
  const filtered = bereichFilter === 'all' ? tables : tables.filter((t) => t.bereich === bereichFilter);

  const qrUrl = (token: string) =>
    slug ? `https://mise-gastro.de/t/${token}` : `https://mise-gastro.de/t/${token}`;

  function copyUrl(token: string) {
    navigator.clipboard.writeText(qrUrl(token));
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function addTable() {
    if (!newNummer.trim()) return;
    startTransition(async () => {
      const { data } = await supabase
        .from('restaurant_tables')
        .insert({
          tenant_id: tenantId,
          location_id: locationId,
          nummer: newNummer.trim(),
          bereich: newBereich,
          aktiv: true,
          sort_order: tables.length + 1,
        })
        .select()
        .single();
      if (data) {
        setTables((arr) => [...arr, data as any]);
        setNewNummer('');
        setAdding(false);
      }
    });
  }

  async function toggleTable(id: string, aktiv: boolean) {
    startTransition(async () => {
      const { data } = await supabase
        .from('restaurant_tables')
        .update({ aktiv })
        .eq('id', id)
        .select()
        .single();
      if (data) setTables((arr) => arr.map((t) => (t.id === id ? (data as any) : t)));
    });
  }

  async function deleteTable(id: string) {
    if (!confirm('Tisch wirklich löschen?')) return;
    startTransition(async () => {
      await supabase.from('restaurant_tables').delete().eq('id', id);
      setTables((arr) => arr.filter((t) => t.id !== id));
    });
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    background: active ? '#173f2b' : 'transparent',
    color: active ? '#fff' : '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        background: '#f8fafc',
        borderRadius: 14,
        padding: 4,
        width: 'fit-content',
      }}>
        <button style={TAB_STYLE(tab === 'tische')} onClick={() => setTab('tische')}>
          <QrCode size={15} /> Tische &amp; QR-Codes
        </button>
        <button style={TAB_STYLE(tab === 'einstellungen')} onClick={() => setTab('einstellungen')}>
          <Settings size={15} /> Einstellungen
        </button>
      </div>

      {tab === 'tische' && (
        <>
          {/* Staff display banner */}
          <a
            href="http://178.104.106.72:8090/staff"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #173f2b, #0d2719)',
              borderRadius: 14,
              padding: '14px 20px',
              marginBottom: 20,
              textDecoration: 'none',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tablet size={20} style={{ color: '#b8d786' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Küchen-Display öffnen</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                  Echtzeit-Bestellübersicht für Mitarbeiter — Bestellungen annehmen und Statusupdates
                </div>
              </div>
            </div>
            <ExternalLink size={16} style={{ color: '#b8d786', flexShrink: 0 }} />
          </a>

          {/* Filter + Add */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', ...bereiche].map((b) => (
                <button
                  key={b}
                  onClick={() => setBereichFilter(b)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 100,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: bereichFilter === b ? 'none' : '1px solid #e2e8f0',
                    background: bereichFilter === b ? '#173f2b' : '#fff',
                    color: bereichFilter === b ? '#fff' : '#64748b',
                  }}
                >
                  {b === 'all' ? 'Alle' : b}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAdding(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: '#173f2b', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700,
              }}
            >
              <Plus size={15} /> Tisch hinzufügen
            </button>
          </div>

          {/* Add form */}
          {adding && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}>
              <input
                placeholder="Tisch-Nr., z.B. 5 oder A3"
                value={newNummer}
                onChange={(e) => setNewNummer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTable()}
                autoFocus
                style={{
                  border: '1px solid #d1fae5', borderRadius: 8,
                  padding: '8px 12px', fontSize: 14, outline: 'none', flex: 1,
                }}
              />
              <select
                value={newBereich}
                onChange={(e) => setNewBereich(e.target.value)}
                style={{
                  border: '1px solid #d1fae5', borderRadius: 8,
                  padding: '8px 12px', fontSize: 14, background: '#fff', cursor: 'pointer',
                }}
              >
                {['Innen', 'Außen', 'Bar', 'Terrasse'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <button
                onClick={addTable}
                disabled={pending}
                style={{
                  padding: '8px 18px', borderRadius: 8, background: '#173f2b',
                  color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                }}
              >
                Anlegen
              </button>
              <button
                onClick={() => setAdding(false)}
                style={{
                  padding: '8px 12px', borderRadius: 8, background: 'transparent',
                  color: '#94a3b8', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 14,
                }}
              >
                Abbrechen
              </button>
            </div>
          )}

          {/* Table grid */}
          {filtered.length === 0 ? (
            <div style={{
              background: '#f8fafc', border: '2px dashed #e2e8f0',
              borderRadius: 16, padding: '48px 24px', textAlign: 'center',
            }}>
              <QrCode size={36} style={{ color: '#cbd5e1', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                Noch keine Tische angelegt
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                Füge deinen ersten Tisch hinzu — jeder bekommt automatisch einen QR-Code.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filtered.map((table) => {
                const bereichColor = BEREICH_COLORS[table.bereich ?? ''] ?? '#f1f5f9';
                return (
                  <div key={table.id} style={{
                    background: '#fff',
                    border: `1px solid ${table.aktiv ? '#e2e8f0' : '#f1f5f9'}`,
                    borderRadius: 16,
                    padding: 16,
                    opacity: table.aktiv ? 1 : 0.55,
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
                          Tisch {table.nummer}
                        </div>
                        {table.name && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{table.name}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {table.bereich && (
                          <span style={{
                            background: bereichColor,
                            color: '#475569',
                            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                          }}>
                            {table.bereich}
                          </span>
                        )}
                        {table.kapazitaet && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{table.kapazitaet} P.</span>
                        )}
                      </div>
                    </div>

                    {/* QR URL preview */}
                    <div style={{
                      background: '#f8fafc', borderRadius: 8,
                      padding: '7px 10px', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <QrCode size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <div style={{
                        fontSize: 11, color: '#64748b', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {qrUrl(table.qr_token)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => copyUrl(table.qr_token)}
                        title="Link kopieren"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          padding: '7px', borderRadius: 8, border: '1px solid #e2e8f0',
                          background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569',
                        }}
                      >
                        {copiedId === table.qr_token ? <Check size={13} style={{ color: '#16a34a' }} /> : <Copy size={13} />}
                        {copiedId === table.qr_token ? 'Kopiert' : 'Link'}
                      </button>
                      <a
                        href={qrUrl(table.qr_token)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          padding: '7px', borderRadius: 8, border: '1px solid #e2e8f0',
                          background: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: '#475569',
                        }}
                      >
                        <ExternalLink size={13} /> Vorschau
                      </a>
                      <button
                        onClick={() => toggleTable(table.id, !table.aktiv)}
                        title={table.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        style={{
                          padding: '7px 10px', borderRadius: 8,
                          border: `1px solid ${table.aktiv ? '#d1fae5' : '#e2e8f0'}`,
                          background: table.aktiv ? '#f0fdf4' : '#f8fafc',
                          color: table.aktiv ? '#16a34a' : '#94a3b8',
                          cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        }}
                      >
                        {table.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </button>
                      <button
                        onClick={() => deleteTable(table.id)}
                        title="Tisch löschen"
                        style={{
                          padding: '7px 10px', borderRadius: 8,
                          border: '1px solid #fee2e2', background: '#fff5f5',
                          color: '#ef4444', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'einstellungen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Settings Panel: Tisch-Eingabe & Zahlungsarten */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Tisch-Modus */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', marginBottom: 4 }}>Tisch-Zuweisung</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Sollen Gäste ihren Tisch selbst eingeben oder ist der QR-Code fest an einen Tisch gebunden?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setTableInputMode('fixed')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    border: tableInputMode === 'fixed' ? '2px solid #173f2b' : '1px solid #e2e8f0',
                    background: tableInputMode === 'fixed' ? '#f0fdf4' : '#f8fafc',
                    color: tableInputMode === 'fixed' ? '#173f2b' : '#64748b',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  📍 Fester QR pro Tisch
                </button>
                <button
                  onClick={() => setTableInputMode('manual')}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12,
                    border: tableInputMode === 'manual' ? '2px solid #173f2b' : '1px solid #e2e8f0',
                    background: tableInputMode === 'manual' ? '#f0fdf4' : '#f8fafc',
                    color: tableInputMode === 'manual' ? '#173f2b' : '#64748b',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  ✍️ Gast gibt Tisch ein
                </button>
              </div>
            </div>

            {/* Zahlungsmethoden */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', marginBottom: 4 }}>Zahlungsmethoden</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Welche Bezahlarten sind in der App erlaubt?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'applePay', label: 'Apple Pay' },
                  { key: 'creditCard', label: 'Kreditkarte' },
                  { key: 'paypal', label: 'PayPal' },
                  { key: 'barzahlung', label: 'Am Platz bar zahlen' }
                ].map(pm => (
                  <label key={pm.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: paymentMethods[pm.key as keyof typeof paymentMethods] ? '#1e293b' : '#94a3b8' }}>
                    <input
                      type="checkbox"
                      checked={paymentMethods[pm.key as keyof typeof paymentMethods]}
                      onChange={(e) => setPaymentMethods({...paymentMethods, [pm.key]: e.target.checked})}
                      style={{ accentColor: '#173f2b', width: 18, height: 18 }}
                    />
                    {pm.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              Bestellseite (Kundensicht)
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Die Gäste sehen diese Seite, wenn sie einen QR-Code am Tisch scannen.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href="http://178.104.106.72:8090/order"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  background: '#173f2b', color: '#fff',
                  textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
                }}
              >
                <ExternalLink size={14} /> Bestellseite öffnen
              </a>
              <a
                href="/menu"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  background: '#f8fafc', color: '#475569',
                  textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
                  border: '1px solid #e2e8f0',
                }}
              >
                <Layers size={14} /> Speisekarte bearbeiten
              </a>
            </div>
          </div>

          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              Küchen-Display (Mitarbeiter)
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Zeigt eingehende Bestellungen in Echtzeit. Am besten auf einem Tablet in der Küche öffnen.
            </div>
            <a
              href="http://178.104.106.72:8090/staff"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: '#173f2b', color: '#fff',
                textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
              }}
            >
              <Tablet size={14} /> Display öffnen
            </a>
          </div>

          <div style={{
            background: '#fffbeb', borderRadius: 16, border: '1px solid #fde68a',
            padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>💡</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                So funktioniert das System
              </div>
              <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                1. Tische anlegen → jeder bekommt automatisch einen QR-Code<br />
                2. QR-Code ausdrucken oder als Link teilen<br />
                3. Gäste scannen, bestellen direkt im Browser<br />
                4. Mitarbeiter sehen Bestellungen live im Küchen-Display<br />
                5. Status aktualisieren: Neu → In Zubereitung → Fertig → Abgeholt
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
