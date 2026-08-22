// screens-pick.jsx — Order overview (Bestellübersicht) + Pick flow + product check
// Exports to window: OrdersScreen, PickScreen, ProductCheckSheet, ProductThumb

function ProductThumb({ size = 54, temp }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 13, flexShrink: 0, position: 'relative',
      background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 0 0 1px var(--line)',
    }}>
      <Icon name="box" size={size * 0.5} stroke={1.6} style={{ color: 'var(--ink-3)' }} />
      {temp && (
        <div style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--elek, #2E7DD1)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2E7DD1' }}>
          <Icon name="temp" size={13} stroke={2.2} style={{ color: '#fff' }} />
        </div>
      )}
    </div>
  );
}

function pickStats(order) {
  const total = order.items.length;
  const done = order.items.filter(i => i.confirmed).length;
  return { total, done, complete: done === total && total > 0 };
}

// ── Bestellübersicht ─────────────────────────────────────────────────────────
function OrdersScreen({ orders, onOpenPick, onStartTour }) {
  const pickedCount = orders.filter(o => pickStats(o).complete).length;
  const allPicked = pickedCount === orders.length;
  return (
    <Screen>
      <Header title="Zu picken" subtitle={`${orders.length} Bestellungen · ${DRIVER.hub}`}
        right={<Badge tone="accent" icon="bag">{pickedCount}/{orders.length}</Badge>} />

      <div className="scroll" style={{ flex: 1, padding: '2px 16px 12px' }}>
        {orders.map((o, idx) => {
          const st = pickStats(o);
          return (
            <button key={o.id} className="press tap" onClick={() => onOpenPick(o.id)}
              style={{ width: '100%', textAlign: 'left', display: 'block', background: 'var(--surface)', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px -6px rgba(0,0,0,.14), inset 0 0 0 1px var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>#{o.code}</span>
                <div style={{ flex: 1 }} />
                {st.complete
                  ? <Badge tone="accent" icon="check">Gepickt</Badge>
                  : st.done > 0 ? <Badge tone="warn">{st.done}/{st.total} kontrolliert</Badge>
                  : <Badge tone="neutral">Offen</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={o.customer} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16.5 }}>{o.customer}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 500, marginTop: 1 }}>
                    <Icon name="pin" size={14} stroke={2} style={{ color: 'var(--ink-3)' }} /> {o.shortAddr}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{st.complete ? 'Ansehen' : 'Picken'}</span>
                  <Icon name="chevron" size={17} stroke={2.6} />
                </div>
              </div>
              <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}><Progress value={st.done} max={st.total} height={7} /></div>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>{o.items.reduce((a, i) => a + i.qty, 0)} Artikel</span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, padding: `12px 16px ${SAFE_BOTTOM + 12}px`, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <Btn onClick={onStartTour} disabled={!allPicked} icon={allPicked ? 'route' : undefined}>
          {allPicked ? 'Tour starten · Route berechnen' : `Erst alle picken · ${pickedCount}/${orders.length}`}
        </Btn>
      </div>
    </Screen>
  );
}

// ── Pick one order ───────────────────────────────────────────────────────────
function PickScreen({ order, onBack, onConfirmItem, onComplete }) {
  const [openId, setOpenId] = React.useState(null);
  const st = pickStats(order);
  const openItem = order.items.find(i => i.id === openId);

  return (
    <Screen>
      <Header onBack={onBack} title={`#${order.code}`} subtitle={`${order.customer} · ${order.shortAddr}`} />

      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 16, padding: '13px 16px', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{st.done} von {st.total} kontrolliert</div>
            <div style={{ marginTop: 7 }}><Progress value={st.done} max={st.total} height={8} /></div>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: st.complete ? 'var(--accent)' : 'var(--ink)' }}>{Math.round(st.done / st.total * 100)}%</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '2px 16px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 4px 10px' }}>Tippe einen Artikel zum Kontrollieren</div>
        {order.items.map(item => (
          <button key={item.id} className="tap" onClick={() => !item.confirmed && setOpenId(item.id)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, padding: 12, marginBottom: 10, borderRadius: 18,
              background: item.confirmed ? 'var(--accent-tint)' : 'var(--surface)',
              boxShadow: item.confirmed ? 'none' : '0 2px 8px -6px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)',
              transition: 'background .2s ease' }}>
            <ProductThumb temp={item.temp} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>{item.qty}×</span>
                <span style={{ fontWeight: 700, fontSize: 15.5, flex: 1, minWidth: 0, lineHeight: 1.25 }}>{item.name}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 1 }}>{item.sub}{item.unit ? ' · ' + item.unit : ''}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 7 }}>
                <Icon name="pin" size={12} stroke={2.4} /> {item.loc}
              </div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: item.confirmed ? 'var(--accent)' : 'transparent',
              boxShadow: item.confirmed ? 'none' : 'inset 0 0 0 2px var(--line)' }}>
              {item.confirmed
                ? <Icon name="check" size={18} stroke={3} style={{ color: 'var(--on-accent)' }} />
                : <Icon name="chevron" size={16} stroke={2.6} style={{ color: 'var(--ink-3)' }} />}
            </div>
          </button>
        ))}
      </div>

      <div style={{ flexShrink: 0, padding: `12px 16px ${SAFE_BOTTOM + 12}px`, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <Btn onClick={onComplete} disabled={!st.complete} icon={st.complete ? 'check-circle' : undefined}>
          {st.complete ? 'Bestellung fertig gepickt' : `Noch ${st.total - st.done} Artikel kontrollieren`}
        </Btn>
      </div>

      {openItem && <ProductCheckSheet item={openItem} onClose={() => setOpenId(null)}
        onConfirm={() => { onConfirmItem(order.id, openItem.id); setOpenId(null); }} />}
    </Screen>
  );
}

