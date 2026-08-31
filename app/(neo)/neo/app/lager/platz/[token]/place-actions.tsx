"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/components/ui/toaster";

type Action = "book" | "withdraw" | "transfer" | "count";

export function PlaceActions({
  item,
  placeId,
  locationId,
  targets,
}: {
  item: {
    id: string;
    name: string;
    einheit: string;
    letzte_inventur: number | null;
  };
  placeId: string;
  locationId: string;
  targets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<Action | null>(null);
  const stock = item.letzte_inventur ?? 0;

  function submit(fd: FormData) {
    if (!action) return;
    const targetName = String(fd.get("targetPlaceName") ?? "");
    const targetPlaceId =
      action === "transfer"
        ? targets.find((target) => target.name === targetName)?.id
        : null;
    if (action === "transfer" && !targetPlaceId)
      return toastError(
        "Ziel fehlt",
        "Bitte einen Lagerplatz aus der Vorschlagsliste wählen.",
      );
    start(async () => {
      const res = await fetch("/api/inventory/warehouse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "stock-action",
          locationId,
          placeId,
          itemId: item.id,
          action,
          amount: Number(fd.get("amount")),
          targetPlaceId,
        }),
      });
      const body = await res.json();
      if (!res.ok) return toastError("Buchung fehlgeschlagen", body.error);
      toastSuccess(
        action === "count" ? "Zählung gespeichert" : "Bestand gebucht",
      );
      setAction(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="outline" onClick={() => setAction("book")}>
          Einbuchen
        </Button>
        <Button
          variant="outline"
          onClick={() => setAction("withdraw")}
          disabled={stock <= 0}
        >
          Entnehmen
        </Button>
        <Button
          variant="outline"
          onClick={() => setAction("transfer")}
          disabled={stock <= 0}
        >
          Umlagern
        </Button>
        <Button onClick={() => setAction("count")}>Zählen</Button>
      </div>
      {action && (
        <form action={submit} className="space-y-3 rounded-lg bg-muted p-3">
          <div>
            <Label htmlFor={`amount-${item.id}`}>
              {action === "count"
                ? "Gezählter Ist-Bestand"
                : action === "transfer"
                  ? `Gesamten Bestand umlagern (${item.einheit})`
                  : `Menge (${item.einheit})`}
            </Label>
            <Input
              id={`amount-${item.id}`}
              name="amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              defaultValue={action === "transfer" ? stock : undefined}
              readOnly={action === "transfer"}
              required
              autoFocus
            />
          </div>
          {action === "transfer" && (
            <div>
              <Label htmlFor={`target-${item.id}`}>
                Ziel-Lagerplatz suchen
              </Label>
              <Input
                id={`target-${item.id}`}
                name="targetPlaceName"
                list={`targets-${item.id}`}
                required
                placeholder="Name eingeben oder auswählen"
              />
              <datalist id={`targets-${item.id}`}>
                {targets.map((target) => (
                  <option key={target.id} value={target.name} />
                ))}
              </datalist>
            </div>
          )}
          <div className="flex gap-2">
            <Button disabled={pending}>Speichern</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAction(null)}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
