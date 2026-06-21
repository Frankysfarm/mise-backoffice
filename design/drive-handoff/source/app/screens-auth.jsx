// screens-auth.jsx — Login, Online/Waiting home, single incoming order request
// Exports to window: LoginScreen, HomeScreen, IncomingSheet, BrandMark, Field

function BrandMark({ size = 34, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: size, height: size, borderRadius: size * 0.28, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 6px 16px -6px var(--accent)',
      }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" style={{ color: 'var(--on-accent)' }}>
          <path d="M12 2 21 19l-9-4-9 4z" fill="currentColor" />
        </svg>
      </div>
      <span style={{ fontSize: size * 0.62, fontWeight: 800, letterSpacing: '-0.04em' }}>drive</span>
    </div>
  );
}

function Field({ icon, label, value, onChange, secure }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 60,
      background: 'var(--surface)', borderRadius: 16,
      boxShadow: `inset 0 0 0 ${focus ? 2 : 1.5}px ${focus ? 'var(--accent)' : 'var(--line)'}`,
      transition: 'box-shadow .15s ease',
    }}>
      <Icon name={icon} size={21} stroke={2} style={{ color: focus ? 'var(--accent)' : 'var(--ink-3)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <input value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          type={secure ? 'password' : 'text'} inputMode={secure ? 'numeric' : 'tel'}
          style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 16.5, fontWeight: 600, color: 'var(--ink)', padding: '2px 0 0', fontFamily: 'inherit' }} />
      </div>
    </label>
  );
}

function LoginScreen({ onLogin }) {
  const [phone, setPhone] = React.useState('0151 22 48 100');
  const [pin, setPin] = React.useState('••••••');
  const [busy, setBusy] = React.useState(false);
  const go = () => { setBusy(true); setTimeout(onLogin, 850); };
  return (
    <Screen bg="var(--bg)" noTop>
      <div style={{ position: 'relative', height: 280, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          <CityMap W={360} H={300} hub={{ x: 70, y: 250 }}
            stops={[{ x: 150, y: 150, label: '1', id: 'a' }, { x: 270, y: 80, label: '2', id: 'b' }]} activeIndex={-1} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, var(--bg) 92%)' }} />
        <div style={{ position: 'absolute', top: SAFE_TOP + 8, left: 22 }}><BrandMark size={32} /></div>
      </div>

      <div style={{ flex: 1, padding: '4px 22px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 }}>Schicht starten</div>
        <div style={{ fontSize: 15.5, color: 'var(--ink-2)', marginTop: 7, fontWeight: 500 }}>Melde dich mit deiner Fahrer-Nummer an.</div>

        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field icon="phone" label="Fahrer-Nummer" value={phone} onChange={setPhone} />
          <Field icon="lock" label="PIN" value={pin} onChange={setPin} secure />
        </div>

        <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>PIN vergessen?</div>

        <div style={{ flex: 1 }} />
        <div style={{ paddingBottom: SAFE_BOTTOM + 14 }}>
          <Btn onClick={go} disabled={busy} icon={busy ? undefined : 'power'}>
            {busy ? <Spinner /> : 'Anmelden & online gehen'}
          </Btn>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
            Küche Prenzlauer Berg · Schicht 16:00–22:00
          </div>
        </div>
      </div>
    </Screen>
  );
}

// Online / waiting-for-orders home
function HomeScreen({ onGoOffline }) {
  return (
    <Screen bg="var(--bg)" noTop>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <CityMap W={360} H={760} hub={{ x: 180, y: 430 }}
            stops={[{ x: 90, y: 250, label: '1', id: 'a' }, { x: 280, y: 200, label: '2', id: 'b' }, { x: 250, y: 600, label: '3', id: 'c' }]} activeIndex={-1} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--bg) 2%, transparent 16% 62%, var(--bg) 99%)' }} />

        <div style={{ position: 'absolute', top: SAFE_TOP + 4, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 4px 16px -6px rgba(0,0,0,.25), inset 0 0 0 1px var(--line)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-tint)' }} />
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Online</span>
          </div>
          <div style={{ flex: 1 }} />
          <IconBtn name="bell" size={42} />
        </div>

        <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', textAlign: 'center', width: 250 }}>
          <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 18px' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', animation: 'drv-pulse 2s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,.3)' }}>
              <Icon name="bowl" size={40} stroke={1.8} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>Warte auf Bestellungen</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 5, fontWeight: 500, lineHeight: 1.4 }}>
            Bleib in der Nähe der Küche. Bestellungen kommen einzeln rein.
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: `14px 16px ${SAFE_BOTTOM + 14}px`, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--surface)', borderRadius: 18, boxShadow: '0 2px 10px -4px rgba(0,0,0,.12), inset 0 0 0 1px var(--line)' }}>
          <Avatar name={DRIVER.name} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{DRIVER.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, marginTop: 1 }}>
              <Icon name="star" size={14} style={{ color: 'var(--warn)' }} /> {DRIVER.rating} · {DRIVER.vehicle}
            </div>
          </div>
          <Btn variant="secondary" size="sm" full={false} onClick={onGoOffline} style={{ width: 'auto' }}>Offline</Btn>
        </div>
      </div>
    </Screen>
  );
}

