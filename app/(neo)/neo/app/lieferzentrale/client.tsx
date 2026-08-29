'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  advanceOrder, rejectOrder,
  getDriverPositions, getActiveBatches, getOrdersForKanban,
  getHealthStats, getStaleOrders,
  cancelBatch, reassignBatch, reorderBatchStop,
  getDispatchConfig, setDispatchConfig, getOnlineDrivers,
  triggerSmartDispatch,
} from './actions';
import type { StaleOrder } from './actions';

type DriverPos = {
  id: string; name: string; vehicle: string; state: string;
  last_lat: number | null; last_lng: number | null; last_position_at: string | null;
  gps_stale?: boolean; gps_stale_2min?: boolean; pos_age_sec?: number | null;
  overdue?: boolean; stationary?: boolean;
  next_stop?: { lat: number; lng: number; sequence: number } | null;
};

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css'; css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve(w.L)); return; }
    const s = document.createElement('script');
    s.id = 'leaflet-js'; s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(w.L);
    document.body.appendChild(s);
  });
}

const STATE_LABELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  offline:       { label: 'Offline',       color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' },
  idle:          { label: 'Verfügbar',     color: '#047857', bg: '#ECFDF5', dot: '#10B981' },
  at_restaurant: { label: 'Am Restaurant', color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  delivering:    { label: 'Unterwegs',     color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  returning:     { label: 'Auf Rueckweg', color: '#7C3AED', bg: '#F5F3FF', dot: '#8B5CF6' },
  assigned:      { label: 'Zugewiesen',   color: '#7C3AED', bg: '#F5F3FF', dot: '#8B5CF6' },
  in_progress:   { label: 'Unterwegs',    color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
};
function stateInfo(s: string) { return STATE_LABELS[s] ?? { label: s, color: '#334155', bg: '#F1F5F9', dot: '#64748B' }; }

function staleness(posAt: string | null): string {
  if (!posAt) return 'Kein Signal';
  const sec = Math.floor((Date.now() - new Date(posAt).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  return `${Math.floor(sec / 3600)}h`;
}

function stalenessMins(posAt: string | null): number | null {
  if (!posAt) return null;
  return Math.floor((Date.now() - new Date(posAt).getTime()) / 60000);
}

// ─── SEKTION B: Health Bar ─────────────────────────────────────────────────
export function HealthBar() {
  const [stats, setStats] = useState<{
    avgDeliveryMin: number | null;
    onTimePct: number | null;
    onlineDrivers: number;
    waitingOrders: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getHealthStats();
      setStats(s);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!stats) return null;

  const chips = [
    {
      label: stats.avgDeliveryMin != null ? `${stats.avgDeliveryMin} min` : '--',
      sub: 'Lieferzeit',
      bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', color: '#1D4ED8',
    },
    {
      label: stats.onTimePct != null ? `${stats.onTimePct}%` : '--',
      sub: 'On-Time',
      bg: (stats.onTimePct ?? 0) >= 80 ? '#F0FDF4' : '#FEF9C3',
      border: (stats.onTimePct ?? 0) >= 80 ? '#86EFAC' : '#FDE047',
      dot: (stats.onTimePct ?? 0) >= 80 ? '#10B981' : '#EAB308',
      color: (stats.onTimePct ?? 0) >= 80 ? '#047857' : '#854D0E',
    },
    {
      label: `${stats.onlineDrivers}`,
      sub: 'Fahrer online',
      bg: '#ECFDF5', border: '#A7F3D0', dot: '#10B981', color: '#047857',
    },
    {
      label: `${stats.waitingOrders}`,
      sub: 'Warten',
      bg: stats.waitingOrders > 0 ? '#FEF2F2' : '#F8FAFC',
      border: stats.waitingOrders > 0 ? '#FECACA' : '#E2E8F0',
      dot: stats.waitingOrders > 0 ? '#DC2626' : '#94A3B8',
      color: stats.waitingOrders > 0 ? '#991B1B' : '#64748B',
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {chips.map((c) => (
        <div key={c.sub} style={{ display: 'flex', alignItems: 'center', gap: 7, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '7px 12px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.label}</div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600, marginTop: 1 }}>{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SEKTION A: Dispatch Controls ─────────────────────────────────────────
export function DispatchControls() {
  const [preset, setPreset] = useState<'speed' | 'balance' | 'spar'>('balance');
  const [holdMin, setHoldMin] = useState(5);
  const [saving, setSaving] = useState(false);
  const [staleOrders, setStaleOrders] = useState<StaleOrder[]>([]);
  const [loadingStale, setLoadingStale] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getDispatchConfig();
        if (cfg) {
          setPreset(cfg.preset as any);
          setHoldMin(cfg.hold_window_min ?? 5);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const loadStale = useCallback(async () => {
    setLoadingStale(true);
    try {
      const orders = await getStaleOrders();
      setStaleOrders(orders);
    } catch { /* silent */ } finally {
      setLoadingStale(false);
    }
  }, []);

  useEffect(() => { loadStale(); }, [loadStale]);
  useEffect(() => {
    const id = setInterval(loadStale, 30_000);
    return () => clearInterval(id);
  }, [loadStale]);

  const saveConfig = async (newPreset?: typeof preset, newHold?: number) => {
    setSaving(true);
    try {
      await setDispatchConfig(newPreset ?? preset, newHold ?? holdMin);
    } catch (e: any) {
      alert('Fehler: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = async (p: typeof preset) => {
    setPreset(p);
    await saveConfig(p, holdMin);
  };

  const handleHold = async (v: number) => {
    setHoldMin(v);
    await saveConfig(preset, v);
  };

  const handleTriggerDispatch = async (orderId: string) => {
    setDispatching(orderId);
    setDispatchMsg(null);
    try {
      const res = await triggerSmartDispatch();
      setDispatchMsg(res.ok ? 'Dispatch ausgeloest.' : ('Fehler: ' + res.message));
      if (res.ok) await loadStale();
    } catch (e: any) {
      setDispatchMsg('Fehler: ' + (e?.message || e));
    } finally {
      setDispatching(null);
    }
  };

  const PRESETS = [
    { key: 'speed' as const, label: 'Speed', icon: '⚡', desc: 'Sofort dispatchen' },
    { key: 'balance' as const, label: 'Balance', icon: '⚖️', desc: 'Buendeln wenn moeglich' },
    { key: 'spar' as const, label: 'Spar', icon: '🟢', desc: 'Max. buendeln' },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
          Dispatch Steuerung
        </h3>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Strategie, Wartefenster und manuelle Zuweisung</p>
      </div>

      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Strategy Picker */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>Strategie</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                disabled={saving}
                onClick={() => handlePreset(p.key)}
                style={{
                  flex: 1, padding: '10px 8px', border: `2px solid ${preset === p.key ? '#4F46E5' : '#E2E8F0'}`,
                  borderRadius: 12, background: preset === p.key ? '#EEF2FF' : '#F8FAFC',
                  cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 3 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: preset === p.key ? '#4338CA' : '#334155' }}>{p.label}</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Hold-Window Slider */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>Max. Warte-Zeit fuer Buendeln</div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#4F46E5', minWidth: 48, textAlign: 'right' }}>{holdMin} min</span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            value={holdMin}
            onChange={(e) => setHoldMin(Number(e.target.value))}
            onMouseUp={() => handleHold(holdMin)}
            onTouchEnd={() => handleHold(holdMin)}
            style={{ width: '100%', accentColor: '#4F46E5' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#CBD5E1', marginTop: 2 }}>
            <span>0 min</span><span>15 min</span>
          </div>
        </div>

        {/* Stale Orders */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Wartende Bestellungen
              {staleOrders.length > 0 && (
                <span style={{ marginLeft: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: '#DC2626', padding: '1px 7px' }}>
                  {staleOrders.length}
                </span>
              )}
            </div>
            <button
              onClick={loadStale}
              disabled={loadingStale}
              style={{ fontSize: 11.5, fontWeight: 700, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {loadingStale ? 'Laden...' : 'Aktualisieren'}
            </button>
          </div>

          {dispatchMsg && (
            <div style={{
              fontSize: 12,
              color: dispatchMsg.startsWith('Fehler') ? '#DC2626' : '#047857',
              background: dispatchMsg.startsWith('Fehler') ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${dispatchMsg.startsWith('Fehler') ? '#FECACA' : '#86EFAC'}`,
              borderRadius: 8, padding: '6px 10px', marginBottom: 8
            }}>
              {dispatchMsg}
            </div>
          )}

          {staleOrders.length === 0 ? (
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>Keine wartenden Bestellungen</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {staleOrders.map((o) => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: o.waitMin >= 10 ? '#FEF2F2' : '#FFF7ED',
                  border: `1px solid ${o.waitMin >= 10 ? '#FECACA' : '#FED7AA'}`,
                  borderRadius: 10, padding: '9px 12px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      #{String(o.bestellnummer ?? '').slice(-4) || '----'} {o.kunde_name ? `· ${o.kunde_name}` : ''}
                    </div>
                    {o.address && (
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.address}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: o.waitMin >= 10 ? '#DC2626' : '#92400E' }}>{o.waitMin} min</div>
                  </div>
                  <button
                    disabled={dispatching === o.id}
                    onClick={() => handleTriggerDispatch(o.id)}
                    style={{
                      height: 32, padding: '0 12px', border: 'none', borderRadius: 8,
                      background: '#4F46E5', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', flexShrink: 0, opacity: dispatching === o.id ? .6 : 1
                    }}
                  >
                    {dispatching === o.id ? '...' : 'Jetzt zuweisen'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function FahrerLiveMap({ initial, center, locationId }: { initial: DriverPos[]; center: { lat: number | null; lng: number | null }; locationId?: string }) {
  const [drivers, setDrivers] = useState<DriverPos[]>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<Map<string, any>>(new Map());
  const LRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const fresh = await getDriverPositions();
      setDrivers(fresh);
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const defCenter = center.lat != null && center.lng != null ? [center.lat, center.lng] : [51.16, 10.45];
    loadLeaflet().then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: false }).setView(defCenter, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const seen = new Set<string>();
    for (const d of drivers) {
      if (d.last_lat == null || d.last_lng == null) continue;
      seen.add(d.id);
      const si = stateInfo(d.state);
      const mins = stalenessMins(d.last_position_at);
      const isStale2min = (mins !== null && mins >= 2 && d.state !== 'offline') || d.gps_stale_2min;
      const alertColor = d.overdue ? '#DC2626' : d.stationary ? '#F59E0B' : isStale2min ? '#F97316' : si.dot;

      const staleWarning = isStale2min && !d.overdue && !d.stationary
        ? '<div style="position:absolute;top:-10px;right:-10px;width:16px;height:16px;background:#F97316;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#fff;line-height:1">!</div>'
        : '';

      const icon = L.divIcon({
        html: `<div style="position:relative;width:18px;height:18px"><div style="background:${alertColor};width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)${d.overdue ? ';animation:pulse 1s infinite' : ''};position:absolute;top:2px;left:2px"></div>${staleWarning}</div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const alertHtml = d.overdue
        ? '<br><span style="color:#DC2626;font-weight:700">Ueberfaellig</span>'
        : d.stationary
        ? '<br><span style="color:#F59E0B;font-weight:700">Stationaer</span>'
        : isStale2min
        ? `<br><span style="color:#F97316;font-weight:700">GPS ${mins}min alt</span>`
        : d.gps_stale
        ? '<br><span style="color:#F59E0B;font-weight:700">Kein GPS</span>'
        : '';

      const vehicleIcon = d.vehicle === 'bicycle' ? '🚲' : d.vehicle === 'scooter' ? '🛵' : d.vehicle === 'car' ? '🚗' : '🏍';
      const popupContent = `<div style="font-family:system-ui;font-size:13px;min-width:160px"><b style="font-size:14px">${d.name || 'Fahrer'}</b> ${vehicleIcon}<br><span style="color:${si.color};font-weight:700">${si.label}</span>${alertHtml}<br><span style="color:#94A3B8;font-size:11px">GPS: ${staleness(d.last_position_at)}</span></div>`;

      const existing = markersRef.current.get(d.id);
      if (existing) {
        existing.setLatLng([d.last_lat, d.last_lng]);
        existing.setIcon(icon);
        existing.setPopupContent(popupContent);
      } else {
        const m = L.marker([d.last_lat, d.last_lng], { icon }).addTo(map).bindPopup(popupContent);
        markersRef.current.set(d.id, m);
      }

      const existingLine = polylinesRef.current.get(d.id);
      if (d.next_stop?.lat != null && d.next_stop?.lng != null) {
        const coords: [number, number][] = [
          [d.last_lat, d.last_lng],
          [d.next_stop.lat, d.next_stop.lng],
        ];
        if (existingLine) {
          existingLine.setLatLngs(coords);
        } else {
          const line = L.polyline(coords, { color: alertColor, weight: 2.5, opacity: 0.65, dashArray: '6 4' }).addTo(map);
          polylinesRef.current.set(d.id, line);
        }
      } else if (existingLine) {
        map.removeLayer(existingLine);
        polylinesRef.current.delete(d.id);
      }
    }

    for (const [id, m] of Array.from(markersRef.current.entries())) {
      if (!seen.has(id)) { map.removeLayer(m); markersRef.current.delete(id); }
    }
    for (const [id, line] of Array.from(polylinesRef.current.entries())) {
      if (!seen.has(id)) { map.removeLayer(line); polylinesRef.current.delete(id); }
    }
  }, [drivers]);

  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const active = drivers.filter((d) => d.state !== 'offline' && d.last_lat != null);
  const all = drivers.filter((d) => d.last_lat != null || d.state !== 'offline');
  const alerts = drivers.filter((d) => d.overdue || d.stationary || d.gps_stale || d.gps_stale_2min);

  if (drivers.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Fahrer Live
            <span style={{ fontWeight: 500, color: '#94A3B8' }}> &middot; {active.length} aktiv</span>
          </h3>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>Positionen werden alle 15 s aktualisiert</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              height: 34, padding: '0 14px', border: '1px solid #E2E8F0', borderRadius: 9,
              background: refreshing ? '#F1F5F9' : '#fff', color: '#334155', fontSize: 13,
              fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}>
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? 'Laden...' : 'Neu laden'}
          </button>
          {all.map((d) => {
            const si = stateInfo(d.state);
            const mins = stalenessMins(d.last_position_at);
            const isStale2min = (mins !== null && mins >= 2 && d.state !== 'offline') || d.gps_stale_2min;
            const hasAlert = d.overdue || d.stationary || d.gps_stale || isStale2min;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: hasAlert ? '#FEF2F2' : si.bg, border: `1px solid ${hasAlert ? '#FECACA' : si.dot + '30'}`, borderRadius: 10, padding: '5px 10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasAlert ? (isStale2min && !d.overdue ? '#F97316' : '#DC2626') : si.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: hasAlert ? (isStale2min && !d.overdue ? '#C2410C' : '#DC2626') : si.color }}>{d.name || 'Fahrer'}</span>
                {hasAlert && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isStale2min && !d.overdue ? '#C2410C' : '#DC2626' }}>
                    {d.overdue ? 'ueberfaellig' : d.stationary ? 'stationaer' : isStale2min ? `GPS ${mins}min alt` : 'kein GPS'}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{staleness(d.last_position_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {alerts.length > 0 && (
        <div style={{ borderTop: '1px solid #FEE2E2', background: '#FEF2F2', padding: '10px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {alerts.map((d) => {
            const mins = stalenessMins(d.last_position_at);
            const isStale2min = (mins !== null && mins >= 2 && d.state !== 'offline') || d.gps_stale_2min;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#991B1B' }}>
                <span style={{ fontWeight: 700 }}>{d.name || 'Fahrer'}:</span>
                <span>
                  {d.overdue
                    ? 'Lieferung ueberfaellig'
                    : d.stationary
                    ? 'Seit mehr als 10 Min stationaer'
                    : isStale2min
                    ? `GPS-Signal vor ${mins} Min`
                    : 'Kein GPS-Signal seit mehr als 5 Min'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div ref={mapEl} style={{ height: 260, background: '#E5E7EB', zIndex: 1 }} />
    </div>
  );
}

const eur = (n: number) => Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

function waitingMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

const COLS = [
  { title: 'Neu', dot: '#F59E0B', match: ['neu', 'bestätigt'], next: 'in_zubereitung', btn: 'Annehmen', btnBg: '#4F46E5', btnColor: '#fff', canReject: true },
  { title: 'In Vorbereitung', dot: '#4F46E5', match: ['in_zubereitung', 'teilweise_fertig'], next: 'fertig', btn: 'Fertig', btnBg: '#12B85C', btnColor: '#fff', canReject: false },
  { title: 'Bereit', dot: '#10B981', match: ['fertig', 'abholbereit'], next: 'unterwegs', btn: 'Ausgeben', btnBg: '#1D4ED8', btnColor: '#fff', canReject: false },
  { title: 'Ausgabe', dot: '#1D4ED8', match: ['unterwegs', 'wird_serviert'], next: 'geliefert', btn: 'Erledigt', btnBg: '#0F172A', btnColor: '#fff', canReject: false },
  { title: 'Tischabschluss', dot: '#7C3AED', match: ['serviert', 'bezahlt'], next: 'bezahlt', btn: 'Bezahlen', btnBg: '#7C3AED', btnColor: '#fff', canReject: false },
];

function orderNext(order: any, fallback: string) {
  if (order.typ !== 'vor_ort') return fallback;
  return ({ neu: 'in_zubereitung', bestätigt: 'in_zubereitung', in_zubereitung: 'abholbereit', teilweise_fertig: 'abholbereit', fertig: 'abholbereit', abholbereit: 'wird_serviert', wird_serviert: 'serviert', serviert: 'bezahlt', bezahlt: 'abgeschlossen' } as Record<string, string>)[order.status] ?? fallback;
}

function orderActionLabel(order: any, fallback: string) {
  if (order.typ !== 'vor_ort') return fallback;
  return ({ neu: 'Annehmen', bestätigt: 'Vorbereiten', in_zubereitung: 'Abholbereit', teilweise_fertig: 'Abholbereit', fertig: 'Abholbereit', abholbereit: 'Servieren', wird_serviert: 'Serviert', serviert: 'Als bezahlt', bezahlt: 'Abschließen' } as Record<string, string>)[order.status] ?? fallback;
}

export function CopyBtn({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}
      style={{ height: 40, padding: '0 16px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, background: 'rgba(255,255,255,.08)', color: '#E0E7FF', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
    >
      {copied ? 'Kopiert' : 'Link kopieren'}
    </button>
  );
}

export function Kanban({ orders: initialOrders, locationId }: { orders: any[]; locationId: string }) {
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!locationId) return;
    try {
      setRefreshing(true);
      const fresh = await getOrdersForKanban(locationId);
      setOrders(fresh);
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    const id = setInterval(refreshOrders, 30_000);
    return () => clearInterval(id);
  }, [refreshOrders]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusy(id);
    try { await fn(); await refreshOrders(); } catch (e: any) { alert('Fehler: ' + (e?.message || e)); } finally { setBusy(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Bestellungen</span>
        <button
          onClick={refreshOrders}
          disabled={refreshing}
          style={{ height: 32, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {refreshing ? 'Laden...' : 'Neu laden'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, alignItems: 'start' }}>
        {COLS.map((col) => {
          const cards = orders.filter((o) => col.match.includes(o.status));
          return (
            <div key={col.title} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12, minHeight: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{col.title}</span>
                </div>
                <span style={{ background: '#fff', border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, color: '#64748B', borderRadius: 999, minWidth: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{cards.length}</span>
              </div>
              {cards.map((o) => {
                const liefer = o.typ === 'lieferung';
                const paid = !!o.bezahlt;
                const hasVoucher = o.voucher_rabatt > 0;
                const hasReward = o.reward_items_count > 0;
                const waitingMins = col.title === 'Bereit' && liefer && !o.mise_batch_id && !o.mise_driver_id && o.created_at
                  ? waitingMinutes(o.created_at)
                  : null;
                const waitingLong = waitingMins !== null && waitingMins >= 10;
                return (
                  <div key={o.id} style={{ background: '#fff', border: `1px solid ${waitingLong ? '#FECACA' : '#E2E8F0'}`, borderRadius: 12, padding: 13, marginBottom: 10, boxShadow: waitingLong ? '0 0 0 2px #FCA5A5' : '0 1px 2px rgba(15,23,42,.04)', opacity: busy === o.id ? .5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                      <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: '#0F172A' }}>#{String(o.bestellnummer || '').slice(-4) || '----'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: liefer ? '#1D4ED8' : '#047857', background: liefer ? '#EFF6FF' : '#ECFDF5', borderRadius: 6, padding: '2px 7px' }}>{liefer ? 'Lieferung' : 'Abholung'}</span>
                    </div>
                    {waitingMins !== null && waitingMins >= 2 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: waitingLong ? '#FEF2F2' : '#FFF7ED', border: `1px solid ${waitingLong ? '#FECACA' : '#FED7AA'}`, borderRadius: 8, padding: '5px 9px', marginBottom: 8 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: waitingLong ? '#991B1B' : '#92400E' }}>
                          Warte auf Fahrer seit {waitingMins} min{waitingLong && ' -- dringend!'}
                        </span>
                      </div>
                    )}
                    {hasVoucher && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 8, padding: '5px 9px', marginBottom: 8 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#854D0E' }}>
                          -{eur(o.voucher_rabatt)} Rabatt{o.voucher_code ? ` (${o.voucher_code})` : ''}
                        </span>
                      </div>
                    )}
                    {hasReward && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '5px 9px', marginBottom: 8 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534' }}>
                          {o.reward_items_count === 1 ? '1 Gratis-Produkt' : `${o.reward_items_count}x Gratis-Produkt`} (Treueprogramm)
                        </span>
                      </div>
                    )}
                    <div style={{ marginBottom: 10 }}>
                      {(o.items ?? []).slice(0, 5).map((li: any, i: number) => {
                        const isGratis = li.einzelpreis === 0 || (li.notiz && li.notiz.toLowerCase().includes('gratis'));
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#475569', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: isGratis ? '#16A34A' : '#4F46E5', minWidth: 20 }}>{li.menge}x</span>
                            <span style={{ flex: 1 }}>{li.name}</span>
                            {isGratis && <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>GRATIS</span>}
                          </div>
                        );
                      })}
                      {(o.items ?? []).length > 5 && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>+{o.items.length - 5} weitere</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid #F1F5F9', marginBottom: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: paid ? '#10B981' : '#F59E0B' }} />
                        <span style={{ fontSize: 12, color: '#64748B' }}>{paid ? 'Bezahlt' : 'Offen'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        {hasVoucher && o.zwischensumme > 0 && (
                          <span style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>{eur(o.zwischensumme)}</span>
                        )}
                        <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{eur(o.gesamtbetrag)}</span>
                      </div>
                    </div>
                    {o.kunde_name && <div style={{ marginBottom: 10, fontSize: 12, color: '#94A3B8' }}>{o.kunde_name}</div>}
                    <div style={{ display: 'flex', gap: 7 }}>
                      {col.canReject && (
                        <button disabled={busy === o.id} onClick={() => act(() => rejectOrder(o.id), o.id)} style={{ width: 38, height: 36, border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 9, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                          x
                        </button>
                      )}
                      <button disabled={busy === o.id} onClick={() => act(() => advanceOrder(o.id, orderNext(o, col.next)), o.id)} style={{ flex: 1, height: 36, border: 'none', borderRadius: 9, background: col.btnBg, color: col.btnColor, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{orderActionLabel(o, col.btn)}</button>
                    </div>
                  </div>
                );
              })}
              {cards.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#CBD5E1' }}>Keine Bestellungen</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BatchPanel mit SEKTION C: Batch-Aktionen ─────────────────────────────

const BATCH_STATE: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending_acceptance: { label: 'Warte auf Bestätigung', color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  assigned:           { label: 'Fahrer fährt zum Restaurant', color: '#7C3AED', bg: '#F5F3FF', dot: '#8B5CF6' },
  at_restaurant:      { label: 'Am Restaurant', color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  picked_up:          { label: 'Abgeholt -- unterwegs', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  in_progress:        { label: 'Unterwegs', color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
};

function elapsed(ts: string | null): string {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}min`;
}

function BatchActions({ batch, onRefresh }: { batch: any; onRefresh: () => void }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [onlineDrivers, setOnlineDrivers] = useState<{ id: string; name: string; vehicle: string; state: string }[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    getOnlineDrivers().then(setOnlineDrivers).catch(() => {});
  }, []);

  const dropoffs = ((batch.stops ?? []) as any[])
    .filter((s: any) => s.type === 'dropoff')
    .sort((a: any, z: any) => a.sequence - z.sequence);

  const handleCancel = async () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    setBusy('cancel');
    try {
      await cancelBatch(batch.id);
      onRefresh();
    } catch (e: any) {
      alert('Storno fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedDriver) return;
    setBusy('reassign');
    try {
      await reassignBatch(batch.id, selectedDriver);
      setSelectedDriver('');
      onRefresh();
    } catch (e: any) {
      alert('Fahrerwechsel fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const handleMoveStop = async (stop: any, direction: 'up' | 'down', allStops: any[]) => {
    const idx = allStops.findIndex((s: any) => s.id === stop.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === allStops.length - 1) return;
    setBusy('reorder-' + stop.id);
    setReorderError(null);
    try {
      const swapWith = allStops[direction === 'up' ? idx - 1 : idx + 1];
      await Promise.all([
        reorderBatchStop(stop.id, swapWith.sequence),
        reorderBatchStop(swapWith.id, stop.sequence),
      ]);
      onRefresh();
    } catch (e: any) {
      setReorderError('Reihenfolge konnte nicht geaendert werden: ' + (e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const otherDrivers = onlineDrivers.filter((d) => d.id !== batch.driver_id);

  return (
    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Stop-Reihenfolge */}
      {dropoffs.length > 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7 }}>Stop-Reihenfolge</div>
          {reorderError && (
            <div style={{ fontSize: 11.5, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '5px 9px', marginBottom: 6 }}>{reorderError}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dropoffs.map((s: any, i: number) => {
              const ord = s.order ?? {};
              const isMoving = busy === 'reorder-' + s.id;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      disabled={i === 0 || !!busy}
                      onClick={() => handleMoveStop(s, 'up', dropoffs)}
                      style={{ width: 22, height: 18, border: '1px solid #E2E8F0', borderRadius: 4, background: i === 0 ? '#F8FAFC' : '#fff', cursor: i === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#64748B', opacity: i === 0 ? .4 : 1 }}
                    >^</button>
                    <button
                      disabled={i === dropoffs.length - 1 || !!busy}
                      onClick={() => handleMoveStop(s, 'down', dropoffs)}
                      style={{ width: 22, height: 18, border: '1px solid #E2E8F0', borderRadius: 4, background: i === dropoffs.length - 1 ? '#F8FAFC' : '#fff', cursor: i === dropoffs.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#64748B', opacity: i === dropoffs.length - 1 ? .4 : 1 }}
                    >v</button>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: '#334155', opacity: isMoving ? .5 : 1 }}>
                    <span style={{ fontWeight: 700, color: '#4F46E5', marginRight: 5 }}>{i + 1}.</span>
                    {s.address || ord.kunde_name || `Stop ${i + 1}`}
                    {ord.bestellnummer && <span style={{ fontSize: 10.5, color: '#94A3B8', marginLeft: 5 }}>#{String(ord.bestellnummer).slice(-4)}</span>}
                  </div>
                  {isMoving && <span style={{ fontSize: 11, color: '#94A3B8' }}>...</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fahrer wechseln */}
      {otherDrivers.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7 }}>Fahrer wechseln</div>
          <div style={{ display: 'flex', gap: 7 }}>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              style={{ flex: 1, height: 34, border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#334155', background: '#fff', padding: '0 10px' }}
            >
              <option value="">Fahrer waehlen...</option>
              {otherDrivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              disabled={!selectedDriver || busy === 'reassign'}
              onClick={handleReassign}
              style={{ height: 34, padding: '0 14px', border: 'none', borderRadius: 8, background: selectedDriver ? '#4F46E5' : '#E2E8F0', color: selectedDriver ? '#fff' : '#94A3B8', fontSize: 12.5, fontWeight: 700, cursor: selectedDriver ? 'pointer' : 'not-allowed', opacity: busy === 'reassign' ? .6 : 1 }}
            >
              {busy === 'reassign' ? '...' : 'Zuweisen'}
            </button>
          </div>
        </div>
      )}

      {/* Tour stornieren */}
      <div>
        <button
          disabled={busy === 'cancel'}
          onClick={handleCancel}
          style={{
            height: 34, padding: '0 14px',
            border: `2px solid ${confirmCancel ? '#DC2626' : '#FECACA'}`,
            borderRadius: 8,
            background: confirmCancel ? '#FEF2F2' : '#fff',
            color: '#DC2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            transition: 'all .15s', opacity: busy === 'cancel' ? .6 : 1,
          }}
          onBlur={() => setConfirmCancel(false)}
        >
          {busy === 'cancel' ? 'Stornieren...' : confirmCancel ? 'Sicher? Nochmal klicken' : 'Tour stornieren'}
        </button>
        {confirmCancel && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Aktion kann nicht rueckgaengig gemacht werden</div>}
      </div>

    </div>
  );
}

export function BatchPanel({ initial, locationId }: { initial: any[]; locationId?: string }) {
  const [batches, setBatches] = useState<any[]>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const fresh = await getActiveBatches();
      setBatches(fresh);
    } catch { /* silent */ } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (batches.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Aktive Touren
              <span style={{ fontWeight: 500, color: '#94A3B8' }}> &middot; keine laufend</span>
            </h3>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>Wird alle 15 s aktualisiert</p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{ height: 32, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {refreshing ? '...' : 'Aktualisieren'}
          </button>
        </div>
        <div style={{ padding: '32px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Keine aktiven Liefertouren</div>
          <div style={{ fontSize: 13, color: '#94A3B8', maxWidth: 320, margin: '0 auto' }}>
            Sobald ein Fahrer dispatcht wird, erscheint die Tour hier mit Live-Status, Stops und ETA.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Aktive Touren
            <span style={{ fontWeight: 500, color: '#94A3B8' }}> &middot; {batches.length} laufend</span>
          </h3>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>Live-Dispatch -- aktualisiert alle 15 s &middot; Tour anklicken fuer Aktionen</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{ height: 32, padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {refreshing ? '...' : 'Aktualisieren'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '6px 12px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1D4ED8' }}>{batches.length} Tour{batches.length !== 1 ? 'en' : ''} unterwegs</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {batches.map((b: any) => {
          const si = BATCH_STATE[b.state] ?? { label: b.state, color: '#334155', bg: '#F1F5F9', dot: '#64748B' };
          const dropoffs = ((b.stops ?? []) as any[])
            .filter((s: any) => s.type === 'dropoff')
            .sort((a: any, z: any) => a.sequence - z.sequence);
          const done = dropoffs.filter((s: any) => !!s.completed_at).length;
          const driverName = b.driver?.name ?? 'Fahrer';
          const vehicle = b.driver?.vehicle ?? '';
          const vehicleIcon = vehicle === 'bicycle' ? 'Rad' : vehicle === 'scooter' ? 'Roller' : vehicle === 'car' ? 'Auto' : 'Moto';
          const isExpanded = expandedBatch === b.id;
          return (
            <div key={b.id} style={{ background: '#F8FAFC', border: `1px solid ${isExpanded ? '#818CF8' : '#E2E8F0'}`, borderRadius: 13, padding: '14px 16px', transition: 'border-color .15s' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isExpanded || dropoffs.length > 0 ? 10 : 0, cursor: 'pointer' }}
                onClick={() => setExpandedBatch(isExpanded ? null : b.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', borderRadius: 6, padding: '2px 7px' }}>{vehicleIcon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{driverName}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: si.bg, border: `1px solid ${si.dot}40`, borderRadius: 6, padding: '2px 8px', marginTop: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: si.dot }} />
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: si.color }}>{si.label}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    {b.total_eta_min && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>ETA {b.total_eta_min} min</div>
                    )}
                    <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Seit {elapsed(b.created_at)}</div>
                    {dropoffs.length > 1 && (
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{done}/{dropoffs.length} Stops</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{isExpanded ? '[^]' : '[v]'}</span>
                </div>
              </div>

              {dropoffs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                  {dropoffs.map((s: any, i: number) => {
                    const isDone = !!s.completed_at;
                    const ord = s.order ?? {};
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: isDone ? 0.5 : 1 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: isDone ? '#D1FAE5' : '#EFF6FF', border: `1.5px solid ${isDone ? '#34D399' : '#93C5FD'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isDone
                            ? <span style={{ fontSize: 10 }}>ok</span>
                            : <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8' }}>{i + 1}</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: isDone ? '#94A3B8' : '#334155', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {s.address || ord.kunde_name || `Stop ${i + 1}`}
                          </span>
                          {ord.bestellnummer && (
                            <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>#{String(ord.bestellnummer).slice(-4)}</span>
                          )}
                        </div>
                        {ord.gesamtbetrag && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>
                            {Number(ord.gesamtbetrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} E
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && (
                <BatchActions batch={b} onRefresh={refresh} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
