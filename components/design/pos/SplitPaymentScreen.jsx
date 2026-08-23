'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Banknote, CreditCard, Loader, RefreshCw, SplitSquareVertical, Users, X } from 'lucide-react';

const C = {
  surface: '#171614', surfaceHi: '#1F1D1A', border: '#3A3631', text: '#F2EDE3',
  mute: '#9A9186', action: '#E68A2C', ok: '#9CB05F', error: '#D45B47',
};

const euro = (cents) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR',
}).format((Number(cents) || 0) / 100);

export default function SplitPaymentScreen({
  flow,
  setFlow,
  onBegin,
  onCash,
  onCreateProvider,
  onConfirmProvider,
}) {
  const [split, setSplit] = useState(null);
  const [mode, setMode] = useState('amount');
  const [amount, setAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [seat, setSeat] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Split-Vorgang wird sicher angelegt…');
  const [error, setError] = useState('');
  const [pendingProvider, setPendingProvider] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onBegin(flow).then((next) => {
      if (next.completed) {
        setFlow({
          ...flow,
          stage: 'success',
          method: 'Split',
          transactionId: next.transactionId,
          orderNumber: next.orderNumber,
          bonToken: next.bonToken,
          tseActive: next.tseActive,
          splitPayments: next.payments,
        });
        return;
      }
      setSplit(next);
      setAmount((next.remainingCents / 100).toFixed(2).replace('.', ','));
      setCashReceived((next.remainingCents / 100).toFixed(2).replace('.', ','));
      setStatus('ready');
      setMessage('');
    }).catch((cause) => {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Split-Vorgang konnte nicht geladen werden');
    });
  }, [flow, onBegin, setFlow]);

  const seats = useMemo(() => [...new Set((split?.lineItems ?? [])
    .map((item) => item.seat).filter((value) => Number.isInteger(value)))].sort((a, b) => a - b), [split]);
  const selectionCents = useMemo(() => {
    if (!split) return 0;
    if (mode === 'items') {
      return split.lineItems.filter((item) => selectedItems.includes(item.id))
        .reduce((sum, item) => sum + Number(item.remainingCents ?? item.totalCents), 0);
    }
    if (mode === 'seat') {
      return split.lineItems.filter((item) => item.seat === seat)
        .reduce((sum, item) => sum + Number(item.remainingCents ?? item.totalCents), 0);
    }
    const normalized = String(amount).trim().replace(',', '.');
    if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return 0;
    return Math.round(Number(normalized) * 100);
  }, [amount, mode, seat, selectedItems, split]);

  useEffect(() => {
    if (selectionCents > 0) setCashReceived((selectionCents / 100).toFixed(2).replace('.', ','));
  }, [selectionCents]);

  const scope = () => {
    if (mode === 'items') return { mode, itemIds: selectedItems };
    if (mode === 'seat') return { mode, seat };
    return { mode, amountCents: selectionCents };
  };

  const applyResult = (next, method) => {
    setPendingProvider(null);
    setSplit(next);
    setSelectedItems([]);
    setSeat(null);
    setAmount((next.remainingCents / 100).toFixed(2).replace('.', ','));
    setCashReceived((next.remainingCents / 100).toFixed(2).replace('.', ','));
    if (next.completed) {
      setFlow({
        ...flow,
        stage: 'success',
        method: 'Split',
        transactionId: next.transactionId,
        orderNumber: next.orderNumber,
        bonToken: next.bonToken,
        tseActive: next.tseActive,
        splitPayments: next.payments,
      });
      return;
    }
    setStatus('ready');
    setMessage(`${method} verbucht · ${euro(next.remainingCents)} offen`);
  };

  const payCash = async () => {
    const received = Math.round(Number(String(cashReceived).replace(',', '.')) * 100);
    if (!selectionCents || selectionCents > split.remainingCents || !Number.isInteger(received) || received < selectionCents) {
      setError('Teilbetrag und erhaltenen Barbetrag prüfen');
      return;
    }
    setStatus('paying');
    setMessage('Bar-Teilzahlung wird atomar verbucht…');
    setError('');
    try {
      const next = await onCash({
        splitSessionId: split.splitSessionId,
        scope: scope(),
        cashReceivedCents: received,
        idempotencyKey: crypto.randomUUID(),
      });
      applyResult(next, 'Bar');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Bar-Teilzahlung fehlgeschlagen');
    }
  };

  const payProvider = async (provider, retry = null) => {
    const selectedScope = retry?.scope ?? scope();
    const selectedCents = retry?.amountCents ?? selectionCents;
    if (!selectedCents || selectedCents > split.remainingCents) {
      setError('Gültigen Teilbetrag auswählen');
      return;
    }
    const pending = retry ?? {
      provider,
      splitSessionId: split.splitSessionId,
      scope: selectedScope,
      amountCents: selectedCents,
      idempotencyKey: crypto.randomUUID(),
      paymentAttemptId: null,
    };
    setPendingProvider(pending);
    setStatus('paying');
    setMessage(pending.paymentAttemptId
      ? 'Provider-Zahlungsstatus wird erneut geprüft…'
      : provider === 'sumup' ? 'SumUp-Checkout wird erstellt…' : 'Stripe-Checkout wird erstellt…');
    setError('');
    let definitiveFailure = false;
    try {
      let paymentAttemptId = pending.paymentAttemptId;
      if (!paymentAttemptId) {
        const created = await onCreateProvider({
          provider,
          splitSessionId: pending.splitSessionId,
          scope: pending.scope,
          idempotencyKey: pending.idempotencyKey,
        });
        paymentAttemptId = created.paymentAttemptId;
        setPendingProvider({ ...pending, paymentAttemptId });
        if (created.checkoutUrl) {
          window.open(created.checkoutUrl, '_blank', 'noopener,noreferrer');
          setMessage('Stripe-Zahlung im geöffneten Fenster abschließen…');
        } else {
          setMessage('Bitte Karte am SumUp-Terminal vorhalten…');
        }
      }
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const result = await onConfirmProvider({ paymentAttemptId });
        if (result.status === 'confirmed') {
          setPendingProvider(null);
          applyResult(result.split, provider === 'sumup' ? 'SumUp' : 'Stripe');
          return;
        }
        if (result.status === 'failed') {
          definitiveFailure = true;
          setPendingProvider(null);
          throw new Error(result.error || 'Providerzahlung fehlgeschlagen');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error('Zeitüberschreitung bei der Providerzahlung');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Provider-Teilzahlung fehlgeschlagen');
      if (definitiveFailure) setMessage('Provider-Zahlung wurde nicht verbucht');
    }
  };

  if (!split) {
    return (
      <div style={{ padding: 32, color: C.text, textAlign: 'center' }}>
        {status === 'loading' ? <Loader aria-label="Split wird geladen" size={42} style={{ color: C.action, animation: 'miseSpin 1.2s linear infinite' }} /> : <X size={42} style={{ color: C.error }} />}
        <h2 style={{ margin: '16px 0 8px' }}>{status === 'loading' ? message : 'Split-Payment nicht verfügbar'}</h2>
        {error && <div role="alert" style={{ color: C.error, marginBottom: 16 }}>{error}</div>}
        <button onClick={() => setFlow({ ...flow, stage: 'select-method' })} style={button(false)}>
          <ArrowLeft size={16} /> Zurück
        </button>
      </div>
    );
  }

  const busy = status === 'paying';
  return (
    <div style={{ padding: 24, color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button aria-label="Zurück zur Zahlart" onClick={() => setFlow({ ...flow, stage: 'select-method' })} disabled={busy} style={iconButton}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: C.action, fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Split-Payment</div>
          <div style={{ fontSize: 13, color: C.mute }}>{flow.context === 'table' ? `Tisch ${flow.tableLabel}` : 'Counter-Verkauf'}</div>
        </div>
        <button aria-label="Split schließen" onClick={() => setFlow(null)} disabled={busy} style={iconButton}><X size={18} /></button>
      </div>

      <div aria-live="polite" style={{ margin: '18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Summary label="Gesamt" value={euro(split.totalCents)} />
        <Summary label="Noch offen" value={euro(split.remainingCents)} accent />
      </div>

      {(split.payments ?? []).length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surfaceHi }}>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 8, textTransform: 'uppercase' }}>Teilzahlungen</div>
          {split.payments.map((payment) => (
            <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span>{payment.method === 'bar' ? 'Bar' : payment.method === 'sumup' ? 'SumUp' : 'Stripe'}</span>
              <strong>{euro(payment.amountCents)}</strong>
            </div>
          ))}
        </div>
      )}

      <div role="tablist" aria-label="Split-Art" style={{ display: 'grid', gridTemplateColumns: seats.length ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 6, marginBottom: 14 }}>
        <ModeButton active={mode === 'amount'} onClick={() => setMode('amount')} label="Betrag" />
        <ModeButton active={mode === 'items'} onClick={() => setMode('items')} label="Positionen" />
        {seats.length > 0 && <ModeButton active={mode === 'seat'} onClick={() => setMode('seat')} label="Sitz / Gast" />}
      </div>

      {mode === 'amount' && (
        <label style={labelStyle}>
          Freier Teilbetrag
          <input
            aria-label="Freier Teilbetrag"
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !busy) payCash(); }}
            style={inputStyle}
          />
        </label>
      )}

      {mode === 'items' && (
        <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 12 }}>
          {split.lineItems.filter((item) => Number(item.remainingCents ?? item.totalCents) > 0).map((item) => {
            const selected = selectedItems.includes(item.id);
            return (
              <button
                key={item.id}
                aria-pressed={selected}
                onClick={() => setSelectedItems((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id])}
                style={{ ...button(selected), justifyContent: 'space-between' }}
              >
                <span>{item.quantity}× {item.name}{item.seat ? ` · Sitz ${item.seat}` : ''}</span>
                <strong>{euro(item.remainingCents ?? item.totalCents)}</strong>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'seat' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
          {seats.map((number) => (
            <button key={number} aria-pressed={seat === number} onClick={() => setSeat(number)} style={button(seat === number)}>
              <Users size={16} /> {number}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 12, margin: '12px 0', borderRadius: 10, background: C.surfaceHi, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: C.mute }}>Jetzt kassieren</span>
        <strong>{euro(selectionCents)}</strong>
      </div>

      <label style={labelStyle}>
        Bar erhalten
        <input aria-label="Bar erhalten" value={cashReceived} inputMode="decimal" onChange={(event) => setCashReceived(event.target.value)} style={inputStyle} />
      </label>

      {message && <div aria-live="polite" style={{ color: status === 'paying' ? C.action : C.ok, fontSize: 13, marginBottom: 10 }}>{message}</div>}
      {error && <div role="alert" style={{ color: C.error, background: 'rgba(184,74,58,.15)', padding: 10, borderRadius: 8, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <button disabled={busy || selectionCents <= 0 || Boolean(pendingProvider)} onClick={payCash} style={button(false)}><Banknote size={17} /> Bar</button>
        <button disabled={busy || selectionCents <= 0 || Boolean(pendingProvider)} onClick={() => payProvider('sumup')} style={button(true)}><CreditCard size={17} /> SumUp</button>
        <button disabled={busy || selectionCents <= 0 || Boolean(pendingProvider)} onClick={() => payProvider('stripe')} style={button(false)}><CreditCard size={17} /> Stripe</button>
      </div>

      {busy && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.action, marginTop: 14 }}><Loader size={17} style={{ animation: 'miseSpin 1.2s linear infinite' }} /> Bitte nicht doppelt tippen</div>}
      {status === 'error' && <button onClick={() => pendingProvider ? payProvider(pendingProvider.provider, pendingProvider) : (setStatus('ready'), setError(''))} style={{ ...button(false), width: '100%', marginTop: 10 }}><RefreshCw size={16} /> {pendingProvider ? 'Zahlungsstatus erneut prüfen' : 'Erneut versuchen'}</button>}
    </div>
  );
}

function Summary({ label, value, accent = false }) {
  return (
    <div style={{ background: C.surfaceHi, border: `1px solid ${accent ? C.action : C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ color: C.mute, fontSize: 11, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: accent ? C.action : C.text, fontSize: 24, fontWeight: 800, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function ModeButton({ active, onClick, label }) {
  return <button role="tab" aria-selected={active} onClick={onClick} style={button(active)}><SplitSquareVertical size={15} /> {label}</button>;
}

const iconButton = {
  minWidth: 44, minHeight: 44, borderRadius: 9, border: `1px solid ${C.border}`,
  background: C.surfaceHi, color: C.text, display: 'grid', placeItems: 'center', cursor: 'pointer',
};

const labelStyle = { display: 'grid', gap: 6, color: C.mute, fontSize: 12, marginBottom: 12 };

const inputStyle = {
  minHeight: 48, borderRadius: 9, border: `1px solid ${C.border}`, background: C.surfaceHi,
  color: C.text, padding: '0 14px', fontSize: 20, fontWeight: 700, outline: 'none',
};

function button(active) {
  return {
    minHeight: 48, padding: '10px 12px', borderRadius: 9,
    border: `1px solid ${active ? C.action : C.border}`,
    background: active ? C.action : C.surfaceHi,
    color: active ? '#0A0908' : C.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontWeight: 700, cursor: 'pointer',
  };
}
