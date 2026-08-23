import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { MisePOSv5Wrapper } from './client';
import { ReservationsSidebar } from './ReservationsSidebar';
import { MemberScannerFAB } from './MemberScanner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'POS Terminal v5 · Mise' };

const SHAPE_MAP: Record<string, string> = {
  rund: 'round',
  eckig: 'square',
  bank: 'banquet',
  lang: 'long',
  hocker: 'stool',
};

const CATEGORY_DEFAULTS: Record<string, { icon: string; color: string; taxRate: number }> = {
  default:        { icon: 'Coffee',   color: '#4A3429', taxRate: 19 },
  'Heißgetränke': { icon: 'Coffee',   color: '#4A3429', taxRate: 19 },
  'Kaltgetränke': { icon: 'IceCream', color: '#7A8E99', taxRate: 19 },
  'Food':         { icon: 'Salad',    color: '#7A8C4A', taxRate: 7 },
  'Specials':     { icon: 'Sparkles', color: '#E68A2C', taxRate: 7 },
};

/**
 * Safe JSON-Encoding für Inline-Script-Tag.
 * Escapes only `<`, `>`, `&` — verhindert script-tag-breakout.
 */
function safeJSONForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export default async function POSTerminalV5Page() {
  const employee = await requirePosAccess();
  if (!employee.tenant_id || !employee.location_id) {
    redirect('/apps?reason=missing-location');
  }
  const svc = createServiceClient();
  const tenantId = employee.tenant_id;
  const locationId = employee.location_id;

  const [
    { data: rawCategories },
    { data: rawItems },
    { data: rawTables },
    { data: rawReservations },
    { data: register },
    { data: openShift },
    { data: integrationSettings },
  ] = await Promise.all([
    svc.from('menu_categories')
      .select('id, name, sort_order')
      .eq('location_id', locationId)
      .eq('aktiv', true)
      .order('sort_order'),
    svc.from('menu_items')
      .select('id, name, preis, category_id, verfuegbar, beliebt, mwst_satz, ausverkauft_bis_schicht, option_groups, sort_order_in_category')
      .eq('location_id', locationId)
      .eq('verfuegbar', true)
      .order('sort_order_in_category'),
    svc.from('restaurant_tables')
      .select('id, nummer, name, kapazitaet, bereich, pos_x, pos_y, breite, hoehe, form, sort_order')
      .eq('location_id', locationId)
      .eq('aktiv', true)
      .order('sort_order'),
    svc.from('v_heutige_reservierungen')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .order('zeit_von', { ascending: true }),
    svc.from('pos_registers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('aktiv', true)
      .limit(1)
      .maybeSingle(),
    svc.from('pos_shifts')
      .select('id, employee_id, start_at, status')
      .eq('tenant_id', tenantId)
      .eq('location_id', locationId)
      .eq('employee_id', employee.id)
      .eq('status', 'offen')
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc.from('tenants')
      .select('sumup_api_key,sumup_merchant_code,fiskaly_api_key,fiskaly_tss_id,fiskaly_client_id')
      .eq('id', tenantId)
      .maybeSingle(),
  ]);

  const employeeName = [employee.vorname, employee.nachname].filter(Boolean).join(' ').trim();
  const data = transformToV5({
    categories: rawCategories ?? [],
    items: rawItems ?? [],
    tables: rawTables ?? [],
    runtime: {
      tenantId,
      locationId,
      employeeId: employee.id,
      employeeName,
      registerId: register?.id ?? null,
      shiftId: openShift?.id ?? null,
      sumupConfigured: Boolean(integrationSettings?.sumup_api_key && integrationSettings.sumup_merchant_code),
      tseConfigured: Boolean(integrationSettings?.fiskaly_api_key && integrationSettings.fiskaly_tss_id && integrationSettings.fiskaly_client_id),
    },
  });

  return (
    <>
      <script
        id="mise-pos-data-injection"
        dangerouslySetInnerHTML={{
          __html: `globalThis.MISE_POS_DATA = ${safeJSONForScript(data)};`,
        }}
      />
      <MisePOSv5Wrapper
        tenantId={tenantId}
        locationId={locationId}
        employeeId={employee.id}
        employeeName={employeeName}
        registerId={register?.id ?? null}
        initialShift={(openShift as { id: string; employee_id: string; start_at: string; status: string } | null) ?? null}
      />
      <ReservationsSidebar
        initialReservations={(rawReservations as any) ?? []}
        tenantId={tenantId}
        locationId={locationId}
      />
      <MemberScannerFAB />
    </>
  );
}

// ─── Transformer ────────────────────────────────────────────────

type DBCategory = { id: string; name: string; sort_order: number };
type DBItem = {
  id: string; name: string; preis: number; category_id: string;
  beliebt: boolean; ausverkauft_bis_schicht: string | null;
  option_groups: unknown;
};
type DBTable = {
  id: string; nummer: string | null; name: string | null;
  kapazitaet: number; bereich: string | null;
  pos_x: number | null; pos_y: number | null;
  breite: number | null; hoehe: number | null;
  form: string | null;
};

type PosRuntime = {
  tenantId: string;
  locationId: string;
  employeeId: string;
  employeeName: string;
  registerId: string | null;
  shiftId: string | null;
  sumupConfigured: boolean;
  tseConfigured: boolean;
};

function transformToV5({ categories, items, tables, runtime }: {
  categories: DBCategory[];
  items: DBItem[];
  tables: DBTable[];
  runtime: PosRuntime;
}) {
  const v5Categories = [
    { id: 'bestseller', name: 'Top 8', icon: 'Star', color: '#E68A2C', taxRate: null, special: true },
    ...categories.map((c) => {
      const defaults = CATEGORY_DEFAULTS[c.name] ?? CATEGORY_DEFAULTS.default;
      return {
        id: c.id, name: c.name,
        icon: defaults.icon, color: defaults.color, taxRate: defaults.taxRate,
      };
    }),
  ];

  const v5Products: Record<string, Array<{
    id: string; name: string; price: number;
    modGroups?: unknown; featured?: boolean;
  }>> = {};
  categories.forEach((c) => { v5Products[c.id] = []; });
  items.forEach((it) => {
    if (!v5Products[it.category_id]) v5Products[it.category_id] = [];
    v5Products[it.category_id].push({
      id: it.id, name: it.name,
      price: Math.round(Number(it.preis) * 100),
      modGroups: normalizeOptionGroups(it.option_groups),
      featured: it.beliebt || undefined,
    });
  });

  const bestsellerIds = items.filter((it) => it.beliebt).slice(0, 8).map((it) => it.id);
  const soldOut = items.filter((it) => it.ausverkauft_bis_schicht).map((it) => it.id);

  const areaSet = new Map<string, string>();
  tables.forEach((t) => {
    const area = t.bereich || 'innen';
    if (!areaSet.has(area)) {
      areaSet.set(area, area.charAt(0).toUpperCase() + area.slice(1));
    }
  });
  if (areaSet.size === 0) areaSet.set('innen', 'Innenraum');
  const areas = Array.from(areaSet.entries()).map(([id, name]) => ({ id, name }));

  const roomLayout: Record<string, Array<{
    id: string; label: string; x: number; y: number;
    w: number; h: number; shape: string; seats: number;
  }>> = {};
  areas.forEach((a) => { roomLayout[a.id] = []; });
  tables.forEach((t, idx) => {
    const area = t.bereich || 'innen';
    if (!roomLayout[area]) roomLayout[area] = [];
    roomLayout[area].push({
      id: t.id,
      label: t.nummer || t.name || String(idx + 1),
      x: t.pos_x ?? (80 + (idx % 5) * 140),
      y: t.pos_y ?? (90 + Math.floor(idx / 5) * 150),
      w: t.breite ?? 88,
      h: t.hoehe ?? 88,
      shape: SHAPE_MAP[t.form ?? ''] ?? 'round',
      seats: t.kapazitaet || 2,
    });
  });

  return {
    areas,
    roomLayout,
    categories: v5Categories,
    products: v5Products,
    bestsellerIds,
    soldOut,
    runtime,
    initialOrders: {},
    coupons: [],
    activePagers: [],
    summary: { revenueCents: 0, guests: 0 },
  };
}

function normalizeOptionGroups(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((rawGroup) => {
    const group = rawGroup && typeof rawGroup === 'object' ? rawGroup as Record<string, unknown> : {};
    const options = Array.isArray(group.options) ? group.options : [];
    return {
      id: String(group.id ?? ''),
      name: String(group.name ?? 'Option'),
      type: group.type === 'multi' ? 'multi' : 'single',
      required: group.required === true,
      max: Number.isFinite(Number(group.max)) ? Math.max(0, Math.trunc(Number(group.max))) : undefined,
      options: options.map((rawOption) => {
        const option = rawOption && typeof rawOption === 'object' ? rawOption as Record<string, unknown> : {};
        const delta = Number(option.priceDelta ?? 0);
        return {
          id: String(option.id ?? ''),
          name: String(option.name ?? 'Option'),
          price: Number.isFinite(delta) ? Math.round(delta * 100) : 0,
        };
      }).filter((option) => option.id),
    };
  }).filter((group) => group.id && group.options.length > 0);
}
