'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Photo = {
  id: string;
  url: string;
  caption?: string;
  subcaption?: string;
  overlay?: React.ReactNode;
};

export function PhotoGallery({ photos, emptyLabel = 'Keine Fotos' }: { photos: Photo[]; emptyLabel?: string }) {
  const [open, setOpen] = React.useState<Photo | null>(null);

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map(p => (
          <button
            key={p.id}
            onClick={() => setOpen(p)}
            className={cn(
              'group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left shadow-subtle',
              'transition hover:shadow-strong hover:-translate-y-0.5',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
            {(p.caption || p.subcaption) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                {p.caption && <div className="text-xs font-medium text-white">{p.caption}</div>}
                {p.subcaption && <div className="text-[10px] text-white/80">{p.subcaption}</div>}
              </div>
            )}
            {p.overlay && <div className="absolute left-2 top-2">{p.overlay}</div>}
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-4xl p-2">
          {open && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open.url} alt={open.caption ?? ''} className="mx-auto max-h-[80vh] rounded object-contain" />
              {(open.caption || open.subcaption) && (
                <div className="p-3">
                  {open.caption && <div className="font-medium">{open.caption}</div>}
                  {open.subcaption && <div className="text-sm text-muted-foreground">{open.subcaption}</div>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
