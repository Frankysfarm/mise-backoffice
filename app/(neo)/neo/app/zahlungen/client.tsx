'use client';
import { toggleZahlung } from './actions';
export function ZahlToggle({ method, on }: { method: string; on: boolean }) {
  const click = () => toggleZahlung(method, on).catch((e: any) => alert('Fehler: ' + (e?.message || e)));
  return <div onClick={click} style={{ width: 46, height: 26, borderRadius: 999, background: on ? '#4F46E5' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} /></div>;
}
