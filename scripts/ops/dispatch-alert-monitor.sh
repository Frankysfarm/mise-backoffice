#!/bin/sh
set -eu

ALERT_TO="${DISPATCH_ALERT_EMAIL:-tahar.galai@gmail.com}"
STATE_DIR="${DISPATCH_ALERT_STATE_DIR:-/var/lib/mise-dispatch-alert}"
STATE_FILE="${STATE_DIR}/active-reason"
DB_CONTAINER="${DISPATCH_DB_CONTAINER:-supabase-db}"
APP_CONTAINER="${DISPATCH_APP_CONTAINER:-mise_backoffice_3310}"

mkdir -p "$STATE_DIR"

alert_reason=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atc "
WITH pending AS (
  SELECT count(*) AS total
  FROM public.customer_orders
  WHERE typ = 'lieferung'
    AND status IN ('neu','in_zubereitung','fertig')
    AND mise_driver_id IS NULL
    AND mise_batch_id IS NULL
    AND created_at < now() - interval '5 minutes'
), recent AS (
  SELECT
    count(*) FILTER (WHERE reason_text LIKE 'Geocoding-Fehler:%') AS geocoding_holds,
    count(*) FILTER (WHERE reason_text LIKE 'ALL_DRIVERS_STALE%') AS stale_holds
  FROM public.mise_frank_decisions
  WHERE created_at > now() - interval '5 minutes'
)
SELECT CASE
  WHEN pending.total > 0 AND recent.geocoding_holds >= 3 THEN 'GEOCODING_BLOCKED'
  WHEN pending.total > 0 AND recent.stale_holds >= 3 THEN 'ALL_DRIVERS_STALE'
  ELSE ''
END
FROM pending, recent;
")

if [ -z "$alert_reason" ]; then
  rm -f "$STATE_FILE"
  exit 0
fi

if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$alert_reason" ]; then
  exit 0
fi

case "$alert_reason" in
  GEOCODING_BLOCKED)
    alert_text="Mise Driver: Mindestens eine Lieferbestellung ist seit mehr als 5 Minuten unzugewiesen. Der Dispatcher meldet wiederholt einen Geocoding-Fehler. Bitte Google Maps Billing/API und die Dispatch-Entscheidungen prüfen."
    ;;
  ALL_DRIVERS_STALE)
    alert_text="Mise Driver: Mindestens eine Lieferbestellung ist seit mehr als 5 Minuten unzugewiesen. Der Dispatcher schließt alle Fahrer wegen veralteter GPS-Daten aus. Bitte Driver-App, Standortfreigabe und GPS-Transport prüfen."
    ;;
  *)
    exit 1
    ;;
esac

alert_subject="Mise Driver Warnung: ${alert_reason}"
result=$(docker exec \
  -e ALERT_TO="$ALERT_TO" \
  -e ALERT_SUBJECT="$alert_subject" \
  -e ALERT_TEXT="$alert_text" \
  "$APP_CONTAINER" node -e '
const key = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM;
if (!key || !from) process.exit(2);
fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    from,
    to: [process.env.ALERT_TO],
    subject: process.env.ALERT_SUBJECT,
    text: process.env.ALERT_TEXT,
  }),
}).then(async response => {
  if (!response.ok) {
    console.error(`MAIL_FAILED:${response.status}`);
    process.exit(1);
  }
  console.log("MAIL_SENT");
}).catch(() => process.exit(1));
')

if [ "$result" != "MAIL_SENT" ]; then
  exit 1
fi

printf '%s\n' "$alert_reason" >"$STATE_FILE"
printf '%s %s\n' "$(date -u +%FT%TZ)" "$alert_reason"
