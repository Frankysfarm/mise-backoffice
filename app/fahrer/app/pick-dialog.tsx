'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Btn, Icon as DIcon, Progress, Spinner as DSpinner, SAFE_TOP, SAFE_BOTTOM } from './drive-ui';

type Item = {
  id: string;
  name: string;
  menge: number;
  notiz: string | null;
  pick_confirmed_at: string | null;
  pick_missing: boolean | null;
};

/* Gericht-Thumbnail (Drive 05-pick.png): graue Kachel mit Box-Icon. */
function ProductThumb({ size = 54 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        flexShrink: 0,
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 0 1px var(--line)',
      }}
    >
      <DIcon name="box" size={size * 0.5} stroke={1.6} style={{ color: 'var(--ink-3)' }} />
    </div>
  );
}

export function PickDialog({
  orderBestellnummer,
  items,
  batchId,
  onClose,
  onComplete,
}: {
  orderBestellnummer: string;
  items: Item[];
  batchId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const supabase = createClient();
  const [pending, setPending] = useState<string | null>(null);
  const [local, setLocal] = useState(items);
  const [openId, setOpenId] = useState<string | null>(null);

  const confirmed = local.filter((i) => i.pick_confirmed_at).length;
  const totalItems = local.length;
  const allDone = confirmed === totalItems && totalItems > 0;
  const pct = totalItems > 0 ? Math.round((confirmed / totalItems) * 100) : 0;

  async function confirm(id: string, missing = false) {
    setPending(id);
    const { error } = await supabase.rpc('confirm_pick_item', {
      p_order_item_id: id,
      p_missing: missing,
      p_note: missing ? 'Fahrer meldet: Item fehlt' : null,
    });
    setPending(null);
    if (error) { alert(error.message); return; }
    setLocal((xs) => xs.map((x) => x.id === id
      ? { ...x, pick_confirmed_at: new Date().toISOString(), pick_missing: missing }
      : x));
    setOpenId(null);
  }

  async function complete() {
    setPending('complete');
    const { data, error } = await supabase.rpc('confirm_pickup_complete', { p_batch_id: batchId });
    setPending(null);
    if (error || !(data as any)?.ok) {
      alert(error?.message ?? (data as any)?.error ?? 'Fehler');
      return;
    }
    onComplete();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'var(--bg)',
        color: 'var(--ink)',
        paddingTop: SAFE_TOP,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — Drive (#code + Zurueck) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 12px', flexShrink: 0 }}>
        <button
          type="button"
          aria-label="zurück"
          className="press"
          onClick={onClose}
          style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface)', color: 'var(--ink)',
            boxShadow: '0 1px 3px rgba(0,0,0,.08), inset 0 0 0 1px var(--line)',
          }}
        >
          <DIcon name="back" size={22} stroke={2.1} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            #{orderBestellnummer.replace(/^[A-Z]+-?/, '')}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>
            Gerichte kontrollieren
          </div>
        </div>
      </div>

      {/* Fortschritts-Karte mit grossem mono-% */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--surface)', borderRadius: 16, padding: '13px 16px',
            boxShadow: 'inset 0 0 0 1px var(--line)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{confirmed} von {totalItems} kontrolliert</div>
            <div style={{ marginTop: 7 }}>
              <Progress value={confirmed} max={totalItems} height={8} />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: allDone ? 'var(--accent)' : 'var(--ink)' }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Gericht-Liste */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 16px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 4px 10px' }}>
          Tippe ein Gericht zum Kontrollieren
        </div>
        {local.map((item) => {
          const done = !!item.pick_confirmed_at;
          const missing = !!item.pick_missing;
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              style={{
                marginBottom: 10,
                borderRadius: 18,
                background: done
                  ? (missing ? 'var(--danger-tint)' : 'var(--accent-tint)')
                  : 'var(--surface)',
                boxShadow: done ? 'none' : '0 2px 8px -6px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)',
                transition: 'background .2s ease',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                className="tap"
                onClick={() => !done && setOpenId(isOpen ? null : item.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, padding: 12,
                  background: 'transparent',
                }}
              >
                <ProductThumb />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: missing ? 'var(--danger)' : 'var(--accent)', marginTop: 1, flexShrink: 0 }}>
                      {item.menge}×
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15.5, flex: 1, minWidth: 0, lineHeight: 1.25 }}>{item.name}</span>
                  </div>
                  {item.notiz && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-tint)', padding: '3px 8px', borderRadius: 7 }}>
                      <DIcon name="alert" size={12} stroke={2.4} /> {item.notiz}
                    </div>
                  )}
                  {done && missing && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <DIcon name="alert" size={12} stroke={2.4} /> Küche wurde informiert
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? (missing ? 'var(--danger)' : 'var(--accent)') : 'transparent',
                    boxShadow: done ? 'none' : 'inset 0 0 0 2px var(--line)',
                  }}
                >
                  {done
                    ? <DIcon name={missing ? 'alert' : 'check'} size={18} stroke={3} style={{ color: '#fff' }} />
                    : <DIcon name="chevron" size={16} stroke={2.6} style={{ color: 'var(--ink-3)' }} />}
                </div>
              </button>

              {/* Inline-Aktionen (Ist dabei / Fehlt) wenn aufgeklappt */}
              {isOpen && !done && (
                <div style={{ display: 'flex', gap: 10, padding: '0 12px 12px' }}>
                  <Btn
                    onClick={() => confirm(item.id, false)}
                    disabled={pending === item.id}
                    size="md"
                    icon={pending === item.id ? undefined : 'check'}
                    style={{ flex: 1 }}
                  >
                    {pending === item.id ? <DSpinner size={16} /> : 'Ist dabei'}
                  </Btn>
                  <Btn
                    onClick={() => confirm(item.id, true)}
                    disabled={pending === item.id}
                    size="md"
                    variant="danger"
                    icon="close"
                    full={false}
                  >
                    Fehlt
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: "Alles dabei" */}
      <div style={{ flexShrink: 0, padding: `12px 16px ${SAFE_BOTTOM + 12}px`, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <Btn
          onClick={complete}
          disabled={!allDone || pending === 'complete'}
          icon={allDone && pending !== 'complete' ? 'check-circle' : undefined}
        >
          {pending === 'complete'
            ? <DSpinner size={18} />
            : allDone ? 'Alles dabei — losfahren' : `Noch ${totalItems - confirmed} Gerichte prüfen`}
        </Btn>
      </div>
    </div>
  );
}
