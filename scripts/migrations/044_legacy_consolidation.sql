-- Migration 044: Legacy-Konsolidierung Phase 1
--
-- Ziel: Neue manuelle Dispatches schreiben NUR noch in mise_delivery_batches.
--       delivery_batches wird für bestehende In-Flight-Batches weiterhin gelesen,
--       aber es werden keine neuen Einträge mehr erstellt.
--
-- Änderungen:
--   1. ensure_mise_driver()  — stellt sicher dass jeder Fahrer einen mise_drivers-Eintrag hat
--   2. assign_to_driver() v2 — mise-only, auto-create mise_driver via ensure_mise_driver()
--
-- Sicherheit:
--   - Bestehende delivery_batches-Einträge bleiben unangetastet (nur gelesen bis completed)
--   - v_open_dispatch_batches bleibt unverändert (Legacy-Union bleibt für Transition)
--   - dispatch/client.tsx liest weiterhin beide Systeme (In-Flight-Sichtbarkeit)
--
-- Phase 54 (Cleanup): Legacy-Union aus v_open_dispatch_batches entfernen,
--                     delivery_batches-Query aus dispatch/client.tsx entfernen.

-- ── 1. ensure_mise_driver ─────────────────────────────────────────────────────
-- Sucht den mise_drivers-Eintrag für einen Employee.
-- Falls keiner existiert, wird einer auto-erstellt.
-- Rückgabe: mise_drivers.id (NULL wenn Employee nicht gefunden)
CREATE OR REPLACE FUNCTION ensure_mise_driver(p_employee_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_user_id   uuid;
  v_emp_name       text;
  v_mise_driver_id uuid;
BEGIN
  -- Employee-Daten laden
  SELECT auth_user_id, (COALESCE(vorname, '') || ' ' || COALESCE(nachname, ''))
  INTO v_auth_user_id, v_emp_name
  FROM employees
  WHERE id = p_employee_id;

  IF v_auth_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bestehenden mise_driver suchen
  SELECT id INTO v_mise_driver_id
  FROM mise_drivers
  WHERE auth_user_id = v_auth_user_id;

  -- Auto-create falls nicht vorhanden
  IF v_mise_driver_id IS NULL THEN
    INSERT INTO mise_drivers (auth_user_id, employee_id, name, state, active)
    VALUES (
      v_auth_user_id,
      p_employee_id,
      TRIM(v_emp_name),
      'idle',
      true
    )
    RETURNING id INTO v_mise_driver_id;
  END IF;

  RETURN v_mise_driver_id;
END;
$$;

COMMENT ON FUNCTION ensure_mise_driver IS
  'Stellt sicher dass für jeden Fahrer (employees) ein mise_drivers-Eintrag existiert. '
  'Auto-erstellt den Eintrag falls nicht vorhanden. '
  'Verwendet in assign_to_driver() v2 (Phase 53).';


-- ── 2. assign_to_driver v2: mise-only ────────────────────────────────────────
-- Manueller Dispatch schreibt NUR noch in mise_delivery_batches.
-- delivery_batches wird nicht mehr befüllt.
-- Rückgabe: jsonb { ok, mise_batch_id, legacy_batch_id: null }
--   (legacy_batch_id bleibt im Response für Rückwärtskompatibilität mit Client-Code)
CREATE OR REPLACE FUNCTION assign_to_driver(
  p_employee_id  uuid,
  p_order_ids    uuid[],
  p_location_id  uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mise_driver_id   uuid;
  v_mise_batch_id    uuid;
  v_order_count      int  := array_length(p_order_ids, 1);
  v_loc_lat          numeric(10,7);
  v_loc_lng          numeric(10,7);
  v_loc_addr         text;
  v_cust_lat         numeric(10,7);
  v_cust_lng         numeric(10,7);
  v_cust_addr        text;
  v_order_id         uuid;
  i                  int;
BEGIN
  IF v_order_count IS NULL OR v_order_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keine Bestellungen angegeben');
  END IF;

  -- 1. Mise-Driver sicherstellen (auto-create falls nicht vorhanden)
  v_mise_driver_id := ensure_mise_driver(p_employee_id);

  IF v_mise_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fahrer-Account nicht gefunden');
  END IF;

  -- 2. Mise-Batch erstellen
  INSERT INTO mise_delivery_batches (driver_id, state, stop_count, location_id)
  VALUES (v_mise_driver_id, 'assigned', v_order_count * 2, p_location_id)
  RETURNING id INTO v_mise_batch_id;

  -- 3. Location-Koordinaten einmalig laden
  SELECT lat, lng, adresse
  INTO v_loc_lat, v_loc_lng, v_loc_addr
  FROM locations
  WHERE id = p_location_id;

  -- 4. Stops: pickup + dropoff je Bestellung
  FOR i IN 1..v_order_count LOOP
    v_order_id := p_order_ids[i];

    SELECT kunde_lat, kunde_lng, kunde_adresse
    INTO v_cust_lat, v_cust_lng, v_cust_addr
    FROM customer_orders
    WHERE id = v_order_id;

    INSERT INTO mise_delivery_batch_stops
      (batch_id, order_id, type, sequence, lat, lng, address)
    VALUES
      (v_mise_batch_id, v_order_id, 'pickup',  (i - 1) * 2,     v_loc_lat,  v_loc_lng,  v_loc_addr),
      (v_mise_batch_id, v_order_id, 'dropoff', (i - 1) * 2 + 1, v_cust_lat, v_cust_lng, v_cust_addr);
  END LOOP;

  -- 5. Customer-Orders: Mise-Felder + Legacy-Kompatibilitätsfelder setzen
  UPDATE customer_orders
  SET mise_batch_id  = v_mise_batch_id,
      mise_driver_id = v_mise_driver_id,
      fahrer_id      = p_employee_id,   -- Legacy-Kompatibilität (Fahrer-Anzeige in Legacy-UI)
      status         = 'unterwegs'
  WHERE id = ANY(p_order_ids);

  -- 6. Driver-Status: Mise-Batch-ID setzen
  UPDATE driver_status
  SET aktueller_batch_id = v_mise_batch_id
  WHERE employee_id = p_employee_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'mise_batch_id',   v_mise_batch_id,
    'legacy_batch_id', NULL             -- Kein Legacy-Batch mehr (Rückwärtskompatibilität)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION assign_to_driver IS
  'Phase 53 (Legacy-Konsolidierung): schreibt ausschließlich in mise_delivery_batches. '
  'delivery_batches wird nicht mehr befüllt. '
  'ensure_mise_driver() stellt sicher dass alle Fahrer einen Mise-Account haben. '
  'Response enthält legacy_batch_id: null für Rückwärtskompatibilität.';


-- ── 3. Index: mise_delivery_batches nach driver_id + state (für Fahrer-App) ──
-- Fahrer-App fragt häufig "aktiver Batch für driver_id X" ab.
-- Ohne Index → Seq-Scan auf großen Batches-Tabellen.
CREATE INDEX IF NOT EXISTS idx_mise_batches_driver_state
  ON mise_delivery_batches (driver_id, state, created_at DESC);
