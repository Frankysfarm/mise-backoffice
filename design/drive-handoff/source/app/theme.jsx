// theme.jsx — Drive design system: color worlds, global CSS, icon set
// Exports to window: THEMES, DriveStyle, Icon

const THEMES = {
  wald: {
    label: 'Wald', dark: false,
    vars: {
      '--accent': '#0F9C50', '--accent-press': '#0B7E40', '--on-accent': '#FFFFFF',
      '--accent-tint': '#E6F4EC',
      '--bg': '#F2F4F2', '--surface': '#FFFFFF', '--surface-2': '#F6F8F6',
      '--ink': '#0B0F0D', '--ink-2': '#586460', '--ink-3': '#909893',
      '--line': '#E5E9E6', '--line-2': '#EFF2F0',
      '--danger': '#E5484D', '--danger-tint': '#FCEBEC',
      '--warn': '#E07C0B', '--warn-tint': '#FBF0DF',
      '--map-bg': '#E7ECE7', '--map-block': '#DBE2DC', '--map-road': '#FFFFFF', '--map-park': '#D5E6D8',
    },
  },
  mitternacht: {
    label: 'Mitternacht', dark: true,
    vars: {
      '--accent': '#35D67E', '--accent-press': '#2BBA6B', '--on-accent': '#062012',
      '--accent-tint': '#14271C',
      '--bg': '#0B0F0D', '--surface': '#161B18', '--surface-2': '#1D231F',
      '--ink': '#F3F6F4', '--ink-2': '#9BA7A1', '--ink-3': '#6A746E',
      '--line': '#262D29', '--line-2': '#1F2622',
      '--danger': '#FF6066', '--danger-tint': '#2A1719',
      '--warn': '#F5A623', '--warn-tint': '#2A2113',
      '--map-bg': '#0E1310', '--map-block': '#171D19', '--map-road': '#222A25', '--map-park': '#13221A',
    },
  },
  sonne: {
    label: 'Sonne', dark: false,
    vars: {
      '--accent': '#F2581B', '--accent-press': '#D4470F', '--on-accent': '#FFFFFF',
      '--accent-tint': '#FCEBE2',
      '--bg': '#F6F3F0', '--surface': '#FFFFFF', '--surface-2': '#FAF7F4',
      '--ink': '#1A1310', '--ink-2': '#6B5F58', '--ink-3': '#9C8F86',
      '--line': '#ECE6E1', '--line-2': '#F4EFEA',
      '--danger': '#D83A3F', '--danger-tint': '#FBEAEA',
      '--warn': '#D98208', '--warn-tint': '#FBF0DD',
      '--map-bg': '#EFEAE4', '--map-block': '#E5DDD4', '--map-road': '#FFFFFF', '--map-park': '#E2E8D4',
    },
  },
  elektrik: {
    label: 'Elektrik', dark: false,
    vars: {
      '--accent': '#2563EB', '--accent-press': '#1D4FD0', '--on-accent': '#FFFFFF',
      '--accent-tint': '#E5EDFD',
      '--bg': '#F1F4F9', '--surface': '#FFFFFF', '--surface-2': '#F6F8FC',
      '--ink': '#0C1220', '--ink-2': '#566179', '--ink-3': '#8A93A6',
      '--line': '#E4E8F0', '--line-2': '#EDF0F6',
      '--danger': '#E5484D', '--danger-tint': '#FCEBEC',
      '--warn': '#E0820B', '--warn-tint': '#FBF0DF',
      '--map-bg': '#E6ECF5', '--map-block': '#DAE2EE', '--map-road': '#FFFFFF', '--map-park': '#D5E4DC',
    },
  },
};

function DriveStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
      .drive * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      .drive {
        font-family: 'Hanken Grotesk', -apple-system, system-ui, sans-serif;
        color: var(--ink);
        height: 100%;
        position: relative;
        background: var(--bg);
        letter-spacing: -0.01em;
      }
      .drive .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: -0.02em; }
      .drive button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
      .drive .scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .drive .scroll::-webkit-scrollbar { display: none; }
      .drive .press { transition: transform .12s ease, opacity .12s ease, background .15s ease; }
      .drive .press:active { transform: scale(0.97); }
      .drive .tap:active { opacity: 0.6; }
      @keyframes drv-sheet-in { from { transform: translateY(40px); } to { transform: translateY(0); } }
      @keyframes drv-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes drv-pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
      @keyframes drv-pulse { 0% { box-shadow: 0 0 0 0 var(--accent); opacity: .55; } 70% { box-shadow: 0 0 0 22px transparent; opacity: 0; } 100% { opacity: 0; } }
      @keyframes drv-dash { to { stroke-dashoffset: -1000; } }
      @keyframes drv-slide-up { from { transform: translateY(18px); } to { transform: translateY(0); } }
      @keyframes drv-spin { to { transform: rotate(360deg); } }
      @keyframes drv-ring { 0%,100% { transform: rotate(-8deg); } 25% { transform: rotate(8deg); } 50% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
      .drive .ring-anim { animation: drv-ring 1s ease-in-out infinite; transform-origin: 50% 15%; }
    `}</style>
  );
}

// ── Icon set — clean 24px stroke icons, color via currentColor ───────────────
function Icon({ name, size = 24, stroke = 2, style = {}, className }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    check: <polyline points="4 12.5 9.5 18 20 6" {...p} />,
    'check-circle': <><circle cx="12" cy="12" r="9.5" {...p} /><polyline points="8 12.3 11 15.2 16.2 9" {...p} /></>,
    chevron: <polyline points="9 5 16 12 9 19" {...p} />,
    'chevron-down': <polyline points="5 9 12 16 19 9" {...p} />,
    back: <polyline points="15 5 8 12 15 19" {...p} />,
    close: <><line x1="6" y1="6" x2="18" y2="18" {...p} /><line x1="18" y1="6" x2="6" y2="18" {...p} /></>,
    phone: <path d="M5 4h3.5l1.5 4-2 1.4a12 12 0 0 0 5.1 5.1l1.4-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4.5 6.6 1.5 1.5 0 0 1 6 5z" {...p} />,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2.2" {...p} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>,
    user: <><circle cx="12" cy="8.5" r="3.6" {...p} /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" {...p} /></>,
    box: <><path d="M12 3 4 7v10l8 4 8-4V7z" {...p} /><path d="M4 7l8 4 8-4M12 11v10" {...p} /></>,
    bag: <><path d="M6 8h12l-1 12H7z" {...p} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /></>,
    bag2: <><path d="M6.5 8h11l1 11a1.5 1.5 0 0 1-1.5 1.6H7a1.5 1.5 0 0 1-1.5-1.6z" {...p} /><path d="M8.5 8 10 4h4l1.5 4" {...p} /></>,
    bowl: <><path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" {...p} /><path d="M9 4.5c0 1.3-1 1.6-1 2.7S9 8.7 9 8.7M13 4.5c0 1.3-1 1.6-1 2.7s1 1.5 1 1.5" {...p} /></>,
    cup: <><path d="M7 8h10l-1.1 11.2a1.5 1.5 0 0 1-1.5 1.3H9.6a1.5 1.5 0 0 1-1.5-1.3z" {...p} /><line x1="13.5" y1="3" x2="15" y2="8" {...p} /><line x1="8.4" y1="12" x2="15.6" y2="12" {...p} /></>,
    dessert: <><path d="M5.5 11h13l-1.3 8.2a1 1 0 0 1-1 .8H7.8a1 1 0 0 1-1-.8z" {...p} /><path d="M6 11a6 6 0 0 1 12 0" {...p} /><line x1="12" y1="3" x2="12" y2="6" {...p} /></>,
    cutlery: <><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" {...p} /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5zM16 12v9" {...p} /></>,
    pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" {...p} /><circle cx="12" cy="10" r="2.5" {...p} /></>,
    'pin-fill': <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" fill="currentColor" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /><circle cx="12" cy="10" r="2.4" fill="var(--surface)" stroke="none" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" {...p} /><polyline points="12 7.5 12 12 15 14" {...p} /></>,
    nav: <path d="M12 3 20 20l-8-4-8 4z" {...p} />,
    route: <><circle cx="6" cy="18" r="2.4" {...p} /><circle cx="18" cy="6" r="2.4" {...p} /><path d="M8.2 17.2 14 11c2-2 .7-4.5-2-4.5H7.5" {...p} /></>,
    power: <><path d="M12 3v8" {...p} /><path d="M6.5 6.5a8 8 0 1 0 11 0" {...p} /></>,
    bolt: <path d="M13 3 5 13h5l-1 8 8-10h-5z" {...p} />,
    scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...p} /><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" {...p} /><line x1="5" y1="12" x2="19" y2="12" {...p} /></>,
    minus: <line x1="5" y1="12" x2="19" y2="12" {...p} />,
    list: <><line x1="8" y1="7" x2="20" y2="7" {...p} /><line x1="8" y1="12" x2="20" y2="12" {...p} /><line x1="8" y1="17" x2="20" y2="17" {...p} /><circle cx="4" cy="7" r="1.1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="4" cy="17" r="1.1" fill="currentColor" stroke="none" /></>,
    alert: <><path d="M12 4 2.5 20h19z" {...p} /><line x1="12" y1="10" x2="12" y2="14" {...p} /><circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" /></>,
    bell: <><path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2.5h-15z" {...p} /><path d="M10 19a2 2 0 0 0 4 0" {...p} /></>,
    star: <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 21.5 6.9 19l1.1-5.7-4.3-4 5.8-.7z" {...p} />,
    truck: <><path d="M3 6h11v9H3z" {...p} /><path d="M14 9h4l3 3v3h-7z" {...p} /><circle cx="7" cy="18" r="1.8" {...p} /><circle cx="17" cy="18" r="1.8" {...p} /></>,
    temp: <><path d="M10 13.5V6a2 2 0 1 1 4 0v7.5a4 4 0 1 1-4 0z" {...p} /></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12" {...p} /><polyline points="13 6 19 12 13 18" {...p} /></>,
    home: <><path d="M4 11l8-7 8 7" {...p} /><path d="M6 9.5V20h12V9.5" {...p} /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

Object.assign(window, { THEMES, DriveStyle, Icon });
