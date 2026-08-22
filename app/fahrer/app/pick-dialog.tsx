'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

export type PickOrder = {
  orderId: string;
  bestellnummer: string;
  kundeName?: string | null;
  items: Item[];
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

/**
 * Ganze Tour in EINER Ansicht: pro Bestellung eine Seite, horizontal durchwischbar,
 * am Ende eine Abschluss-Seite mit "Route berechnen".
 * Vorher wurde der Dialog pro Bestellung neu montiert — der Fahrer sah keinen Zusammenhang
 * und konnte nicht zurückblättern, um eine schon gepickte Bestellung zu kontrollieren.
 */
export function PickDialog({
  orders,
  batchId,
  onClose,
  onRouteReady,
  routePending,
}: {
  orders: PickOrder[];
  batchId: string;
  onClose: () => void;
  onRouteReady: () => void;
  routePending?: boolean;
}) {
  const supabase = createClient();
  const [pending, setPending] = useState<string | null>(null);
  const [local, setLocal] = useState<PickOrder[]>(orders);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [drag, setDrag] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const autoAdvanced = useRef<Set<string>>(new Set());

  // Server-Stand nachziehen, ohne den lokal bestätigten Fortschritt zu verlieren.
  useEffect(() => {
    setLocal((prev) => orders.map((o) => {
      const old = prev.find((p) => p.orderId === o.orderId);
      if (!old) return o;
      return {
        ...o,
        items: o.items.map((it) => {
          const oldIt = old.items.find((x) => x.id === it.id);
          return oldIt?.pick_confirmed_at && !it.pick_confirmed_at ? oldIt : it;
        }),
      };
    }));
  }, [orders]);

  const pageCount = local.length + 1; // + Abschluss-Seite
  const orderDone = (o: PickOrder) => o.items.length > 0 && o.items.every((i) => i.pick_confirmed_at);
  const allOrdersDone = local.length > 0 && local.every(orderDone);
  // Vorwärts nur bis zur ersten ungepickten Bestellung — sonst könnte man eine überspringen.
  const maxPage = useMemo(() => {
    const firstOpen = local.findIndex((o) => !orderDone(o));
    return firstOpen === -1 ? pageCount - 1 : firstOpen;
  }, [local, pageCount]);

  function goTo(p: number) {
    setPage(Math.max(0, Math.min(maxPage, p)));
    setDrag(0);
    setOpenId(null);
  }

  async function confirm(orderId: string, id: string, missing = false) {
    setPending(id);
    const { error } = await supabase.rpc('confirm_pick_item', {
      p_order_item_id: id,
      p_missing: missing,
      p_note: missing ? 'Fahrer meldet: Item fehlt' : null,
    });
    setPending(null);
    if (error) { alert(error.message); return; }
    setLocal((xs) => xs.map((o) => o.orderId !== orderId ? o : {
      ...o,
      items: o.items.map((x) => x.id === id
        ? { ...x, pick_confirmed_at: new Date().toISOString(), pick_missing: missing }
        : x),
    }));
    setOpenId((prev) => (prev === id ? null : prev));
  }

  // Bestellung fertig -> automatisch nach links zur nächsten (einmal pro Bestellung).
  useEffect(() => {
    const cur = local[page];
    if (!cur || !orderDone(cur) || autoAdvanced.current.has(cur.orderId)) return;
    autoAdvanced.current.add(cur.orderId);
    navigator.vibrate?.(20);
    const t = setTimeout(() => setPage((p) => (p === page ? Math.min(pageCount - 1, p + 1) : p)), 650);
    return () => clearTimeout(t);
  }, [local, page, pageCount]);

  const width = () => trackRef.current?.offsetWidth ?? 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--bg)', color: 'var(--ink)',
        paddingTop: SAFE_TOP, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header: Zurück + Position in der Tour */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 10px', flexShrink: 0 }}>
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
            {page >= local.length
              ? 'Alles gepickt'
              : `Bestellung ${page + 1} von ${local.length}`}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>
            {page >= local.length
              ? 'Bereit zum Losfahren'
              : `#${(local[page]?.bestellnummer ?? '').replace(/^[A-Z]+-?/, '')}${local[page]?.kundeName ? ' · ' + local[page]!.kundeName : ''}`}
          </div>
        </div>
      </div>

      {/* Punkte-Anzeige: wo stehe ich in der Tour */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 10, flexShrink: 0 }}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 6, borderRadius: 3, transition: 'all .25s ease',
              width: i === page ? 22 : 6,
              background: i === page ? 'var(--accent)'
                : i < local.length && orderDone(local[i]) ? 'var(--accent)'
                : 'var(--line)',
              opacity: i === page ? 1 : i < local.length && orderDone(local[i]) ? 0.55 : 1,
            }}
          />
        ))}
      </div>

      {/* Wisch-Strecke */}
      <div
        ref={trackRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', touchAction: 'pan-y' }}
        onPointerDown={(e) => { dragging.current = true; startX.current = e.clientX; }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const dx = e.clientX - startX.current;
          // an den Rändern zäh machen, damit klar ist: hier geht es nicht weiter
          const blocked = (dx < 0 && page >= maxPage) || (dx > 0 && page === 0);
          setDrag(blocked ? dx * 0.25 : dx);
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          if (drag < -width() * 0.22) goTo(page + 1);
          else if (drag > width() * 0.22) goTo(page - 1);
          else setDrag(0);
        }}
        onPointerLeave={() => { if (dragging.current) { dragging.current = false; setDrag(0); } }}
      >
        <div
          style={{
            display: 'flex', height: '100%',
            width: `${pageCount * 100}%`,
            transform: `translateX(calc(${-page * (100 / pageCount)}% + ${drag}px))`,
            transition: dragging.current ? 'none' : 'transform .32s cubic-bezier(.22,.9,.3,1)',
          }}
        >
          {local.map((order) => {
            const confirmed = order.items.filter((i) => i.pick_confirmed_at).length;
            const totalItems = order.items.length;
            const pct = totalItems > 0 ? Math.round((confirmed / totalItems) * 100) : 0;
            const done = orderDone(order);
            return (
              <div key={order.orderId} style={{ width: `${100 / pageCount}%`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 16, padding: '13px 16px', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{confirmed} von {totalItems} kontrolliert</div>
                      <div style={{ marginTop: 7 }}>
                        <Progress value={confirmed} max={totalItems} height={8} />
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: done ? 'var(--accent)' : 'var(--ink)' }}>
                      {pct}%
                    </div>
                  </div>
                </div>

                <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 16px 12px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 4px 10px' }}>
                    {done ? 'Fertig — zum Kontrollieren zurückwischen' : 'Tippe ein Gericht zum Kontrollieren'}
                  </div>
                  {order.items.map((item) => {
                    const itemDone = !!item.pick_confirmed_at;
                    const missing = !!item.pick_missing;
                    const isOpen = openId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{
                          marginBottom: 10, borderRadius: 18,
                          background: itemDone ? (missing ? 'var(--danger-tint)' : 'var(--accent-tint)') : 'var(--surface)',
                          boxShadow: itemDone ? 'none' : '0 2px 8px -6px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)',
                          transition: 'background .2s ease', overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          className="tap"
                          onClick={() => !itemDone && setOpenId(isOpen ? null : item.id)}
                          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, padding: 12, background: 'transparent' }}
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
                            {itemDone && missing && (
                              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <DIcon name="alert" size={12} stroke={2.4} /> Küche wurde informiert
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: itemDone ? (missing ? 'var(--danger)' : 'var(--accent)') : 'transparent',
                              boxShadow: itemDone ? 'none' : 'inset 0 0 0 2px var(--line)',
                            }}
                          >
                            {itemDone
                              ? <DIcon name={missing ? 'alert' : 'check'} size={18} stroke={3} style={{ color: '#fff' }} />
                              : <DIcon name="chevron" size={16} stroke={2.6} style={{ color: 'var(--ink-3)' }} />}
                          </div>
                        </button>

                        {isOpen && !itemDone && (
                          <div style={{ display: 'flex', gap: 10, padding: '0 12px 12px' }}>
                            <Btn
                              onClick={() => confirm(order.orderId, item.id, false)}
                              disabled={pending === item.id}
                              size="md"
                              icon={pending === item.id ? undefined : 'check'}
                              style={{ flex: 1 }}
                            >
                              {pending === item.id ? <DSpinner size={16} /> : 'Ist dabei'}
                            </Btn>
                            <Btn
                              onClick={() => confirm(order.orderId, item.id, true)}
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

                <div style={{ flexShrink: 0, padding: `10px 16px ${SAFE_BOTTOM + 10}px`, textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>
                    {done
                      ? 'Wisch nach links ‹‹'
                      : `Noch ${totalItems - confirmed} ${totalItems - confirmed === 1 ? 'Gericht' : 'Gerichte'} prüfen`}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Abschluss-Seite */}
          <div style={{ width: `${100 / pageCount}%`, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', position: 'relative' }}>
            {/* Radar Animation Background */}
            {allOrdersDone && !routePending && (
              <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', animation: 'drv-pulse 2s infinite', pointerEvents: 'none' }} />
            )}
            
            <button
              className="press"
              onClick={onRouteReady}
              disabled={!allOrdersDone || routePending}
              style={{
                position: 'relative',
                zIndex: 10,
                width: 150, height: 150,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                fontWeight: 800,
                fontSize: 19,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                boxShadow: '0 16px 40px -12px rgba(36, 138, 61, 0.45), inset 0 0 0 1px rgba(255,255,255,0.25)',
                opacity: (!allOrdersDone || routePending) ? 0.5 : 1
              }}
            >
              {routePending ? (
                <DSpinner size={36} color="var(--on-accent)" />
              ) : (
                <>
                  <DIcon name="nav" size={38} stroke={2.5} style={{ marginBottom: 6 }} />
                  Tour<br />starten
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => goTo(local.length - 1)}
              style={{ position: 'absolute', bottom: Math.max(SAFE_BOTTOM, 20), width: '100%', background: 'transparent', color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 4, padding: 12 }}
            >
              Zurück zum Kontrollieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
