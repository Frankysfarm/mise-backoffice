// screens-route.jsx — Route calculating, Tour/map navigation, delivery, summary
// Exports to window: RouteLoading, RouteScreen, CallingOverlay, NotFoundSheet, SummaryScreen

const STOP_SLOTS = [{ x: 150, y: 250 }, { x: 288, y: 150 }, { x: 232, y: 48 }, { x: 96, y: 90 }];
const HUB_POS = { x: 56, y: 372 };

function RouteLoading() {
  const [step, setStep] = React.useState(0);
  const steps = ['Bestellungen geladen', 'Verkehr wird geprüft', 'Beste Reihenfolge berechnet'];
  React.useEffect(() => { const iv = setInterval(() => setStep(s => Math.min(s + 1, steps.length)), 620); return () => clearInterval(iv); }, []);
  return (
    <Screen noTop style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ position: 'relative', width: 110, height: 110, marginBottom: 30 }}>
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', animation: 'drv-pulse 1.8s ease-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px -10px rgba(0,0,0,.3)' }}>
          <Icon name="route" size={46} stroke={1.8} style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Beste Route wird berechnet</div>
      <div style={{ marginTop: 22, width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: i <= step ? 1 : 0.35, transition: 'opacity .3s' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < step ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: i < step ? 'none' : 'inset 0 0 0 1.5px var(--line)' }}>
              {i < step ? <Icon name="check" size={15} stroke={3} style={{ color: 'var(--on-accent)' }} /> : i === step ? <Spinner size={14} color="var(--accent)" /> : null}
            </div>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{s}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
}

// Tour navigation with prominent map
function RouteScreen({ orders, routeOrder, currentIndex, statusById, onDelivered, onCall, onNotFound, onFinish, animate = true }) {
  const stops = routeOrder.map((id, i) => {
    const o = orders.find(x => x.id === id);
    const slot = STOP_SLOTS[i] || STOP_SLOTS[STOP_SLOTS.length - 1];
    return { ...slot, id, label: String(i + 1), order: o };
  });
  const doneIds = routeOrder.filter(id => statusById[id] && statusById[id] !== 'pending');
  const cur = stops[currentIndex];
  const allDone = currentIndex >= routeOrder.length;
  const o = cur?.order;

  return (
    <Screen noTop>
      {/* MAP */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CityMap W={360} H={780} hub={HUB_POS} stops={stops} activeIndex={currentIndex} doneIds={doneIds} animate={animate} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, background: 'linear-gradient(180deg, var(--bg) 4%, transparent)', pointerEvents: 'none' }} />

      {/* top bar */}
      <div style={{ position: 'absolute', top: SAFE_TOP, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', background: 'var(--surface)', borderRadius: 14, whiteSpace: 'nowrap', boxShadow: '0 4px 16px -6px rgba(0,0,0,.28), inset 0 0 0 1px var(--line)' }}>
          <Icon name="route" size={18} stroke={2.2} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Tour läuft</span>
          <span style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: 14.5 }}>·</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 14.5 }}>{Math.min(currentIndex + (allDone ? 0 : 1), routeOrder.length)}/{routeOrder.length}</span>
        </div>
      </div>

      {/* bottom delivery card */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `0 12px ${SAFE_BOTTOM + 10}px` }}>
        {allDone ? (
          <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 20, boxShadow: '0 -4px 30px -8px rgba(0,0,0,.2), inset 0 0 0 1px var(--line)', animation: 'drv-slide-up .3s ease' }}>
            <Btn onClick={onFinish} icon="check-circle">Tour abschließen</Btn>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 26, padding: 18, boxShadow: '0 -6px 34px -10px rgba(0,0,0,.24), inset 0 0 0 1px var(--line)', animation: 'drv-slide-up .35s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
              <Badge tone="solid">{`Stopp ${currentIndex + 1}`}</Badge>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>#{o.code}</span>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', fontWeight: 700, fontSize: 13.5 }}>
                <Icon name="clock" size={15} stroke={2.2} /> {o.eta} min · {o.distanceKm} km
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="pin-fill" size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17.5, letterSpacing: '-0.02em' }}>{o.address}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 1 }}>{o.floor}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  <Avatar name={o.customer} size={26} /> {o.customer}
                </div>
              </div>
            </div>

            {o.note && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--warn-tint)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
                <Icon name="alert" size={16} stroke={2.2} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{o.note}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Btn variant="secondary" size="md" icon="phone" onClick={() => onCall(o)} style={{ flex: 1 }}>Anrufen</Btn>
              <Btn variant="secondary" size="md" icon="nav" onClick={() => {}} style={{ flex: 1 }}>Navi</Btn>
            </div>

            <Btn onClick={() => onDelivered(o.id)} icon="check-circle">Bestellung geliefert</Btn>

            <button className="tap" onClick={() => onNotFound(o)} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 13, fontSize: 14, fontWeight: 700, color: 'var(--ink-3)' }}>
              Kunde nicht gefunden?
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}