// Single incoming order with countdown
function IncomingSheet({ order, queuePos, onTour, onAccept, onDecline }) {
  const TOTAL = 15;
  const [t, setT] = React.useState(TOTAL);
  React.useEffect(() => {
    setT(TOTAL);
    const iv = setInterval(() => setT(x => { if (x <= 1) { clearInterval(iv); onDecline(); return 0; } return x - 1; }), 1000);
    return () => clearInterval(iv);
  }, [order.id]);
  const dishes = order.items.reduce((a, i) => a + i.qty, 0);
  const R = 22, C = 2 * Math.PI * R;
  return (
    <Sheet dismissable={false}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="bell" size={23} stroke={2} style={{ color: 'var(--accent)' }} className="ring-anim" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Neue Bestellung</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>
            <span className="mono">#{order.code}</span>{onTour ? ' · während Tour' : queuePos ? ` · ${queuePos}` : ''}
          </div>
        </div>
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
          <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r={R} fill="none" stroke="var(--line)" strokeWidth="5" />
            <circle cx="26" cy="26" r={R} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - t / TOTAL)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{t}</div>
        </div>
      </div>

      {/* customer + address */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, background: 'var(--surface-2)', borderRadius: 16, marginBottom: 12 }}>
        <Avatar name={order.customer} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{order.customer}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 500, marginTop: 1 }}>
            <Icon name="pin" size={14} stroke={2} style={{ color: 'var(--ink-3)' }} /> {order.address}
          </div>
        </div>
      </div>

      {/* metrics */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['cutlery', dishes + ' Gerichte'], ['route', order.distanceKm + ' km'], ['clock', '~' + order.eta + ' min']].map(([ic, val], i) => (
          <div key={i} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <Icon name={ic} size={18} stroke={2} style={{ color: 'var(--accent)' }} />
            <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 4, whiteSpace: 'nowrap' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* dish preview */}
      <div className="scroll" style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 4, marginBottom: 16, maxHeight: 150 }}>
        {order.items.map((it, i) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderBottom: i < order.items.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--accent)', flexShrink: 0 }}>{it.qty}×</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={onDecline} style={{ flex: '0 0 34%' }}>Ablehnen</Btn>
        <Btn onClick={onAccept} iconRight="arrow" style={{ flex: 1 }}>{onTour ? 'Zur Route' : 'Annehmen'}</Btn>
      </div>
    </Sheet>
  );
}

Object.assign(window, { LoginScreen, HomeScreen, IncomingSheet, BrandMark, Field });
