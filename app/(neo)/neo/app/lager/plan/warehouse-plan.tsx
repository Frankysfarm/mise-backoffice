"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Printer,
  QrCode,
  Refrigerator,
  Snowflake,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/components/ui/toaster";

export type WarehouseArea = {
  id: string;
  name: string;
  location_id: string;
  location: { name: string };
};
export type WarehouseShelf = {
  id: string;
  area_id: string;
  parent_shelf_id: string | null;
  name: string;
  place_kind: "unit" | "place";
  unit_type: string | null;
  beschreibung: string | null;
  qr_token: string;
  last_checked_at: string | null;
};
export type WarehouseItem = {
  id: string;
  name: string;
  shelf_id: string | null;
  soll_bestand: number | null;
  min_bestand: number | null;
  letzte_inventur: number | null;
};

const icons: Record<string, typeof Warehouse> = {
  kuehlschrank: Refrigerator,
  gefrierschrank: Snowflake,
};

export function WarehousePlan({
  areas,
  shelves,
  items,
  basePath,
}: {
  areas: WarehouseArea[];
  shelves: WarehouseShelf[];
  items: WarehouseItem[];
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [unitFor, setUnitFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<WarehouseShelf | null>(null);

  function save(
    fd: FormData,
    area: WarehouseArea,
    kind: "unit" | "place",
    parentId: string | null,
    id?: string,
  ) {
    start(async () => {
      const res = await fetch("/api/inventory/warehouse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "save-place",
          id,
          locationId: area.location_id,
          areaId: area.id,
          parentId,
          kind,
          name: fd.get("name"),
          unitType: fd.get("unitType"),
          description: fd.get("description"),
        }),
      });
      const body = await res.json();
      if (!res.ok) return toastError("Speichern fehlgeschlagen", body.error);
      toastSuccess(
        kind === "unit" ? "Einrichtung gespeichert" : "Lagerplatz gespeichert",
      );
      setUnitFor(null);
      setEditing(null);
      router.refresh();
    });
  }

  function remove(area: WarehouseArea, shelf: WarehouseShelf) {
    if (!confirm(`„${shelf.name}“ wirklich löschen?`)) return;
    start(async () => {
      const res = await fetch("/api/inventory/warehouse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "delete-place",
          id: shelf.id,
          locationId: area.location_id,
        }),
      });
      const body = await res.json();
      if (!res.ok) return toastError("Löschen fehlgeschlagen", body.error);
      toastSuccess("Lagerstruktur gelöscht");
      router.refresh();
    });
  }

  if (!areas.length)
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">Noch kein Lagerraum vorhanden.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege zuerst unter „Produkte verwalten“ einen Lagerbereich für einen
            Standort an.
          </p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-8">
      {areas.map((area) => {
        const units = shelves.filter(
          (s) => s.area_id === area.id && s.place_kind === "unit",
        );
        return (
          <section key={area.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-bold">{area.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {area.location?.name}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link
                  href={`${basePath}/plan/print?area=${area.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Printer className="h-4 w-4" /> Etiketten drucken
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {units.map((unit) => {
                const Icon = icons[unit.unit_type ?? ""] ?? Warehouse;
                const places = shelves.filter(
                  (s) => s.parent_shelf_id === unit.id,
                );
                return (
                  <Card key={unit.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span className="flex-1">{unit.name}</span>
                        <Badge variant="muted">{places.length} Plätze</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${unit.name} bearbeiten`}
                          onClick={() => setEditing(unit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`${unit.name} löschen`}
                          disabled={pending}
                          onClick={() => remove(area, unit)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {editing?.id === unit.id && (
                        <EditForm
                          shelf={unit}
                          pending={pending}
                          onSave={(fd) => save(fd, area, "unit", null, unit.id)}
                          onCancel={() => setEditing(null)}
                        />
                      )}
                      {places.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Noch keine Lagerplätze in dieser Einrichtung.
                        </p>
                      )}
                      {places.map((place) => {
                        const stock = items.filter(
                          (i) => i.shelf_id === place.id,
                        );
                        const empty =
                          stock.length === 0 ||
                          stock.reduce(
                            (sum, item) => sum + (item.letzte_inventur ?? 0),
                            0,
                          ) === 0;
                        const reorder = stock.some(
                          (i) =>
                            (i.letzte_inventur ?? 0) < (i.min_bestand ?? 0),
                        );
                        const due =
                          !place.last_checked_at ||
                          Date.now() -
                            new Date(place.last_checked_at).getTime() >
                            30 * 86400000;
                        return (
                          <div key={place.id} className="rounded-xl border p-3">
                            <Link
                              href={`${basePath}/platz/${place.qr_token}`}
                              className="block transition hover:text-primary"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold">
                                    {place.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {stock.length} Produkte
                                  </div>
                                </div>
                                <QrCode className="h-5 w-5" />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {empty ? (
                                  <Badge variant="outline">leer</Badge>
                                ) : (
                                  <Badge variant="secondary">ok</Badge>
                                )}
                                {reorder && (
                                  <Badge variant="destructive">
                                    nachbestellen
                                  </Badge>
                                )}
                                {due && (
                                  <Badge variant="outline">
                                    Inventur fällig
                                  </Badge>
                                )}
                              </div>
                            </Link>
                            <div className="mt-2 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(place)}
                              >
                                <Pencil className="h-4 w-4" /> Umbenennen
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => remove(area, place)}
                              >
                                <Trash2 className="h-4 w-4" /> Löschen
                              </Button>
                            </div>
                            {editing?.id === place.id && (
                              <EditForm
                                shelf={place}
                                pending={pending}
                                onSave={(fd) =>
                                  save(fd, area, "place", unit.id, place.id)
                                }
                                onCancel={() => setEditing(null)}
                              />
                            )}
                          </div>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUnitFor(unit.id)}
                      >
                        <Plus className="h-4 w-4" /> Lagerplatz
                      </Button>
                      {unitFor === unit.id && (
                        <form
                          action={(fd) => save(fd, area, "place", unit.id)}
                          className="space-y-2 rounded-lg bg-muted p-3"
                        >
                          <Label htmlFor={`place-name-${unit.id}`}>
                            Name des Lagerplatzes
                          </Label>
                          <Input
                            id={`place-name-${unit.id}`}
                            name="name"
                            required
                            placeholder="Fach A1"
                          />
                          <Label htmlFor={`place-description-${unit.id}`}>
                            Optionaler Hinweis
                          </Label>
                          <Input
                            id={`place-description-${unit.id}`}
                            name="description"
                            placeholder="Zum Beispiel: obere Ebene"
                          />
                          <Button disabled={pending} size="sm">
                            Anlegen
                          </Button>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <form
              action={(fd) => save(fd, area, "unit", null)}
              className="grid gap-2 rounded-xl border border-dashed p-4 sm:grid-cols-4"
            >
              <div className="sm:col-span-2">
                <Label htmlFor={`unit-name-${area.id}`}>Neue Einrichtung</Label>
                <Input
                  id={`unit-name-${area.id}`}
                  name="name"
                  required
                  placeholder="Getränkekühlschrank"
                />
              </div>
              <div>
                <Label htmlFor={`unit-type-${area.id}`}>Art</Label>
                <select
                  id={`unit-type-${area.id}`}
                  name="unitType"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="regal">Regal</option>
                  <option value="kuehlschrank">Kühlschrank</option>
                  <option value="gefrierschrank">Gefrierschrank</option>
                  <option value="schrank">Schrank</option>
                  <option value="behaelter">Behälter</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <Button className="self-end" disabled={pending}>
                <Plus className="h-4 w-4" /> Anlegen
              </Button>
            </form>
          </section>
        );
      })}
    </div>
  );
}

function EditForm({
  shelf,
  pending,
  onSave,
  onCancel,
}: {
  shelf: WarehouseShelf;
  pending: boolean;
  onSave: (fd: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSave} className="space-y-2 rounded-lg bg-muted p-3">
      <Label htmlFor={`edit-name-${shelf.id}`}>Name</Label>
      <Input
        id={`edit-name-${shelf.id}`}
        name="name"
        defaultValue={shelf.name}
        required
      />
      <Label htmlFor={`edit-description-${shelf.id}`}>Hinweis</Label>
      <Input
        id={`edit-description-${shelf.id}`}
        name="description"
        defaultValue={shelf.beschreibung ?? ""}
      />
      {shelf.place_kind === "unit" && (
        <>
          <Label htmlFor={`edit-type-${shelf.id}`}>Art</Label>
          <select
            id={`edit-type-${shelf.id}`}
            name="unitType"
            defaultValue={shelf.unit_type ?? "regal"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="regal">Regal</option>
            <option value="kuehlschrank">Kühlschrank</option>
            <option value="gefrierschrank">Gefrierschrank</option>
            <option value="schrank">Schrank</option>
            <option value="behaelter">Behälter</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending}>
          Speichern
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
