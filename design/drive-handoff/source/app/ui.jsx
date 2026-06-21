// ui.jsx — shared UI primitives for Drive
// Exports to window: Btn, IconBtn, Sheet, Badge, Avatar, Progress, Stepper,
//   Header, Screen, CityMap, Spinner

const SAFE_TOP = 54;
const SAFE_BOTTOM = 30;

function Btn({ children, onClick, variant = 'primary', size = 'lg', icon, iconRight, disabled, style = {}, full = true }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    width: full ? '100%' : undefined, whiteSpace: 'nowrap',
    height: size === 'lg' ? 56 : size === 'md' ? 46 : 38,
    padding: size === 'sm' ? '0 16px' : '0 22px',
    borderRadius: size === 'lg' ? 17 : 13,
    fontSize: size === 'lg' ? 18 : size === 'md' ? 16 : 14.5, fontWeight: 700,
    letterSpacing: '-0.01em',
    opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : 'auto',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: '0 6px 18px -8px var(--accent)' },
    dark: { background: 'var(--ink)', color: 'var(--bg)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1.5px var(--line)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)' },
    danger: { background: 'var(--danger-tint)', color: 'var(--danger)' },
    'danger-solid': { background: 'var(--danger)', color: '#fff' },
  };
  return (
    <button className="press" style={{ ...base, ...variants[variant], ...style }} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={size === 'lg' ? 21 : 18} stroke={2.2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 21 : 18} stroke={2.2} />}
    </button>
  );
}

function IconBtn({ name, onClick, size = 44, iconSize = 22, variant = 'surface', style = {} }) {
  const v = {
    surface: { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 3px rgba(0,0,0,.08), inset 0 0 0 1px var(--line)' },
    tint: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    plain: { background: 'transparent', color: 'var(--ink)' },
  };
  return (
    <button className="press" onClick={onClick} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...v[variant], ...style,
    }}>
      <Icon name={name} size={iconSize} stroke={2.1} />
    </button>
  );
}

function Badge({ children, tone = 'neutral', icon, style = {} }) {
  const tones = {
    neutral: { background: 'var(--surface-2)', color: 'var(--ink-2)' },
    accent: { background: 'var(--accent-tint)', color: 'var(--accent)' },
    warn: { background: 'var(--warn-tint)', color: 'var(--warn)' },
    danger: { background: 'var(--danger-tint)', color: 'var(--danger)' },
    solid: { background: 'var(--accent)', color: 'var(--on-accent)' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: icon ? '5px 11px 5px 9px' : '5px 11px', borderRadius: 9, whiteSpace: 'nowrap',
      fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1, ...tones[tone], ...style,
    }}>
      {icon && <Icon name={icon} size={14} stroke={2.4} />}
      {children}
    </span>
  );
}

function Avatar({ name, size = 44, tone }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: tone || 'var(--accent-tint)', color: tone ? '#fff' : 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36,
    }}>{initials}</div>
  );
}

function Progress({ value, max, height = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ background: 'var(--line)', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width .45s cubic-bezier(.2,.7,.2,1)' }} />
    </div>
  );
}

function Spinner({ size = 20, color = 'var(--on-accent)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${Math.max(2, size / 10)}px solid color-mix(in srgb, ${color} 30%, transparent)`,
      borderTopColor: color, animation: 'drv-spin .7s linear infinite',
    }} />
  );
}

// Transient top toast (e.g. "order added to route")
function Toast({ text }) {
  return (
    <div style={{ position: 'absolute', top: SAFE_TOP + 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 70, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 14, background: 'var(--ink)', color: 'var(--bg)', fontWeight: 700, fontSize: 14.5, boxShadow: '0 10px 30px -8px rgba(0,0,0,.4)', animation: 'drv-slide-up .3s ease' }}>
        <Icon name="check-circle" size={18} stroke={2.4} style={{ color: 'var(--accent)' }} /> {text}
      </div>
    </div>
  );
}

// Bottom sheet with dim backdrop. Children stacked; pass `dismissable` + onClose.
function Sheet({ children, onClose, dismissable = true, pad = 20 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={dismissable ? onClose : undefined}
        style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,10,.42)', animation: 'drv-fade-in .25s ease' }} />
      <div style={{
        position: 'relative', background: 'var(--surface)',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: `12px ${pad}px calc(${SAFE_BOTTOM}px + 16px)`,
        boxShadow: '0 -10px 40px rgba(0,0,0,.18)', animation: 'drv-sheet-in .34s cubic-bezier(.2,.8,.2,1)',
        maxHeight: '88%', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--line)', margin: '0 auto 10px' }} />
        {children}
      </div>
    </div>
  );
}