// ── Single product control sheet ─────────────────────────────────────────────
function ProductCheckSheet({ item, onConfirm, onClose }) {
  const [count, setCount] = React.useState(item.qty);
  const [scanned, setScanned] = React.useState(false);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <ProductThumb size={64} temp={item.temp} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{item.name}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>{item.sub}</div>
        </div>
        <IconBtn name="close" onClick={onClose} variant="plain" size={36} iconSize={20} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 14, padding: '11px 13px' }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lagerplatz</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontWeight: 700, fontSize: 15 }}>
            <Icon name="pin-fill" size={16} style={{ color: 'var(--accent)' }} />{item.loc}
          </div>
        </div>
        {item.temp && (
          <div style={{ flex: 1, background: '#E9F2FB', borderRadius: 14, padding: '11px 13px' }}>
            <div style={{ fontSize: 11.5, color: '#2E7DD1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hinweis</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontWeight: 700, fontSize: 15, color: '#2065A8' }}>
              <Icon name="temp" size={16} stroke={2.2} />Kühlware
            </div>
          </div>
        )}
      </div>

      {/* scan placeholder */}
      <button className="press" onClick={() => setScanned(true)} style={{ width: '100%', height: 92, borderRadius: 16, marginBottom: 14,
        background: scanned ? 'var(--accent-tint)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
        boxShadow: scanned ? 'none' : 'inset 0 0 0 2px var(--line)', transition: 'background .2s' }}>
        <Icon name={scanned ? 'check-circle' : 'scan'} size={30} stroke={1.9} style={{ color: 'var(--accent)' }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: scanned ? 'var(--accent)' : 'var(--ink)', whiteSpace: 'nowrap' }}>{scanned ? 'Barcode erkannt' : 'Barcode scannen'}</div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{scanned ? '4 0610 28 014527' : 'optional'}</div>
        </div>
      </button>

      {/* quantity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>Menge bestätigen</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>Soll: {item.qty}× {item.unit || ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', borderRadius: 14, padding: 5 }}>
          <IconBtn name="minus" onClick={() => setCount(c => Math.max(0, c - 1))} size={40} iconSize={20} variant="surface" />
          <div className="mono" style={{ width: 40, textAlign: 'center', fontWeight: 700, fontSize: 20 }}>{count}</div>
          <IconBtn name="plus" onClick={() => setCount(c => c + 1)} size={40} iconSize={20} variant="surface" />
        </div>
      </div>

      <Btn onClick={onConfirm} icon="check" disabled={count === 0}>Artikel bestätigen</Btn>
    </Sheet>
  );
}

Object.assign(window, { OrdersScreen, PickScreen, ProductCheckSheet, ProductThumb });
