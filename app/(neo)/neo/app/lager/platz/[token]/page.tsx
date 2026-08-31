import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePosAccess } from "@/lib/auth/requireRole";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlaceActions } from "./place-actions";
import { operationsBasePath } from "@/lib/routing/operations-base-path";

type PlaceArea = {
  id: string;
  name: string;
  location_id: string;
  location: { name: string };
};
type Checker = { vorname: string; nachname: string };

export default async function InventoryPlacePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const actor = await requirePosAccess();
  if (!actor.tenant_id) notFound();
  const { token } = await params;
  const supabase = await createClient();
  const basePath = await operationsBasePath("/inventory", "/neo/app/lager");
  let query = supabase
    .from("inventory_shelves")
    .select(
      "id,name,qr_token,last_checked_at,last_checker:employees!inventory_shelves_last_checked_by_fkey(vorname,nachname),area:inventory_areas!inner(id,name,location_id,location:locations!inner(name,tenant_id))",
    )
    .eq("qr_token", token)
    .eq("area.location.tenant_id", actor.tenant_id)
    .eq("place_kind", "place");
  if (actor.location_id)
    query = query.eq("area.location_id", actor.location_id);
  const { data: place } = await query.maybeSingle();
  if (!place) notFound();
  const area = place.area as unknown as PlaceArea;
  const [{ data: items }, { data: targets }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id,name,einheit,soll_bestand,min_bestand,letzte_inventur,shelf_id",
      )
      .eq("shelf_id", place.id)
      .eq("aktiv", true)
      .order("name"),
    supabase
      .from("inventory_shelves")
      .select(
        "id,name,parent:inventory_shelves!inventory_shelves_parent_shelf_id_fkey(name),area:inventory_areas!inner(name,location_id,location:locations!inner(tenant_id))",
      )
      .eq("place_kind", "place")
      .eq("area.location_id", area.location_id)
      .eq("area.location.tenant_id", actor.tenant_id)
      .neq("id", place.id)
      .order("name"),
  ]);
  const checker = place.last_checker as unknown as Checker | null;
  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <PageHeader
        backHref={`${basePath}/plan`}
        title={place.name}
        description={`${area.name} · ${area.location.name}`}
      />
      <Card>
        <CardContent className="p-4 text-sm">
          <div className="font-medium">Letzte Kontrolle</div>
          <div className="text-muted-foreground">
            {place.last_checked_at
              ? `${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(place.last_checked_at))}${checker ? ` · ${checker.vorname} ${checker.nachname}` : ""}`
              : "Noch keine Kontrolle erfasst"}
          </div>
          <a
            className="mt-3 inline-block font-medium text-primary underline"
            href={`${basePath}/plan/print?place=${place.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            QR-Etikett öffnen und drucken
          </a>
        </CardContent>
      </Card>
      {!items?.length ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">Dieser Lagerplatz ist noch leer.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Produkte können in der Produktverwaltung diesem Platz zugeordnet
              werden.
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Soll {item.soll_bestand ?? "—"} · Ist{" "}
                    {item.letzte_inventur ?? 0} {item.einheit}
                  </p>
                </div>
                {(item.letzte_inventur ?? 0) < (item.min_bestand ?? 0) ? (
                  <Badge variant="destructive">Nachbestellen</Badge>
                ) : (
                  <Badge variant="secondary">Bestand ok</Badge>
                )}
              </div>
              <PlaceActions
                item={item}
                placeId={place.id}
                locationId={area.location_id}
                targets={(targets ?? []).map((target) => ({
                  id: target.id,
                  label: `${(target.area as unknown as { name: string }).name} · ${(target.parent as unknown as { name: string } | null)?.name ?? "Ohne Einrichtung"} · ${target.name}`,
                }))}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
