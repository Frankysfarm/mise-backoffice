'use client';
import { useState } from 'react';
import { toggleZahlung } from './actions';

export function ZahlToggle({ method, on }: { method: string; on: boolean }) {
  const click = () => toggleZahlung(method, on).catch((e: any) => alert('Fehler: ' + (e?.message || e)));
  return <div onClick={click} style={{ width: 46, height: 26, borderRadius: 999, background: on ? '#4F46E5' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}><div style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s' }} /></div>;
}

// Rechte Steuerung für die Online-Zahlung (Stripe): je nach Verbindungsstatus
// Aktivieren-Button (öffnet Stripe-Onboarding) ODER Toggle + „Verbunden".
export function StripeControl({ on, chargesEnabled, accountExists }: { on: boolean; chargesEnabled: boolean; accountExists: boolean }) {
  const [busy, setBusy] = useState(false);
  const startOnboarding = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Konnte Stripe nicht öffnen');
      window.location.href = data.url; // → Stripe KYC, kommt zurück nach /neo/app/zahlungen
    } catch (e: any) {
      alert('Fehler: ' + (e?.message || e));
      setBusy(false);
    }
  };

  if (chargesEnabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', background: '#ECFDF5', padding: '4px 9px', borderRadius: 999 }}>● Verbunden</span>
        <ZahlToggle method="stripe" on={on} />
      </div>
    );
  }
  return (
    <button onClick={startOnboarding} disabled={busy} style={{ flexShrink: 0, height: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: busy ? '#C7D2FE' : '#635BFF', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
      {busy ? 'Öffne Stripe…' : accountExists ? 'Onboarding fortsetzen' : 'Mit Stripe aktivieren'}
    </button>
  );
}

export function StripeStatusBanner({ status }: { status: 'done' | 'error' | null }) {
  if (!status) return null;
  if (status === 'done')
    return <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>✓ Stripe-Verbindung aktualisiert. Sobald Stripe deine Daten freigegeben hat, ist die Online-Zahlung aktiv.</div>;
  return <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>Stripe-Verbindung konnte nicht abgeschlossen werden. Bitte erneut versuchen.</div>;
}
