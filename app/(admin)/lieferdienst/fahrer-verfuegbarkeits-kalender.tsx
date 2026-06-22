'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Calendar, AlertTriangle, Clock, ChevronDown, ChevronUp, Users } from 'lucide-react';

interface FahrerSchicht {
  shiftId:      string;
  driverId:     string;
  driverName:   string | null;
  vehicle:      string | null;
  plannedStart: string;
  plannedEnd:   string | null;
  durationH:    number | null;
  ueberstunden: boolean;
  status:       string;
}

interface TagesUebersicht {
  datum:              string;
  wochentag:          string;
  schichten:          FahrerSchicht[];
  fahrerAnzahl:       number;
  mindestbesetzungOk: boolean;
  alarm:              boolean;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function isToday(datum: string) {
  return datum === new Date().toISOString().slice(0, 10);
}

function statusColor(status: string) {
  switch (status) {
    case 'active':    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'completed': return 'bg-stone-100 text-stone-500 border-stone-200';
    default:          return 'bg-blue-50 text-blue-700 border-blue-100';
  }
}

function DrillDown({ tag }: { tag: TagesUebersicht }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
      >
        {/* Tag-Header */}
        <div className={`rounded-xl p-3 border transition-colors ${
          tag.alarm
            ? 'bg-red-50 border-red-200'
            : isToday(tag.datum)
              ? 'bg-matcha-50 border-matcha-200'
              : 'bg-white border-stone-200'
        } hover:bg-stone-50`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black ${isToday(tag.datum) ? 'text-matcha-700' : 'text-char'}`}>
                  {tag.wochentag}
                </span>
                <span className="text-xs text-stone-400">
                  {new Date(tag.datum + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
                {isToday(tag.datum) && (
                  <span className="text-[9px] font-bold text-matcha-600 bg-matcha-100 rounded-full px-1.5 py-0.5">Heute</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <div className={`flex items-center gap-1 text-[11px] font-semibold ${tag.alarm ? 'text-red-600' : 'text-stone-600'}`}>
                  <Users className="h-3 w-3" />
                  {tag.fahrerAnzahl} Fahrer
                </div>
                {tag.alarm && (
                  <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    Unterbesetzt
                  </div>
                )}
                {tag.schichten.some((s) => s.ueberstunden) && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                    <Clock className="h-3 w-3" />
                    Überstunden
                  </div>
                )}
              </div>
            </div>

            {/* Fahrer-Chips (bis 4) */}
            <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
              {tag.schichten.slice(0, 4).map((s) => (
                <span
                  key={s.shiftId}
                  className={`text-[9px] font-semibold rounded-full px-2 py-0.5 border ${statusColor(s.status)}`}
                >
                  {s.driverName?.split(' ')[0] ?? '?'}
                </span>
              ))}
              {tag.schichten.length > 4 && (
                <span className="text-[9px] text-stone-400">+{tag.schichten.length - 4}</span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Drill-Down Details */}
      {open && tag.schichten.length > 0 && (
        <div className="mt-1 ml-2 rounded-xl border border-stone-100 bg-stone-50 p-3 space-y-2">
          {tag.schichten.map((s) => (
            <div key={s.shiftId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  s.status === 'active' ? 'bg-emerald-500' :
                  s.status === 'completed' ? 'bg-stone-400' : 'bg-blue-500'
                }`} />
                <span className="text-xs font-semibold text-char">
                  {s.driverName ?? 'Unbekannt'}
                </span>
                {s.vehicle && <span className="text-[10px] text-stone-400">{s.vehicle}</span>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-stone-500">
                <span>{fmtTime(s.plannedStart)}</span>
                {s.plannedEnd && <><span>–</span><span>{fmtTime(s.plannedEnd)}</span></>}
                {s.durationH !== null && (
                  <span className={`font-semibold ${s.ueberstunden ? 'text-amber-600' : 'text-stone-500'}`}>
                    {s.durationH.toFixed(1)}h{s.ueberstunden ? ' ⚠' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FahrerVerfuegbarkeitsKalender({ locationId }: { locationId: string | null }) {
  const [open, setOpen]     = useState(false);
  const [tage, setTage]     = useState<TagesUebersicht[]>([]);
  const [loading, setLoad]  = useState(false);
  const locationRef         = useRef(locationId);
  locationRef.current       = locationId;

  const load = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    setLoad(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-verfuegbarkeit?location_id=${encodeURIComponent(loc)}&days=7`);
      const j = await r.json() as { tage?: TagesUebersicht[] };
      if (j.tage) setTage(j.tage);
    } catch {/* ignore */}
    finally { setLoad(false); }
  }, []);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const alarmCount    = tage.filter((t) => t.alarm).length;
  const ueberstunden  = tage.some((t) => t.schichten.some((s) => s.ueberstunden));
  const totalFahrer   = new Set(tage.flatMap((t) => t.schichten.map((s) => s.driverId))).size;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${alarmCount > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-char">Fahrer-Verfügbarkeits-Kalender</div>
            <div className="text-xs text-stone-400">
              {tage.length > 0
                ? `${totalFahrer} Fahrer · ${alarmCount > 0 ? `${alarmCount} Alarm` : 'alle Tage besetzt'}${ueberstunden ? ' · Überstunden' : ''}`
                : '7-Tage Wochenübersicht geplanter Schichten'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alarmCount > 0 && (
            <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              {alarmCount}× Alarm
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-100 p-5 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5,6,7].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : tage.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-6">Keine Schichten für die nächsten 7 Tage geplant.</p>
          ) : (
            <>
              {tage.map((tag) => (
                <DrillDown key={tag.datum} tag={tag} />
              ))}
              <div className="pt-2 flex flex-wrap gap-3 text-[10px] text-stone-400">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Geplant
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Aktiv
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-stone-400" />
                  Abgeschlossen
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
                  Unterbesetzt (&lt;2 Fahrer)
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-2.5 w-2.5 text-amber-500" />
                  Überstunden (&gt;8h)
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
