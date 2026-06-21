'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

type ThemeId = 'classic' | 'aurora' | 'noir' | 'mercato';

const TEMPLATES: { id: ThemeId; name: string; tag: string }[] = [
  { id: 'classic', name: 'Euer Shop', tag: 'Klassisch · vertraut' },
  { id: 'aurora', name: 'Bento', tag: 'Modern · hell' },
  { id: 'noir', name: 'Fresco', tag: 'Italienisch · warm' },
  { id: 'mercato', name: 'Mercato', tag: 'Bold · foodie' },
];

function Thumb({ id }: { id: ThemeId }) {
  if (id === 'classic')
    return (
      <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#0F9C50' }}>
        <div style={{ position: 'absolute', inset: 0, padding: 12 }}>
          <div style={{ height: 28, borderRadius: 7, background: 'rgba(255,255,255,.9)', marginBottom: 8 }} />
          <div style={{ height: 56, borderRadius: 9, background: 'rgba(255,255,255,.25)' }} />
        </div>
      </div>
    );
  if (id === 'aurora')
    return (
      <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#EEF1F6' }}>
        <div style={{ position: 'absolute', inset: 0, padding: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 42, height: 7, borderRadius: 3, background: '#15170F' }} />
            <div style={{ width: 18, height: 18, borderRadius: 6, background: '#C2F03A' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1.3, height: 62, borderRadius: 9, background: '#15170F' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 28, borderRadius: 8, background: '#fff' }} />
              <div style={{ height: 28, borderRadius: 8, background: '#fff' }} />
            </div>
          </div>
        </div>
      </div>
    );
  if (id === 'noir')
    return (
      <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#FBF4E9' }}>
        <div style={{ position: 'absolute', right: -14, top: -10, fontSize: 54, opacity: 0.1 }}>🍅</div>
        <div style={{ position: 'relative', width: 24, height: 3, borderRadius: 3, background: '#C2552F', margin: '13px 0 9px 12px' }} />
        <div style={{ position: 'relative', fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600, color: '#2A211B', lineHeight: 1, paddingLeft: 12 }}>
          Fatto<br />
          <span style={{ fontStyle: 'italic', color: '#C2552F' }}>a mano</span>
        </div>
      </div>
    );
  // mercato
  return (
    <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#FFFCF5' }}>
      <div style={{ position: 'absolute', inset: 0, padding: 10 }}>
        <div style={{ height: 40, borderRadius: 9, background: '#FF5436', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 9px' }}>
          <div style={{ width: 40, height: 14, borderRadius: 999, background: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, height: 48, borderRadius: 9, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍕</div>
          <div style={{ flex: 1, height: 48, borderRadius: 9, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🥗</div>
        </div>
      </div>
    </div>
  );
}

export function ShopDesignClient({
  tenantId,
  name,
  shopUrl,
  current,
}: {
  tenantId: string;
  name: string;
  shopUrl: string;
  current: ThemeId | null;
}) {
  const sb = createClient();
  const [savedTheme, setSavedTheme] = useState<ThemeId>(current ?? 'classic'); // live im Shop
  const [selected, setSelected] = useState<ThemeId>(current ?? 'classic');      // nur ausgewählt (Vorschau)
  const [saving, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const dirty = selected !== savedTheme;
  // Shop-Name editierbar
  const [shopName, setShopName] = useState(name);
  const [storedName, setStoredName] = useState(name);
  const [savingName, setSavingName] = useState(false);
  const nameDirty = shopName.trim().length >= 2 && shopName.trim() !== storedName;
  async function saveName() {
    if (!nameDirty || savingName) return;
    setSavingName(true);
    const { error } = await sb.from('tenants').update({ name: shopName.trim() }).eq('id', tenantId);
    setSavingName(false);
    if (!error) setStoredName(shopName.trim());
  }

  // Speichern: übernimmt das AUSGEWÄHLTE Design erst auf Klick in den Live-Shop
  const save = () => {
    if (!dirty || saving) return;
    setErr(null);
    const id = selected;
    startTransition(async () => {
      const { error } = await sb.from('tenants').update({ storefront_theme_id: id }).eq('id', tenantId);
      if (error) setErr(error.message);
      else { setSavedTheme(id); setSavedAt(Date.now()); }
    });
  };

  const previewUrl = shopUrl ? `${shopUrl}?theme=${selected}` : '';
  const activeName = TEMPLATES.find((t) => t.id === selected)?.name ?? 'Euer Shop';
  const savedName = TEMPLATES.find((t) => t.id === savedTheme)?.name ?? 'Euer Shop';

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Shop-Design wählen</h3>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Design auswählen → Vorschau prüfen → <b style={{ color: '#475569' }}>Speichern</b>. Erst dann wird es im Shop übernommen.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} style={{ height: 42, padding: '0 22px', borderRadius: 11, border: 'none', background: dirty && !saving ? '#4F46E5' : '#E2E8F0', color: dirty && !saving ? '#fff' : '#94A3B8', fontWeight: 700, fontSize: 14, cursor: dirty && !saving ? 'pointer' : 'default', boxShadow: dirty && !saving ? '0 8px 20px rgba(79,70,229,.28)' : 'none' }}>
          {saving ? 'Speichert…' : dirty ? `„${activeName}" speichern` : savedAt ? '✓ Gespeichert' : 'Gespeichert'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {TEMPLATES.map((tpl) => {
          const on = selected === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => setSelected(tpl.id)}
              style={{
                background: '#fff',
                border: on ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                borderRadius: 14,
                padding: 9,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'border-color .15s, box-shadow .15s',
                boxShadow: on ? '0 8px 22px rgba(79,70,229,.16)' : 'none',
              }}
            >
              <Thumb id={tpl.id} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 7px 5px' }}>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>{tpl.name}</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>{tpl.tag}</div>
                </div>
                {savedTheme === tpl.id ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '4px 9px', borderRadius: 999 }}>● Live</span>
                ) : on ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '4px 9px', borderRadius: 999 }}>Ausgewählt</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {err && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Konnte nicht speichern: {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '13px 15px', marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3730A3' }}>Live im Shop: „{savedName}"</div>
              <div style={{ fontSize: 12, color: '#6366F1' }}>{dirty ? `Vorschau zeigt „${activeName}" — oben speichern, um es zu übernehmen` : 'Übernimmt Logo, Farben & Menü deines Shops'}</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 7 }}>Name des Shops</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="z. B. Franky's Pasta" style={{ flex: 1, height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A' }} />
              <button onClick={saveName} disabled={!nameDirty || savingName} style={{ height: 42, padding: '0 16px', borderRadius: 10, border: 'none', background: nameDirty && !savingName ? '#4F46E5' : '#E2E8F0', color: nameDirty && !savingName ? '#fff' : '#94A3B8', fontWeight: 700, fontSize: 13.5, cursor: nameDirty && !savingName ? 'pointer' : 'default' }}>{savingName ? '…' : shopName.trim() === storedName ? '✓' : 'Speichern'}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94A3B8' }}>ℹ Erscheint im Shop-Header. Logo/Hero-Bild unter Shop-Einstellungen, Produktbilder im Menü.</div>
          </div>
        </div>
        <div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 30px rgba(15,23,42,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FB7185' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FBBF24' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#34D399' }} />
              <div style={{ flex: 1, marginLeft: 8, height: 26, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 7, display: 'flex', alignItems: 'center', padding: '0 11px', fontSize: 12, color: '#94A3B8' }}>🔒 Vorschau · {activeName}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '3px 8px', borderRadius: 6 }}>LIVE-VORSCHAU</span>
            </div>
            <div style={{ height: 660, background: 'radial-gradient(120% 120% at 50% 0%,#1E1B4B,#0B1120)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative', width: 374, height: 620, background: '#0b0b0c', borderRadius: 48, padding: 11, boxShadow: '0 36px 70px rgba(0,0,0,.55)' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: '#fff' }}>
                  {previewUrl ? <iframe key={previewUrl} src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Shop-Vorschau" /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
