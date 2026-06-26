'use client';

import { useMemo, useState } from 'react';

const ghost = { display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 15px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#334155', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' } as const;

/** Monatsauswahl + Steuerberater-Downloads. Wählt den Export-Zeitraum (default: laufender Monat). */
export function ExportBar() {
  // Liste der letzten 12 Monate (YYYY-MM + deutsches Label)
  const months = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (i === 0) label += ' (laufend)';
      out.push({ value, label });
    }
    return out;
  }, []);

  const [monat, setMonat] = useState(months[0].value);
  const base = `/api/buchhaltung/export?monat=${monat}`;

  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 600 }}>Export-Monat</span>
        <select
          value={monat}
          onChange={(e) => setMonat(e.target.value)}
          style={{ height: 42, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
        >
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <a href={`${base}&format=zip`} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 10, background: '#4F46E5', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>📦 Steuerberater-Paket (ZIP)</a>
      <a href={`${base}&format=belege-csv`} style={ghost}>Belege (CSV)</a>
      <a href={`${base}&format=bank-csv`} style={ghost}>Bank (CSV)</a>
    </div>
  );
}
