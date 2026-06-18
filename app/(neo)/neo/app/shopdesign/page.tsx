import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { Soon } from '../_soon';
export const dynamic = 'force-dynamic';
export default async function ShopDesign() {
  const emp = await getCurrentEmployee();
  const sb = createServiceClient();
  const { data: t } = await sb.from('tenants').select('name, slug').eq('id', emp?.tenant_id ?? '').maybeSingle();
  const shopUrl = t?.slug ? `https://mise-gastro.de/biss-app/${t.slug}` : '';
  const name = t?.name || 'Mein Shop';
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Shop-Design wählen</h3><p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Vier Templates — alle übernehmen automatisch Logo, Farben & Menü.</p></div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', background: '#fff', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: 999 }}>4 Templates</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {/* aktuell = aktiv */}
        <div style={{ background: '#fff', border: '2px solid #4F46E5', borderRadius: 14, padding: 9 }}>
          <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#0F9C50' }}><div style={{ position: 'absolute', inset: 0, padding: 12 }}><div style={{ height: 28, borderRadius: 7, background: 'rgba(255,255,255,.9)', marginBottom: 8 }} /><div style={{ height: 56, borderRadius: 9, background: 'rgba(255,255,255,.25)' }} /></div></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 7px 5px' }}><div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>Euer Shop</div><div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>Aktuelles Design</div></div><span style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', background: '#EEF2FF', padding: '4px 9px', borderRadius: 999 }}>Aktiv</span></div>
        </div>
        {/* Bento */}
        <Soon style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 9, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#EEF1F6' }}><div style={{ position: 'absolute', inset: 0, padding: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><div style={{ width: 42, height: 7, borderRadius: 3, background: '#0B1020' }} /><div style={{ width: 18, height: 18, borderRadius: 6, background: '#fff' }} /></div><div style={{ display: 'flex', gap: 6 }}><div style={{ flex: 1.3, height: 62, borderRadius: 9, background: 'linear-gradient(150deg,#4F46E5,#7C3AED)' }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ height: 28, borderRadius: 8, background: '#fff' }} /><div style={{ height: 28, borderRadius: 8, background: '#fff' }} /></div></div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 7px 5px' }}><div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>Bento</div><div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>Modern · hell</div></div><span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 999 }}>Bald</span></div>
        </Soon>
        {/* Fresco */}
        <Soon style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 9, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#FBF4E9' }}><div style={{ position: 'absolute', right: -14, top: -10, fontSize: 54, opacity: .1 }}>🍅</div><div style={{ position: 'relative', width: 24, height: 3, borderRadius: 3, background: '#C2552F', margin: '13px 0 9px 12px' }} /><div style={{ position: 'relative', fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600, color: '#2A211B', lineHeight: 1, paddingLeft: 12 }}>Fatto<br /><span style={{ fontStyle: 'italic', color: '#C2552F' }}>a mano</span></div></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 7px 5px' }}><div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>Fresco</div><div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>Italienisch · warm</div></div><span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 999 }}>Bald</span></div>
        </Soon>
        {/* Mercato */}
        <Soon style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 9, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div style={{ height: 120, borderRadius: 9, overflow: 'hidden', position: 'relative', background: '#FFFCF5' }}><div style={{ position: 'absolute', inset: 0, padding: 10 }}><div style={{ height: 40, borderRadius: 9, background: '#FF5436', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 9px' }}><div style={{ width: 40, height: 14, borderRadius: 999, background: '#fff' }} /></div><div style={{ display: 'flex', gap: 6 }}><div style={{ flex: 1, height: 48, borderRadius: 9, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍕</div><div style={{ flex: 1, height: 48, borderRadius: 9, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🥗</div></div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 7px 5px' }}><div><div style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>Mercato</div><div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>Bold · foodie</div></div><span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 8px', borderRadius: 999 }}>Bald</span></div>
        </Soon>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '13px 15px', marginBottom: 18 }}><span style={{ fontSize: 18 }}>⭐</span><div><div style={{ fontSize: 13.5, fontWeight: 700, color: '#3730A3' }}>Template „Euer Shop" aktiv</div><div style={{ fontSize: 12, color: '#6366F1' }}>Aktuelles Design · übernimmt deine Markendaten</div></div></div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: 6, gap: 4, borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              {['Inhalt', 'Bestseller', 'Upsell', 'Cross-Sale'].map((tab, i) => i === 0 ? <div key={tab} style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '8px 4px', borderRadius: 9, background: '#fff', color: '#4338CA', boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>{tab}</div> : <Soon key={tab} style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '8px 4px', borderRadius: 9, background: 'transparent', color: '#94A3B8', border: 'none', cursor: 'pointer' }}>{tab}</Soon>)}
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>Name des Shops</div>
              <input defaultValue={name} style={{ width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A', marginBottom: 16 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 7 }}>Untertitel / Slogan</div>
              <textarea placeholder="z. B. Frische Pasta, täglich gemacht" style={{ width: '100%', height: 62, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 13px', fontSize: 14, color: '#0F172A', resize: 'none', marginBottom: 16 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 9 }}>Logo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, border: '2px dashed #CBD5E1', borderRadius: 13, padding: 13 }}><div style={{ width: 46, height: 46, borderRadius: 11, background: 'linear-gradient(135deg,#4F46E5,#312E81)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{name.slice(0, 2).toUpperCase()}</div><div style={{ fontSize: 13, color: '#64748B' }}>PNG, JPG oder SVG · <span style={{ color: '#4F46E5', fontWeight: 600 }}>ändern (bald)</span></div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: '#94A3B8' }}>ℹ Speichern von Texten/Logo: bald verfügbar. Produktbilder pflegst du im Menü.</div>
            </div>
          </div>
        </div>
        <div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 30px rgba(15,23,42,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FB7185' }} /><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FBBF24' }} /><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#34D399' }} />
              <div style={{ flex: 1, marginLeft: 8, height: 26, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 7, display: 'flex', alignItems: 'center', padding: '0 11px', fontSize: 12, color: '#94A3B8' }}>🔒 {t?.slug ? `${t.slug}.mise-gastro.de` : 'mise-gastro.de'}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '3px 8px', borderRadius: 6 }}>LIVE-VORSCHAU</span>
            </div>
            <div style={{ height: 660, background: 'radial-gradient(120% 120% at 50% 0%,#1E1B4B,#0B1120)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative', width: 374, height: 620, background: '#0b0b0c', borderRadius: 48, padding: 11, boxShadow: '0 36px 70px rgba(0,0,0,.55)' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', background: '#fff' }}>{shopUrl ? <iframe src={shopUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Shop-Vorschau" /> : null}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
