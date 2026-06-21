// App.jsx — Drive orchestrator: state machine, navigation, theming via Tweaks
// Exports to window: DriveApp

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "wald",
  "mapAnimation": true
}/*EDITMODE-END*/;

function ThemeSwatches({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '2px 0 4px' }}>
      {Object.entries(THEMES).map(([key, th]) => {
        const sel = value === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            flex: 1, borderRadius: 12, padding: '9px 4px 7px', cursor: 'pointer',
            background: sel ? 'rgba(255,255,255,.08)' : 'transparent',
            border: sel ? '1.5px solid #fff' : '1.5px solid rgba(255,255,255,.14)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <span style={{ display: 'flex', gap: 3 }}>
              <i style={{ width: 16, height: 16, borderRadius: 5, background: th.vars['--accent'] }} />
              <i style={{ width: 16, height: 16, borderRadius: 5, background: th.vars['--bg'], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2)' }} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: sel ? '#fff' : 'rgba(255,255,255,.55)' }}>{th.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DeviceStage({ dark, children }) {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const w = window.innerWidth || 402, h = window.innerHeight || 874;
      const s = Math.min(1, (w - 24) / 402, (h - 24) / 874);
      setScale(s > 0.1 ? s : 1);
    };
    fit();
    const r = requestAnimationFrame(fit);
    const tm = setTimeout(fit, 120);
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('resize', fit); cancelAnimationFrame(r); clearTimeout(tm); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0e0d' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <IOSDevice dark={dark}>{children}</IOSDevice>
      </div>
    </div>
  );
}

function DriveApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = THEMES[t.theme] || THEMES.wald;

  const [screen, setScreen] = React.useState('login');
  const [orders, setOrders] = React.useState([]);        // accepted orders
  const [queueIds, setQueueIds] = React.useState([]);     // not yet offered
  const [incomingId, setIncomingId] = React.useState(null); // single order being offered
  const [lateIds, setLateIds] = React.useState([]);       // orders that arrive DURING the tour
  const [toast, setToast] = React.useState(null);
  const [pickId, setPickId] = React.useState(null);
  const [routeOrder, setRouteOrder] = React.useState([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [statusById, setStatusById] = React.useState({});
  const [calling, setCalling] = React.useState(null);
  const [notFound, setNotFound] = React.useState(null);

  // Orders arrive ONE AT A TIME on the home & overview screens (pre-tour queue)...
  React.useEffect(() => {
    if ((screen === 'home' || screen === 'orders') && !incomingId && queueIds.length > 0) {
      const delay = screen === 'home' ? 1600 : 3400;
      const tm = setTimeout(() => setIncomingId(queueIds[0]), delay);
      return () => clearTimeout(tm);
    }
  }, [screen, incomingId, queueIds]);

  // ...and they can ALSO come in while the driver is on the tour (late queue).
  React.useEffect(() => {
    if (screen === 'route' && !incomingId && !calling && !notFound && lateIds.length > 0) {
      const tm = setTimeout(() => setIncomingId(lateIds[0]), 6000);
      return () => clearTimeout(tm);
    }
  }, [screen, incomingId, calling, notFound, lateIds]);

  // Haptics: buzz the phone whenever a new order is offered (even if the app is
  // backgrounded a native build fires this via push + haptics — see handoff README).
  React.useEffect(() => {
    if (incomingId && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([220, 120, 220]); } catch (e) {}
    }
  }, [incomingId]);

  const cloneOrder = (id) => JSON.parse(JSON.stringify(INITIAL_ORDERS.find(o => o.id === id)));
  const incomingOrder = incomingId ? INITIAL_ORDERS.find(o => o.id === incomingId) : null;

  const acceptOrder = () => {
    if (!incomingId) return;
    const id = incomingId;
    setOrders(os => [...os, cloneOrder(id)]);
    setQueueIds(q => q.filter(x => x !== id));
    setLateIds(q => q.filter(x => x !== id));
    setIncomingId(null);
    if (screen === 'route') {
      // accepted mid-tour: append as a new stop on the route
      setRouteOrder(ro => [...ro, id]);
      setStatusById(s => ({ ...s, [id]: 'pending' }));
      const o = INITIAL_ORDERS.find(x => x.id === id);
      setToast(`#${o.code} zur Route hinzugefügt`);
      setTimeout(() => setToast(null), 2600);
    } else if (screen === 'home') {
      setScreen('orders');
    }
  };
  const declineOrder = () => {
    if (!incomingId) return;
    const id = incomingId;
    setQueueIds(q => q.filter(x => x !== id));
    setLateIds(q => q.filter(x => x !== id));
    setIncomingId(null);
  };
  const startShift = () => { setQueueIds([...PRE_TOUR_IDS]); setLateIds([...LATE_IDS]); setScreen('home'); };

  const confirmItem = (orderId, itemId) => setOrders(os => os.map(o => o.id !== orderId ? o : { ...o, items: o.items.map(it => it.id === itemId ? { ...it, confirmed: true } : it) }));

  const pendingCount = queueIds.length;

  const startTour = () => {
    const ro = makeRouteOrder(orders);
    setRouteOrder(ro);
    setStatusById(Object.fromEntries(ro.map(id => [id, 'pending'])));
    setCurrentIndex(0);
    setScreen('routeLoading');
    setTimeout(() => setScreen('route'), 2100);
  };

  const deliver = (id) => { setStatusById(s => ({ ...s, [id]: 'delivered' })); setCurrentIndex(i => i + 1); };
  const markFailed = (id) => { setStatusById(s => ({ ...s, [id]: 'failed' })); setNotFound(null); setCurrentIndex(i => i + 1); };

  const resetToHome = () => { setOrders([]); setRouteOrder([]); setStatusById({}); setCurrentIndex(0); setIncomingId(null); setQueueIds([...PRE_TOUR_IDS]); setLateIds([...LATE_IDS]); setScreen('home'); };

  const pickOrder = orders.find(o => o.id === pickId);

  let body = null;
  if (screen === 'login') body = <LoginScreen onLogin={startShift} />;
  else if (screen === 'home') body = <HomeScreen onGoOffline={() => setScreen('login')} />;
  else if (screen === 'orders') body = <OrdersScreen orders={orders} pendingCount={pendingCount} onOpenPick={(id) => { setPickId(id); setScreen('pick'); }} onStartTour={startTour} />;
  else if (screen === 'pick' && pickOrder) body = <PickScreen order={pickOrder} onBack={() => setScreen('orders')} onConfirmItem={confirmItem} onComplete={() => setScreen('orders')} />;
  else if (screen === 'routeLoading') body = <RouteLoading />;
  else if (screen === 'route') body = <RouteScreen orders={orders} routeOrder={routeOrder} currentIndex={currentIndex} statusById={statusById} animate={t.mapAnimation}
    onDelivered={deliver} onCall={(o) => setCalling(o)} onNotFound={(o) => setNotFound(o)} onFinish={() => setScreen('summary')} />;
  else if (screen === 'summary') body = <SummaryScreen orders={orders} routeOrder={routeOrder} statusById={statusById} onBackOnline={resetToHome} />;

  return (
    <React.Fragment>
      <DeviceStage dark={theme.dark}>
        <div className="drive" style={theme.vars}>
          {body}
          {incomingOrder && (screen === 'home' || screen === 'orders' || screen === 'route') && !calling && !notFound && <IncomingSheet order={incomingOrder} onTour={screen === 'route'} queuePos={orders.length > 0 ? `${orders.length} angenommen` : null} onAccept={acceptOrder} onDecline={declineOrder} />}
          {toast && <Toast text={toast} />}
          {notFound && <NotFoundSheet order={notFound} onClose={() => setNotFound(null)} onCall={() => { setCalling(notFound); setNotFound(null); }} onMarkFailed={() => markFailed(notFound.id)} />}
          {calling && <CallingOverlay customer={calling.customer} phone={calling.phone} onEnd={() => setCalling(null)} />}
        </div>
      </DeviceStage>

      <TweaksPanel>
        <TweakSection label="Farbwelt" />
        <ThemeSwatches value={t.theme} onChange={(v) => setTweak('theme', v)} />
        <TweakSection label="Karte" />
        <TweakToggle label="Routen-Animation" value={t.mapAnimation} onChange={(v) => setTweak('mapAnimation', v)} />
        <TweakSection label="Demo" />
        <TweakButton label="Flow neu starten" onClick={() => { setOrders([]); setQueueIds([]); setLateIds([]); setIncomingId(null); setScreen('login'); }} />
      </TweaksPanel>
    </React.Fragment>
  );
}

Object.assign(window, { DriveApp });
