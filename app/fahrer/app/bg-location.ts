/**
 * Background Location Manager für die Mise Fahrer-App.
 *
 * Drei Modi je nach Umgebung:
 * 1. Native (Capacitor iOS/Android) → @capacitor/geolocation mit Background-Modus
 * 2. PWA Browser → navigator.geolocation.watchPosition + Wake Lock
 * 3. Hintergrund/minimiert → Page-Visibility-API + sendBeacon-Fallback
 */
'use client';

export type LocationFix = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed_kmh?: number | null;
  accuracy_m?: number | null;
  batch_id?: string | null;
};

type PushFn = (fix: LocationFix) => Promise<void>;

let _watchId: number | null = null;
let _wl: WakeLockSentinel | null = null;
let _bgInterval: ReturnType<typeof setInterval> | null = null;
let _lastFix: LocationFix | null = null;
let _pushFn: PushFn | null = null;
let _isNative = false;
let _onHideFn: (() => void) | null = null;
let _pagehideFn: (() => void) | null = null;
let _visWakeLockFn: (() => void) | null = null;

function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

async function acquireWakeLock() {
  if (typeof navigator === 'undefined') return;
  try {
    _wl = await (navigator as any).wakeLock?.request('screen');
    _visWakeLockFn = async () => {
      if (document.visibilityState === 'visible' && !_wl) {
        try { _wl = await (navigator as any).wakeLock?.request('screen'); } catch {}
      }
    };
    document.addEventListener('visibilitychange', _visWakeLockFn);
  } catch {}
}

function releaseWakeLock() {
  _wl?.release().catch(() => {});
  _wl = null;
  if (_visWakeLockFn) {
    document.removeEventListener('visibilitychange', _visWakeLockFn);
    _visWakeLockFn = null;
  }
}

async function startNative(batchId: string | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — @capacitor/geolocation optional, nicht im package.json; graceful fallback auf Web
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.requestPermissions();
    _watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pos: any, err: any) => {
        if (err || !pos) return;
        const fix: LocationFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracy_m: pos.coords.accuracy ?? null,
          batch_id: batchId,
        };
        _lastFix = fix;
        _pushFn?.(fix).catch(() => queueFix(fix));
      },
    ) as unknown as number;
    _isNative = true;
  } catch {
    await startWeb(batchId);
  }
}

function startWeb(batchId: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(); return; }
    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: LocationFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracy_m: pos.coords.accuracy ?? null,
          batch_id: batchId,
        };
        _lastFix = fix;
        _pushFn?.(fix).catch(() => queueFix(fix));
        resolve();
      },
      () => resolve(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
  });
}

function startBgKeepalive(batchId: string | null) {
  _bgInterval = setInterval(() => {
    if (!document.hidden) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy ?? null;
        if (accuracy != null && accuracy > 100) return;
        const fix: LocationFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracy_m: accuracy,
          batch_id: batchId,
        };
        _lastFix = fix;
        _pushFn?.(fix).catch(() => queueFix(fix));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
  }, 30_000);

  _onHideFn = () => {
    if (document.visibilityState !== 'hidden') return;
    if (!_lastFix) return;
    navigator.sendBeacon(
      '/api/driver/v1/me/position',
      new Blob([JSON.stringify(_lastFix)], { type: 'application/json' }),
    );
  };
  document.addEventListener('visibilitychange', _onHideFn);

  _pagehideFn = () => {
    if (_lastFix) {
      navigator.sendBeacon(
        '/api/driver/v1/me/position',
        new Blob([JSON.stringify(_lastFix)], { type: 'application/json' }),
      );
    }
  };
  window.addEventListener('pagehide', _pagehideFn);
}

// Offline-Queue
const QUEUE_KEY = 'mise_gps_queue';

function queueFix(fix: LocationFix) {
  try {
    const q: LocationFix[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    q.push(fix);
    if (q.length > 50) q.splice(0, q.length - 50);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

export async function flushGpsQueue(pushFn: PushFn) {
  try {
    const q: LocationFix[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    if (!q.length) return;
    const remaining: LocationFix[] = [];
    for (const fix of q) {
      try { await pushFn(fix); } catch { remaining.push(fix); }
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

export async function startBgLocation(pushFn: PushFn, batchId: string | null = null) {
  _pushFn = pushFn;
  stopBgLocation();
  await acquireWakeLock();
  if (isCapacitor()) {
    await startNative(batchId);
  } else {
    await startWeb(batchId);
  }
  startBgKeepalive(batchId);
  flushGpsQueue(pushFn).catch(() => {});
}

export function stopBgLocation() {
  if (_watchId !== null) {
    if (_isNative) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      import('@capacitor/geolocation').then(({ Geolocation }: any) =>
        Geolocation.clearWatch({ id: String(_watchId) }),
      ).catch(() => {});
    } else {
      navigator.geolocation?.clearWatch(_watchId);
    }
    _watchId = null;
  }
  if (_bgInterval) { clearInterval(_bgInterval); _bgInterval = null; }
  if (_onHideFn) { document.removeEventListener('visibilitychange', _onHideFn); _onHideFn = null; }
  if (_pagehideFn) { window.removeEventListener('pagehide', _pagehideFn); _pagehideFn = null; }
  releaseWakeLock();
  _isNative = false;
  _pushFn = null;
}

export function updateBatchId(batchId: string | null) {
  if (_lastFix) _lastFix.batch_id = batchId;
}
