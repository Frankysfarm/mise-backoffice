import { createClient } from "@/lib/supabase/server";
import { requireManagerPlus } from "@/lib/auth/requireRole";
import { PageHeader } from "@/components/layout/page-header";
import {
  WarehousePlan,
  type WarehouseArea,
  type WarehouseItem,
  type WarehouseShelf,
} from "./warehouse-plan";

export default async function WarehousePlanPage() {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id)
    throw new Error("Mitarbeiterkonto ist keinem Mandanten zugeordnet.");
  const supabase = await createClient();
  let areasQuery = supabase
    .from("inventory_areas")
    .select("id,name,location_id,location:locations!inner(name,tenant_id)")
    .eq("location.tenant_id", actor.tenant_id)
    .order("name");
  let shelvesQuery = supabase
    .from("inventory_shelves")
    .select(
      "id,area_id,parent_shelf_id,name,place_kind,unit_type,beschreibung,position,qr_token,last_checked_at,area:inventory_areas!inner(location:locations!inner(tenant_id),location_id)",
    )
    .eq("area.location.tenant_id", actor.tenant_id)
    .order("position");
  let itemsQuery = supabase
    .from("inventory_items")
    .select(
      "id,name,shelf_id,soll_bestand,min_bestand,letzte_inventur,aktiv,area:inventory_areas!inner(location:locations!inner(tenant_id),location_id)",
    )
    .eq("area.location.tenant_id", actor.tenant_id)
    .eq("aktiv", true);
  if (actor.location_id) {
    areasQuery = areasQuery.eq("location_id", actor.location_id);
    shelvesQuery = shelvesQuery.eq("area.location_id", actor.location_id);
    itemsQuery = itemsQuery.eq("area.location_id", actor.location_id);
  }
  const [{ data: areas }, { data: shelves }, { data: items }] =
    await Promise.all([areasQuery, shelvesQuery, itemsQuery]);
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/neo/app/lager"
        title="Visueller Lagerplan"
        description="Räume, Regale, Kühlgeräte und Lagerplätze übersichtlich organisieren."
      />
      <WarehousePlan
        areas={(areas ?? []) as unknown as WarehouseArea[]}
        shelves={(shelves ?? []) as unknown as WarehouseShelf[]}
        items={(items ?? []) as unknown as WarehouseItem[]}
      />
    </div>
  );
}
