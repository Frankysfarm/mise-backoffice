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
  const [orders, setOrders] = React.useState([]);
  const [incoming, setIncoming] = React.useState(false);
  const [pickId, setPickId] = React.useState(null);
  const [routeOrder, setRouteOrder] = React.useState([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [statusById, setStatusById] = React.useState({});
  const [calling, setCalling] = React.useState(null);
  const [notFound, setNotFound] = React.useState(null);

  // arm incoming order shortly after going online
  React.useEffect(() => {
    if (screen === 'home' && orders.length === 0) {
      const tm = setTimeout(() => setIncoming(true), 1700);
      return () => clearTimeout(tm);
    }
  }, [screen, orders.length]);

  const freshOrders = () => JSON.parse(JSON.stringify(INITIAL_ORDERS));

  const acceptOrders = () => { setOrders(freshOrders()); setIncoming(false); setScreen('orders'); };
  const declineOrders = () => { setIncoming(false); setTimeout(() => { if (orders.length === 0) setIncoming(true); }, 3200); };

  const confirmItem = (orderId, itemId) => setOrders(os => os.map(o => o.id !== orderId ? o : { ...o, items: o.items.map(it => it.id === itemId ? { ...it, confirmed: true } : it) }));

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

  const resetToHome = () => { setOrders([]); setRouteOrder([]); setStatusById({}); setCurrentIndex(0); setScreen('home'); };

  const pickOrder = orders.find(o => o.id === pickId);

  let body = null;
  if (screen === 'login') body = <LoginScreen onLogin={() => setScreen('home')} />;
  else if (screen === 'home') body = <HomeScreen onGoOffline={() => setScreen('login')} />;
  else if (screen === 'orders') body = <OrdersScreen orders={orders} onOpenPick={(id) => { setPickId(id); setScreen('pick'); }} onStartTour={startTour} />;
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
          {incoming && screen === 'home' && <IncomingSheet orders={freshOrders()} onAccept={acceptOrders} onDecline={declineOrders} />}
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
        <TweakButton label="Flow neu starten" onClick={() => { setOrders([]); setIncoming(false); setScreen('login'); }} />
      </TweaksPanel>
    </React.Fragment>
  );
}

Object.assign(window, { DriveApp });