// Calling overlay
function CallingOverlay({ customer, phone, onEnd }) {
  const [sec, setSec] = React.useState(0);
  const [connected, setConnected] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setConnected(true), 2200);
    const iv = setInterval(() => setSec(s => s + 1), 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'linear-gradient(180deg, #11201A, #0A1410)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: SAFE_TOP + 40 }}>
      <div style={{ position: 'relative', marginBottom: 22 }}>
        {!connected && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,.25)', animation: 'drv-pulse 1.6s ease-out infinite' }} />}
        <div style={{ position: 'relative' }}><Avatar name={customer} size={104} tone="rgba(255,255,255,.16)" /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{customer}</div>
        <div className="mono" style={{ fontSize: 15, opacity: 0.7, fontWeight: 600, whiteSpace: 'nowrap' }}>{phone}</div>
        <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600, opacity: 0.85, whiteSpace: 'nowrap' }}>{connected ? `Verbunden · ${mm}:${ss}` : 'Klingelt …'}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ paddingBottom: SAFE_BOTTOM + 28, display: 'flex', gap: 30 }}>
        <button className="press" onClick={onEnd} style={{ width: 72, height: 72, borderRadius: '50%', background: '#E5484D', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px -8px rgba(229,72,77,.6)' }}>
          <Icon name="phone" size={30} stroke={2.2} style={{ color: '#fff', transform: 'rotate(135deg)' }} />
        </button>
      </div>
    </div>
  );
}

// Customer not found options
function NotFoundSheet({ order, onClose, onCall, onMarkFailed }) {
  const opts = [
    { icon: 'phone', label: 'Kunde anrufen', sub: 'Direkt Kontakt aufnehmen', action: onCall, tone: true },
    { icon: 'clock', label: '5 Minuten warten', sub: 'Timer starten & erneut versuchen', action: onClose },
    { icon: 'user', label: 'Bei Nachbarn abgeben', sub: 'Mit Foto-Nachweis dokumentieren', action: onClose },
  ];
  return (
    <Sheet onClose={onClose}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Kunde nicht gefunden</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginTop: 3 }}>{order.customer} · {order.shortAddr}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: '16px 0 12px' }}>
        {opts.map((op, i) => (
          <button key={i} className="press tap" onClick={op.action} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: 13, borderRadius: 16, background: op.tone ? 'var(--accent-tint)' : 'var(--surface-2)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
              <Icon name={op.icon} size={21} stroke={2} style={{ color: op.tone ? 'var(--accent)' : 'var(--ink)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{op.label}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{op.sub}</div>
            </div>
            <Icon name="chevron" size={18} stroke={2.4} style={{ color: 'var(--ink-3)' }} />
          </button>
        ))}
      </div>
      <Btn variant="danger" onClick={onMarkFailed} icon="alert">Als nicht zustellbar melden</Btn>
    </Sheet>
  );
}

function SummaryScreen({ orders, routeOrder, statusById, onBackOnline }) {
  const delivered = routeOrder.filter(id => statusById[id] === 'delivered').length;
  const failed = routeOrder.filter(id => statusById[id] === 'failed').length;
  const km = orders.reduce((s, o) => s + o.distanceKm, 0).toFixed(1);
  return (
    <Screen noTop style={{ alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div style={{ animation: 'drv-pop .5s cubic-bezier(.2,.9,.3,1.2)', width: 96, height: 96, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, boxShadow: '0 16px 40px -12px var(--accent)' }}>
        <Icon name="check" size={50} stroke={3} style={{ color: 'var(--on-accent)' }} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>Tour abgeschlossen</div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, marginTop: 6, textAlign: 'center' }}>Stark gefahren, {DRIVER.name.split(' ')[0]}! Alles dokumentiert.</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 26, width: '100%', maxWidth: 320 }}>
        {[[delivered, 'Geliefert', 'var(--accent)'], [failed, 'Offen', 'var(--ink-3)'], [km + ' km', 'Strecke', 'var(--ink)']].map(([v, l, c], i) => (
          <div key={i} style={{ flex: 1, background: 'var(--surface)', borderRadius: 18, padding: '16px 8px', textAlign: 'center', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, letterSpacing: '-0.02em' }}>{v}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 320, marginTop: 26 }}>
        <Btn onClick={onBackOnline} icon="power">Zurück online gehen</Btn>
      </div>
    </Screen>
  );
}

Object.assign(window, { RouteLoading, RouteScreen, CallingOverlay, NotFoundSheet, SummaryScreen });