// App screen wrapper: handles safe-area top padding + bg
function Screen({ children, bg = 'var(--bg)', noTop = false, style = {} }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: bg,
      paddingTop: noTop ? 0 : SAFE_TOP, display: 'flex', flexDirection: 'column', ...style,
    }}>{children}</div>
  );
}

// Sticky-ish header inside a screen
function Header({ title, subtitle, left, right, onBack, transparent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 12px',
      background: transparent ? 'transparent' : 'var(--bg)', flexShrink: 0,
    }}>
      {onBack && <IconBtn name="back" onClick={onBack} size={42} iconSize={22} />}
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// ── Stylised city map ────────────────────────────────────────────────────────
// stops: [{x,y,label}] in a 0..360 / 0..H pixel space. hub: {x,y}.
function CityMap({ W = 360, H = 360, hub, stops = [], activeIndex = 0, doneIds = [], style = {}, animate = true }) {
  // deterministic street grid
  const roads = [];
  const v = [40, 96, 150, 210, 268, 320];
  const h = [50, 110, 175, 240, 300];
  v.forEach((x, i) => roads.push({ x1: x, y1: 0, x2: x + (i % 2 ? 14 : -10), y2: H, w: i % 3 === 0 ? 13 : 7 }));
  h.forEach((y, i) => roads.push({ x1: 0, y1: y, x2: W, y2: y + (i % 2 ? -8 : 10), w: i % 2 === 0 ? 12 : 6 }));
  // path through hub -> stops in order
  const pts = [hub, ...stops];
  const pathD = pts.map((pt, i) => `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '100%', ...style }}>
      <rect x="0" y="0" width={W} height={H} fill="var(--map-bg)" />
      {/* parks / blocks */}
      <rect x="200" y="60" width="120" height="86" rx="10" fill="var(--map-park)" />
      <rect x="22" y="196" width="92" height="78" rx="10" fill="var(--map-park)" />
      {[[55,18],[120,18],[170,80],[250,170],[60,250],[150,250],[260,260],[30,80]].map(([bx,by],i)=>(
        <rect key={i} x={bx} y={by} width={i%2?52:40} height={i%3?44:60} rx="7" fill="var(--map-block)" opacity="0.8" />
      ))}
      {/* roads */}
      {roads.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="var(--map-road)" strokeWidth={r.w} strokeLinecap="round" />
      ))}
      {/* route casing + line */}
      <path d={pathD} fill="none" stroke="color-mix(in srgb, var(--accent) 22%, transparent)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="2 10" style={animate ? { animation: 'drv-dash 30s linear infinite' } : {}} />
      {/* hub */}
      <g>
        <circle cx={hub.x} cy={hub.y} r="9" fill="var(--ink)" />
        <circle cx={hub.x} cy={hub.y} r="3.4" fill="var(--bg)" />
      </g>
      {/* stops */}
      {stops.map((s, i) => {
        const done = doneIds.includes(s.id);
        const active = i === activeIndex;
        const r = active ? 16 : 13;
        return (
          <g key={i}>
            {active && <circle cx={s.x} cy={s.y} r="16" fill="var(--accent)" style={{ animation: 'drv-pulse 2s ease-out infinite' }} />}
            <path d={`M ${s.x} ${s.y + r + 6} C ${s.x - r} ${s.y + 2}, ${s.x - r} ${s.y - r}, ${s.x} ${s.y - r} S ${s.x + r} ${s.y + 2}, ${s.x} ${s.y + r + 6} Z`}
              fill={done ? 'var(--ink-3)' : active ? 'var(--accent)' : 'var(--surface)'} stroke={done || active ? 'none' : 'var(--ink)'} strokeWidth="2" />
            <circle cx={s.x} cy={s.y - r / 2 - 1} r={r * 0.55} fill={done || active ? (done ? 'var(--bg)' : 'var(--on-accent)') : 'var(--ink)'}
              opacity={done ? 0.9 : 1} />
            <text x={s.x} y={s.y - r / 2 + 2.5} textAnchor="middle" fontSize={active ? 13 : 11} fontWeight="800"
              fill={done ? 'var(--ink-3)' : active ? 'var(--accent)' : 'var(--surface)'} fontFamily="'JetBrains Mono', monospace">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, { Btn, IconBtn, Badge, Avatar, Progress, Spinner, Toast, Sheet, Screen, Header, CityMap, SAFE_TOP, SAFE_BOTTOM });
