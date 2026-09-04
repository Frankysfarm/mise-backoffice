import type { StepMedia } from "@/lib/ablaeufe/schema";

/**
 * Anleitungs-Medien eines Arbeitsschritts (Bilder/Videos aus dem Listen-Builder).
 * `urls` sind server-seitig signierte Download-URLs; Medien ohne auflösbare URL
 * werden still übersprungen, damit ein abgelaufener Pfad die Ausführung nie blockiert.
 */
export function StepMediaGallery({
  media,
  urls,
}: {
  media: StepMedia[];
  urls: Record<string, string>;
}) {
  const resolved = media
    .map((item) => ({ ...item, url: urls[item.path] }))
    .filter((item): item is StepMedia & { url: string } => Boolean(item.url));
  if (!resolved.length) return null;
  return (
    <div className="space-y-3">
      {resolved.map((item) => (
        <figure key={item.path} className="overflow-hidden rounded-xl border">
          {item.kind === "image" ? (
            // Signierte Storage-URLs sind kurzlebig – next/image würde sie cachen/proxien.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={item.caption || "Anleitungsbild"}
              className="max-h-72 w-full object-contain"
              src={item.url}
            />
          ) : (
            <video
              className="max-h-72 w-full"
              controls
              playsInline
              preload="metadata"
              src={item.url}
            />
          )}
          {item.caption && (
            <figcaption className="bg-muted px-3 py-2 text-sm text-muted-foreground">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
