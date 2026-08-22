// screens-pick.jsx — Order overview + control-into-bag flow + per-dish sheet
// Food delivery: dishes are controlled into the bag (no warehouse / barcode).
// Exports to window: OrdersScreen, PickScreen, ProductCheckSheet, ProductThumb

const KIND_ICON = { food: 'bowl', drink: 'cup', dessert: 'dessert' };

function ProductThumb({ size = 54, kind = 'food' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 13, flexShrink: 0,
      background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 0 0 1px var(--line)',
    }}>
      <Icon name={KIND_ICON[kind] || 'bowl'} size={size * 0.52} stroke={1.8} style={{ color: 'var(--ink-2)' }} />
    </div>
  );
}

function ModChips({ mods }) {
  if (!mods || !mods.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {mods.map((m, i) => (
        <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0 }}>{m}</span>
      ))}
    </div>
  );
}

function pickStats(order) {
  const total = order.items.length;
  const done = order.items.filter(i => i.confirmed).length;
  return { total, done, complete: done === total && total > 0 };
}

// ── Bestellübersicht ─────────────────────────────────────────────────────────
function OrdersScreen({ orders, pendingCount = 0, onOpenPick, onStartTour }) {
  const pickedCount = orders.filter(o => pickStats(o).complete).length;
  const allPicked = orders.length > 0 && pickedCount === orders.length;
  const ready = allPicked && pendingCount === 0;
  const remainingItems = orders.reduce((s, o) => s + (pickStats(o).total - pickStats(o).done), 0);

  let cta = 'Route berechnen';
  if (!ready && pendingCount > 0) cta = 'Weitere Bestellung unterwegs …';
  else if (!ready) cta = `Noch ${remainingItems} Gerichte kontrollieren`;

  return (
    <Screen>
      <Header title="Bestellungen" subtitle={`${orders.length} angenommen · ${DRIVER.hub}`}
        right={<Badge tone="accent" icon="bag2">{pickedCount}/{orders.length}</Badge>} />

      <div className="scroll" style={{ flex: 1, padding: '2px 16px 12px' }}>
        {orders.map((o) => {
          const st = pickStats(o);
          const dishes = o.items.reduce((a, i) => a + i.qty, 0);
          return (
            <button key={o.id} className="press tap" onClick={() => onOpenPick(o.id)}
              style={{ width: '100%', textAlign: 'left', display: 'block', background: 'var(--surface)', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px -6px rgba(0,0,0,.14), inset 0 0 0 1px var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>#{o.code}</span>
                <div style={{ flex: 1 }} />
                {st.complete
                  ? <Badge tone="accent" icon="check">In der Tüte</Badge>
                  : st.done > 0 ? <Badge tone="warn">{st.done}/{st.total} kontrolliert</Badge>
                  : <Badge tone="neutral">Zu kontrollieren</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={o.customer} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16.5 }}>{o.customer}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Icon name="pin" size={14} stroke={2} style={{ color: 'var(--ink-3)', flexShrink: 0 }} /> {o.shortAddr}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{st.complete ? 'Ansehen' : 'Kontrollieren'}</span>
                  <Icon name="chevron" size={17} stroke={2.6} />
                </div>
              </div>
              <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}><Progress value={st.done} max={st.total} height={7} /></div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>
                  <Icon name="cutlery" size={13} stroke={2.2} /> {dishes} Gerichte
                </span>
              </div>
            </button>
          );
        })}

        {pendingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 12, borderRadius: 20, border: '1.5px dashed var(--line)', background: 'transparent' }}>
            <Spinner size={22} color="var(--accent)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Nächste Bestellung …</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, marginTop: 2 }}>Bestellungen kommen einzeln rein</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: `12px 16px ${SAFE_BOTTOM + 12}px`, background: 'linear-gradient(180deg, transparent, var(--bg) 30%)' }}>
        <Btn onClick={onStartTour} disabled={!ready} icon={ready ? 'route' : undefined}>
          {!ready && pendingCount > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Spinner size={18} color="var(--ink-3)" />{cta}</span> : cta}
        </Btn>
      </div>
    </Screen>
  );
}

// ── Kontrollieren: dishes of one order into the bag ──────────────────────────
function PickScreen({ order, onBack, onConfirmItem, onComplete }) {
  const [openId, setOpenId] = React.useState(null);
  const st = pickStats(order);
  const openItem = order.items.find(i => i.id === openId);

  return (
    <Screen>
      <Header onBack={onBack} title={`#${order.code}`} subtitle={`${order.customer} · ${order.shortAddr}`} />

      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 16, padding: '13px 16px', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="bag2" size={22} stroke={2} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{st.done} von {st.total} in der Tüte</div>
            <div style={{ marginTop: 7 }}><Progress value={st.done} max={st.total} height={8} /></div>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: st.complete ? 'var(--accent)' : 'var(--ink)' }}>{Math.round(st.done / st.total * 100)}%</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '2px 16px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 4px 10px' }}>Tippe ein Gericht zum Kontrollieren</div>
        {order.items.map(item => (
          <button key={item.id} className="tap" onClick={() => !item.confirmed && setOpenId(item.id)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 13, padding: 12, marginBottom: 10, borderRadius: 18,
              background: item.confirmed ? 'var(--accent-tint)' : 'var(--surface)',
              boxShadow: item.confirmed ? 'none' : '0 2px 8px -6px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)',
              transition: 'background .2s ease' }}>
            <ProductThumb kind={item.kind} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>{item.qty}×</span>
                <span style={{ fontWeight: 700, fontSize: 15.5, flex: 1, minWidth: 0, lineHeight: 1.25 }}>{item.name}</span>
              </div>
              {item.sub && <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 1 }}>{item.sub}</div>}
              <ModChips mods={item.mods} />
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          {st.complete ? 'Bestellung komplett · zurück' : `Noch ${st.total - st.done} Gerichte`}
        </Btn>
      </div>

      {openItem && <ProductCheckSheet item={openItem} note={order.note} onClose={() => setOpenId(null)}
        onConfirm={() => { onConfirmItem(order.id, openItem.id); setOpenId(null); }} />}
    </Screen>
  );
}

// ── Single dish control sheet ────────────────────────────────────────────────
function ProductCheckSheet({ item, note, onConfirm, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <ProductThumb size={64} kind={item.kind} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.18 }}>{item.name}</div>
          {item.sub && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>{item.sub}</div>}
          <ModChips mods={item.mods} />
        </div>
        <IconBtn name="close" onClick={onClose} variant="plain" size={36} iconSize={20} />
      </div>

      {/* quantity to put in the bag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '15px 16px', background: 'var(--surface-2)', borderRadius: 16, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', lineHeight: 1.2 }}>In die Tüte legen</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.3, marginTop: 2 }}>Anzahl prüfen</div>
        </div>
        <span className="mono" style={{ fontWeight: 800, fontSize: 24, color: 'var(--accent)', flexShrink: 0 }}>{item.qty}×</span>
      </div>

      {/* special request */}
      {note && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--warn-tint)', borderRadius: 14, padding: '11px 13px', marginBottom: 16 }}>
          <Icon name="alert" size={16} stroke={2.2} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hinweis zur Bestellung</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginTop: 2 }}>{note}</div>
          </div>
        </div>
      )}

      <Btn onClick={onConfirm} icon="check">In die Tüte gelegt</Btn>
    </Sheet>
  );
}

Object.assign(window, { OrdersScreen, PickScreen, ProductCheckSheet, ProductThumb });
