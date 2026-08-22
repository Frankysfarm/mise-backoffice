'use client';
import { useRouter, useSearchParams } from 'next/navigation';

const PERIODS: { key: string; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: '7d', label: '7 Tage' },
  { key: '30d', label: '30 Tage' },
  { key: '90d', label: '90 Tage' },
];
const TYPES: { key: string; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'lieferung', label: 'Lieferung' },
  { key: 'abholung', label: 'Abholung' },
];

export function FilterBar({ period, typ }: { period: string; typ: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(k, v);
    router.push(`/neo/app/uebersicht?${p.toString()}`);
  };
  const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button onClick={onClick} style={{ height: 36, padding: '0 15px', borderRadius: 999, border: `1.5px solid ${on ? '#4F46E5' : '#E2E8F0'}`, background: on ? '#4F46E5' : '#fff', color: on ? '#fff' : '#475569', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
      <div style={{ display: 'flex', gap: 8 }}>{PERIODS.map((p) => <Chip key={p.key} on={period === p.key} label={p.label} onClick={() => setParam('period', p.key)} />)}</div>
      <div style={{ width: 1, height: 26, background: '#E2E8F0' }} />
      <div style={{ display: 'flex', gap: 8 }}>{TYPES.map((tp) => <Chip key={tp.key} on={typ === tp.key} label={tp.label} onClick={() => setParam('typ', tp.key)} />)}</div>
    </div>
  );
}
