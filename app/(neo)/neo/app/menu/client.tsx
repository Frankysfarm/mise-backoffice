'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createItem, updateItem, toggleItemAvailable, createCategory, applyOptionGroupsToCategory } from '@/app/(admin)/menu/actions';

const PBG = ['#FEF3C7', '#ECFDF5', '#EEF2FF', '#DCFCE7', '#FCE7F3', '#EFF6FF'];
const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

type Cat = { id: string; name: string; aktiv?: boolean; sort_order?: number };
type OptItem = { id: string; name: string; label: string; priceDelta: number; default?: boolean };
type OptGroup = { id: string; name: string; type: 'single' | 'multi'; required: boolean; max?: number; options: OptItem[] };
type Item = { id: string; name: string; beschreibung?: string | null; preis: number; mwst_satz?: number | null; verfuegbar: boolean; beliebt?: boolean; category_id: string | null; sort_order?: number; option_groups?: OptGroup[] | null };

const BTN = (bg: string, color: string): React.CSSProperties => ({ height: 40, padding: '0 16px', border: 'none', borderRadius: 10, background: bg, color, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 });

export function MenuView({ cats, items }: { cats: Cat[]; items: Item[] }) {
  const router = useRouter();
  const [list, setList] = useState<Item[]>(items);
  const [sel, setSel] = useState<string | null>(cats[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; item?: Item }>(null);
  const [catModal, setCatModal] = useState(false);

  const groups = cats.map((c) => ({ ...c, items: list.filter((i) => i.category_id === c.id) }));
  const without = list.filter((i) => !i.category_id || !cats.find((c) => c.id === i.category_id));
  if (without.length) groups.push({ id: '__none__' as any, name: 'Ohne Kategorie', items: without });
  const active = groups.find((g) => g.id === sel) || groups[0];

  async function onToggle(it: Item) {
    setBusy(it.id);
    setList((xs) => xs.map((x) => (x.id === it.id ? { ...x, verfuegbar: !x.verfuegbar } : x)));
    const r = await toggleItemAvailable(it.id, !it.verfuegbar);
    if (!r.ok) { setList((xs) => xs.map((x) => (x.id === it.id ? { ...x, verfuegbar: it.verfuegbar } : x))); alert('Konnte nicht speichern: ' + r.error); }
    setBusy(null);
  }

  return (
    <>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginBottom: 22 }}>
        <a href="/neo/app/menu/import" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: '2px dashed #CBD5E1', borderRadius: 16, padding: '18px 22px', cursor: 'pointer', textDecoration: 'none' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span dangerouslySetInnerHTML={{ __html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>' }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Menü hochladen</div><div style={{ fontSize: 13, color: '#64748B' }}>Excel / CSV / PDF — automatisch erkannt</div></div>
        </a>
        <button onClick={() => setModal({ mode: 'create' })} style={{ ...BTN('linear-gradient(135deg,#4F46E5,#4338CA)', '#fff'), height: 'auto', padding: '0 22px', borderRadius: 16, fontSize: 14.5, boxShadow: '0 8px 20px rgba(79,70,229,.28)' }}>
          <span dangerouslySetInnerHTML={{ __html: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' }} />Artikel anlegen
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Categories */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: '.3px', padding: '8px 10px 10px' }}>KATEGORIEN</div>
          {groups.map((c, i) => { const on = c.id === (active?.id ?? null); return (
            <div key={String(c.id)} onClick={() => setSel(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, marginBottom: 2, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: on ? '#EEF2FF' : 'transparent', color: on ? '#4338CA' : '#475569' }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: PBG[i % PBG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{(c.name || '?').slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1 }}>{c.name}</div><span style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 600 }}>{c.items.length}</span>
            </div>
          ); })}
          <button onClick={() => setCatModal(true)} style={{ width: '100%', marginTop: 8, height: 40, border: '1.5px dashed #CBD5E1', borderRadius: 10, background: 'transparent', color: '#64748B', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Kategorie</button>
        </div>

        {/* Items */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}><h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{active?.name || 'Artikel'}</h3><span style={{ fontSize: 13, color: '#94A3B8' }}>Tippen zum Bearbeiten</span></div>
          {(active?.items ?? []).length === 0 && <div style={{ padding: '28px 22px', color: '#94A3B8', fontSize: 13 }}>Keine Artikel in dieser Kategorie.</div>}
          {(active?.items ?? []).map((it: Item, idx: number) => { const m = it.mwst_satz != null ? Math.round(Number(it.mwst_satz)) : 19; return (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: '1px solid #F8FAFC', opacity: it.verfuegbar ? 1 : 0.55 }}>
              <div style={{ width: 48, height: 48, borderRadius: 11, background: PBG[idx % PBG.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>{(it.name || '?').slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setModal({ mode: 'edit', item: it })}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 14.5, fontWeight: 700, color: '#0F172A' }}>{it.name}</span>{!it.verfuegbar && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 7px', borderRadius: 6 }}>Ausverkauft</span>}</div>
                {it.beschreibung && <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>{it.beschreibung}</div>}
              </div>
              <span style={{ background: m >= 19 ? '#EFF6FF' : '#ECFDF5', color: m >= 19 ? '#1D4ED8' : '#047857', fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 8 }}>{m}% USt</span>
              <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: '#0F172A', width: 70, textAlign: 'right' }}>{eur(it.preis)}</span>
              {/* verfügbar toggle */}
              <button onClick={() => onToggle(it)} disabled={busy === it.id} title={it.verfuegbar ? 'Verfügbar — tippen für ausverkauft' : 'Ausverkauft — tippen für verfügbar'} style={{ width: 46, height: 26, borderRadius: 999, background: it.verfuegbar ? '#10B981' : '#CBD5E1', position: 'relative', transition: 'background .2s', cursor: 'pointer', border: 'none', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: it.verfuegbar ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </button>
              <button onClick={() => setModal({ mode: 'edit', item: it })} style={{ width: 34, height: 34, border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span dangerouslySetInnerHTML={{ __html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>' }} /></button>
            </div>
          ); })}
        </div>
      </div>

      {modal && <ItemModal mode={modal.mode} item={modal.item} cats={cats} defaultCat={sel && sel !== '__none__' ? sel : cats[0]?.id ?? null} onClose={() => setModal(null)} onSaved={() => { setModal(null); router.refresh(); }} />}
      {catModal && <CatModal onClose={() => setCatModal(false)} onSaved={() => { setCatModal(false); router.refresh(); }} />}
    </>
  );
}

function ItemModal({ mode, item, cats, defaultCat, onClose, onSaved }: { mode: 'create' | 'edit'; item?: Item; cats: Cat[]; defaultCat: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [preis, setPreis] = useState(item ? String(item.preis) : '');
  const [catId, setCatId] = useState<string | null>(item?.category_id ?? defaultCat);
  const [mwst, setMwst] = useState<number>(item?.mwst_satz != null ? Math.round(Number(item.mwst_satz)) : 7);
  const [desc, setDesc] = useState(item?.beschreibung ?? '');
  const [groups, setGroups] = useState<OptGroup[]>(Array.isArray(item?.option_groups) ? (item!.option_groups as OptGroup[]) : []);
  const [applyCat, setApplyCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const valid = name.trim().length >= 2 && Number(String(preis).replace(',', '.')) > 0;

  // option_groups bereinigen: nur Gruppen mit Name + ≥1 benannter Option, label=name spiegeln (Shop nutzt label)
  function cleanGroups(): OptGroup[] {
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()).map((o) => ({ ...o, name: o.name.trim(), label: o.name.trim(), priceDelta: Number(o.priceDelta) || 0 })) }))
      .filter((g) => g.name.trim() && g.options.length > 0)
      .map((g) => ({ ...g, name: g.name.trim() }));
  }

  async function save() {
    if (!valid) return; setSaving(true); setErr('');
    const p = Number(String(preis).replace(',', '.'));
    const og = cleanGroups();
    const r = mode === 'create'
      ? await createItem({ category_id: catId, name: name.trim(), preis: p, mwst_satz: mwst, beschreibung: desc.trim() || undefined, food_type: mwst <= 7 ? 'speise' : 'getraenk', option_groups: og })
      : await updateItem(item!.id, { category_id: catId, name: name.trim(), preis: p, mwst_satz: mwst, beschreibung: desc.trim() || null, option_groups: og });
    if (r.ok && applyCat && catId) await applyOptionGroupsToCategory(catId, og).catch(() => {});
    if (r.ok) onSaved(); else { setErr(r.error || 'Fehler'); setSaving(false); }
  }

  const L: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' };
  const I: React.CSSProperties = { width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, color: '#0F172A', marginBottom: 14 };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>{mode === 'create' ? 'Artikel anlegen' : 'Artikel bearbeiten'}</h3>
        <label style={L}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Pizza Margherita" style={I} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={L}>Preis (€)</label><input value={preis} onChange={(e) => setPreis(e.target.value)} placeholder="8,90" inputMode="decimal" style={I} /></div>
          <div><label style={L}>Kategorie</label><select value={catId ?? ''} onChange={(e) => setCatId(e.target.value || null)} style={{ ...I, padding: '0 10px' }}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <label style={L}>Steuersatz</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[7, 19].map((v) => <button key={v} onClick={() => setMwst(v)} style={{ flex: 1, height: 42, borderRadius: 10, border: `1.5px solid ${mwst === v ? '#4F46E5' : '#E2E8F0'}`, background: mwst === v ? '#EEF2FF' : '#fff', color: mwst === v ? '#4338CA' : '#475569', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{v}% {v === 7 ? '(Speise)' : '(Getränk/vor Ort)'}</button>)}
        </div>
        <label style={L}>Beschreibung (optional)</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ ...I, height: 64, padding: '10px 13px', resize: 'none' }} />

        <OptionGroupsEditor groups={groups} setGroups={setGroups} />
        {groups.length > 0 && catId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#475569', fontWeight: 600, margin: '4px 0 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={applyCat} onChange={(e) => setApplyCat(e.target.checked)} style={{ width: 16, height: 16 }} />
            Diese Optionen auf <b>alle Produkte der Kategorie „{cats.find((c) => c.id === catId)?.name}"</b> anwenden
          </label>
        )}

        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={save} disabled={!valid || saving} style={{ flex: 2, height: 44, borderRadius: 10, border: 'none', background: valid && !saving ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: valid && !saving ? 'pointer' : 'not-allowed' }}>{saving ? 'Speichert…' : mode === 'create' ? 'Anlegen' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  );
}

function CatModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    if (name.trim().length < 2) return; setSaving(true); setErr('');
    const r = await createCategory({ name: name.trim() });
    if (r.ok) onSaved(); else { setErr(r.error || 'Fehler'); setSaving(false); }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '100%', background: '#fff', borderRadius: 18, padding: 24 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Kategorie anlegen</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Pizza" autoFocus style={{ width: '100%', height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0 13px', fontSize: 14, marginBottom: 14 }} />
        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={save} disabled={name.trim().length < 2 || saving} style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: name.trim().length >= 2 && !saving ? '#4F46E5' : '#CBD5E1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : 'Anlegen'}</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Optionen / Variationen Editor ===================== */
let _uidc = 0;
function uid(prefix: string) { _uidc += 1; return `${prefix}_${Date.now().toString(36)}_${_uidc}`; }

const OPT_PRESETS: { label: string; group: () => OptGroup }[] = [
  { label: 'Größe', group: () => ({ id: uid('g'), name: 'Größe', type: 'single', required: true, options: [
    { id: uid('o'), name: 'Klein', label: 'Klein', priceDelta: 0, default: true },
    { id: uid('o'), name: 'Mittel', label: 'Mittel', priceDelta: 1 },
    { id: uid('o'), name: 'Groß', label: 'Groß', priceDelta: 2 },
  ] }) },
  { label: 'Extras', group: () => ({ id: uid('g'), name: 'Extras', type: 'multi', required: false, max: 5, options: [
    { id: uid('o'), name: 'Extra Käse', label: 'Extra Käse', priceDelta: 1 },
    { id: uid('o'), name: 'Extra Soße', label: 'Extra Soße', priceDelta: 0.5 },
  ] }) },
  { label: 'Beilage', group: () => ({ id: uid('g'), name: 'Beilage', type: 'single', required: true, options: [
    { id: uid('o'), name: 'Pommes', label: 'Pommes', priceDelta: 0, default: true },
    { id: uid('o'), name: 'Salat', label: 'Salat', priceDelta: 0 },
  ] }) },
];

function OptionGroupsEditor({ groups, setGroups }: { groups: OptGroup[]; setGroups: (g: OptGroup[]) => void }) {
  const upd = (gi: number, patch: Partial<OptGroup>) => setGroups(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updOpt = (gi: number, oi: number, patch: Partial<OptItem>) => setGroups(groups.map((g, i) => i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g));
  const addGroup = () => setGroups([...groups, { id: uid('g'), name: '', type: 'single', required: false, options: [{ id: uid('o'), name: '', label: '', priceDelta: 0 }] }]);
  const SI: React.CSSProperties = { height: 36, border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#0F172A' };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Optionen & Variationen <span style={{ color: '#94A3B8', fontWeight: 500 }}>· z. B. Größe, Extras, Beilage</span></div>
      {groups.map((g, gi) => (
        <div key={g.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 10, background: '#F8FAFC' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input value={g.name} onChange={(e) => upd(gi, { name: e.target.value })} placeholder="Gruppenname (z. B. Größe)" style={{ ...SI, flex: 1 }} />
            <button onClick={() => upd(gi, { type: g.type === 'single' ? 'multi' : 'single' })} title="Auswahltyp" style={{ ...SI, border: 'none', background: '#EEF2FF', color: '#4338CA', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{g.type === 'single' ? '1 wählbar' : 'Mehrere'}</button>
            <button onClick={() => setGroups(groups.filter((_, i) => i !== gi))} title="Gruppe löschen" style={{ width: 36, height: 36, border: '1px solid #FECACA', borderRadius: 8, background: '#fff', color: '#DC2626', cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 9, cursor: 'pointer' }}>
            <input type="checkbox" checked={g.required} onChange={(e) => upd(gi, { required: e.target.checked })} /> Pflichtauswahl
          </label>
          {g.options.map((o, oi) => (
            <div key={o.id} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
              {g.type === 'single' && <input type="radio" checked={!!o.default} onChange={() => upd(gi, { options: g.options.map((x, j) => ({ ...x, default: j === oi })) })} title="Vorausgewählt" />}
              <input value={o.name} onChange={(e) => updOpt(gi, oi, { name: e.target.value })} placeholder="Option (z. B. Groß)" style={{ ...SI, flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>+€</span>
                <input value={String(o.priceDelta)} onChange={(e) => updOpt(gi, oi, { priceDelta: Number(String(e.target.value).replace(',', '.')) || 0 })} inputMode="decimal" style={{ ...SI, width: 64 }} />
              </div>
              <button onClick={() => upd(gi, { options: g.options.filter((_, j) => j !== oi) })} style={{ width: 32, height: 36, border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#94A3B8', cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button onClick={() => upd(gi, { options: [...g.options, { id: uid('o'), name: '', label: '', priceDelta: 0 }] })} style={{ marginTop: 4, height: 32, padding: '0 12px', border: '1px dashed #CBD5E1', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Option</button>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button onClick={addGroup} style={{ height: 34, padding: '0 13px', border: '1.5px solid #4F46E5', borderRadius: 9, background: '#fff', color: '#4338CA', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Optionsgruppe</button>
        {OPT_PRESETS.map((p) => (
          <button key={p.label} onClick={() => setGroups([...groups, p.group()])} style={{ height: 34, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#F8FAFC', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ {p.label}</button>
        ))}
      </div>
    </div>
  );
}
