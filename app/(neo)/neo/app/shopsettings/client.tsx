'use client';
import { toggleShopOnline } from './actions';
export function ShopToggle({ locId, online }: { locId: string; online: boolean }) {
  const click = () => toggleShopOnline(locId, online).catch((e: any) => alert('Fehler: ' + (e?.message || e)));
  return <div onClick={click} style={{ width: 46, height: 26, borderRadius: 999, background: online ? '#4F46E5' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: online ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} /></div>;
}
export function QrButtons({ qr, name }: { qr: string; name: string }) {
  const dl = () => { const a = document.createElement('a'); a.href = qr; a.download = `${name}-shop-qr.png`; a.click(); };
  const pr = () => { const w = window.open(''); if (w) { w.document.write(`<img src="${qr}" style="width:300px" onload="window.print()">`); w.document.close(); } };
  return (<div style={{ display: 'flex', gap: 10 }}><button onClick={dl} style={{ flex: 1, height: 42, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#4F46E5,#4338CA)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Herunterladen</button><button onClick={pr} style={{ flex: 1, height: 42, border: '1.5px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#475569', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Drucken</button></div>);
}
