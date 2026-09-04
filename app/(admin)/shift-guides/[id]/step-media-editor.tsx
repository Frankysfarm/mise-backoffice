"use client";

import { useId, useState } from "react";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StepMedia } from "@/lib/ablaeufe/schema";

const MAX_MEDIA = 5;

/**
 * Anleitungs-Medien eines Schritts im Listen-Editor: Upload (Bild/Video),
 * Beschriftung und Entfernen. Die Dateien liegen im privaten `documents`-Bucket;
 * gespeichert wird nur der Pfad im Schritt (`media`), das eigentliche Sichern
 * passiert über „Ablauf speichern“.
 */
export function StepMediaEditor({
  guideId,
  media,
  onChange,
}: {
  guideId: string;
  media: StepMedia[];
  onChange: (media: StepMedia[]) => void;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`/api/ablaeufe/guides/${guideId}/media`, {
      method: "POST",
      body,
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Der Upload ist fehlgeschlagen.");
      return;
    }
    onChange([
      ...media,
      { kind: result.media.kind, path: result.media.path, caption: "" },
    ]);
  }

  async function remove(item: StepMedia) {
    // Aus einer Kopie geerbte Medien liegen im Ordner der Vorlage – dort wird
    // nur die Referenz entfernt, die Datei der Vorlage bleibt unangetastet.
    if (!item.path.includes(`/guides/${guideId}/`)) {
      onChange(media.filter((entry) => entry.path !== item.path));
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/ablaeufe/guides/${guideId}/media`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: item.path }),
    });
    setBusy(false);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(result.error ?? "Die Datei konnte nicht gelöscht werden.");
      return;
    }
    onChange(media.filter((entry) => entry.path !== item.path));
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Anleitung (Bilder/Videos)</span>
      {media.map((item, index) => (
        <div
          key={item.path}
          className="flex items-center gap-2 rounded-lg border p-2"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
            {item.kind === "image" ? <ImagePlus size={16} /> : <Film size={16} />}
          </span>
          <Input
            aria-label={`Beschriftung Medium ${index + 1}`}
            className="flex-1"
            maxLength={200}
            placeholder="Beschriftung (optional)"
            value={item.caption}
            onChange={(event) =>
              onChange(
                media.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, caption: event.target.value }
                    : entry,
                ),
              )
            }
          />
          <Button
            aria-label={`Medium ${index + 1} entfernen`}
            disabled={busy}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => remove(item)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      {media.length < MAX_MEDIA ? (
        <label
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
          htmlFor={inputId}
        >
          <ImagePlus size={16} />
          {busy ? "Lädt hoch …" : "Bild oder Video hinzufügen"}
          <input
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="sr-only"
            disabled={busy}
            id={inputId}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          Höchstens 5 Medien pro Schritt.
        </p>
      )}
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
}
