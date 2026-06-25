'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveResendConfig, testResendConnection } from './email-actions';

type Props = {
  hasKey: boolean;
  fromEmail: string;
  fromName: string;
  verified: boolean;
};

const I = {
  label: { fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' } as const,
  input: { width: '100%', padding: '11px 13px', fontSize: 14, color: '#0F172A', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, outline: 'none', boxSizing: 'border-box' } as const,
  btnPrimary: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const,
  btnGhost: { background: '#fff', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const,
};

export function EmailVersand({ hasKey, fromEmail, fromName, verified }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState(fromEmail ?? '');
  const [name, setName] = useState(fromName ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedMsg, setSavedMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const status = verified
    ? { bg: '#ECFDF5', dot: '#10B981', c: '#047857', label: 'Verbunden & getestet' }
    : hasKey
    ? { bg: '#FFFBEB', dot: '#F59E0B', c: '#B45309', label: 'Konfiguriert — bitte testen' }
    : { bg: '#FEF2F2', dot: '#EF4444', c: '#B91C1C', label: 'Nicht eingerichtet' };

  function save() {
    setSavedMsg(null);
    startSaving(async () => {
      const res = await saveResendConfig({ apiKey: apiKey || null, fromEmail: email, fromName: name });
      if (res.ok) {
        setApiKey('');
        setSavedMsg({ ok: true, text: 'Gespeichert. Sende jetzt eine Test-Mail, um den Versand zu bestätigen.' });
        router.refresh();
      } else {
        setSavedMsg({ ok: false, text: res.error ?? 'Speichern fehlgeschlagen.' });
      }
    });
  }

  async function test() {
    setTestMsg(null);
    setTesting(true);
    const res = await testResendConnection(testTo);
    setTesting(false);
    if (res.ok) {
      setTestMsg({ ok: true, text: 'Test-Mail verschickt! Prüfe das Postfach (auch Spam).' });
      router.refresh();
    } else {
      setTestMsg({ ok: false, text: res.error ?? 'Test fehlgeschlagen.' });
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 700, color: '#0F172A' }}>E-Mail-Versand</h3>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: status.bg, color: status.c, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.dot }} />{status.label}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 18, lineHeight: 1.5 }}>
        Verbinde deinen Resend-Account für Bestellbestätigungen, Liefer-Status- und Bewertungs-E-Mails an deine Kunden.
      </p>

      {!hasKey && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
          <strong>Aktuell werden keine E-Mails verschickt.</strong> Ohne verbundenen Versand erhalten deine Kunden weder Bestätigung noch Lieferstatus.
        </div>
      )}

      <label style={I.label}>Resend API-Key</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? '•••••••••• gespeichert — leer lassen zum Behalten' : 're_xxxxxxxxxxxx'}
          autoComplete="off"
          style={{ ...I.input, flex: 1 }}
        />
        <button type="button" onClick={() => setShowKey((s) => !s)} style={{ ...I.btnGhost, padding: '0 14px' }}>{showKey ? 'Verbergen' : 'Zeigen'}</button>
      </div>
      <p style={{ fontSize: 12, color: '#94A3B8', marginTop: -8, marginBottom: 16 }}>
        Kostenlos erstellen auf <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#4F46E5', fontWeight: 600 }}>resend.com/api-keys ↗</a>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,200px), 1fr))', gap: 14, marginBottom: 18 }}>
        <div>
          <label style={I.label}>Absender-E-Mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bestellung@deinrestaurant.de" autoComplete="off" style={I.input} />
        </div>
        <div>
          <label style={I.label}>Absender-Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Franky's Pasta" autoComplete="off" style={I.input} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...I.btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Speichert…' : 'Speichern'}</button>
        {savedMsg && <span style={{ fontSize: 13, color: savedMsg.ok ? '#047857' : '#B91C1C' }}>{savedMsg.ok ? '✓ ' : '✕ '}{savedMsg.text}</span>}
      </div>

      <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 20, paddingTop: 18 }}>
        <label style={I.label}>Test-E-Mail senden an</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="deine@adresse.de" autoComplete="off" style={{ ...I.input, flex: 1, minWidth: 200 }} />
          <button type="button" onClick={test} disabled={testing || !testTo} style={{ ...I.btnGhost, opacity: testing || !testTo ? 0.6 : 1 }}>{testing ? 'Sendet…' : 'Test senden'}</button>
        </div>
        {testMsg && <p style={{ fontSize: 13, color: testMsg.ok ? '#047857' : '#B91C1C', marginTop: 10 }}>{testMsg.ok ? '✓ ' : '✕ '}{testMsg.text}</p>}
      </div>
    </div>
  );
}
