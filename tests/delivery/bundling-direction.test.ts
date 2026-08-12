import { describe, expect, it } from 'vitest';
import { dropoffFitsTour } from '@/lib/delivery/tour-direction';

// Reale Koordinaten aus dem Browser-Fahrer-Test 12.08.2026:
// Restaurant Franky's Pasta (Ost-Lage), West-Ziele Vaalser/Süsterfeld, Ost-Ziele Trierer/Eilendorf.
const restaurant = { lat: 50.772, lng: 6.1245 };
const wandaWest = { lat: 50.7746, lng: 6.062 };
const williWest = { lat: 50.779, lng: 6.066 };
const ottoOst = { lat: 50.766, lng: 6.135 };
const emmaOst = { lat: 50.771, lng: 6.156 };

describe('dropoffFitsTour — Richtungs-/Nähe-Regel bei selbem Restaurant', () => {
  it('bündelt zwei nahe Ost-Ziele', () => {
    expect(dropoffFitsTour(restaurant, [ottoOst], emmaOst).fits).toBe(true);
  });

  it('bündelt zwei nahe West-Ziele', () => {
    expect(dropoffFitsTour(restaurant, [wandaWest], williWest).fits).toBe(true);
  });

  it('mischt NICHT West-Ziel in eine Ost-Tour (heutiger Livefall)', () => {
    expect(dropoffFitsTour(restaurant, [ottoOst, emmaOst], wandaWest).fits).toBe(false);
  });

  it('mischt NICHT Ost-Ziel in eine West-Tour', () => {
    expect(dropoffFitsTour(restaurant, [wandaWest, williWest], ottoOst).fits).toBe(false);
  });

  it('leere Tour nimmt jedes Ziel (Seed)', () => {
    expect(dropoffFitsTour(restaurant, [], wandaWest).fits).toBe(true);
  });
});
