\set ON_ERROR_STOP on

DO $assert$
DECLARE
  v_cancel_order uuid;
  v_delivery_order uuid;
  v_cancelled boolean;
BEGIN
  IF (SELECT count(*) FROM dispatch_writer_gates
      WHERE tenant_id='11000000-0000-0000-0000-000000000002'
        AND enabled
        AND writer='atomic_v2'
        AND active_writer_id IN (
          '15000000-0000-0000-0000-000000000011',
          '15000000-0000-0000-0000-000000000012'
        )
        AND writer_epoch=1
        AND lease_expires_at>now())<>1 THEN
    RAISE EXCEPTION
      'two-session tenant writer competition did not elect one exact owner';
  END IF;

  IF (SELECT count(*)
      FROM t02_race_cases c
      WHERE c.iteration BETWEEN 1 AND 100
        AND (SELECT count(*) FROM dispatch_offer_assignments a
             WHERE a.order_id=c.order_id)=1)<>100 THEN
    RAISE EXCEPTION 'not every repeated race produced exactly one assignment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM t02_race_cases c
    JOIN customer_orders o ON o.id=c.order_id
    JOIN dispatch_offer_assignments a ON a.order_id=o.id
    JOIN mise_delivery_batches b ON b.id=a.batch_id
    JOIN mise_drivers d ON d.id=a.driver_id
    WHERE c.iteration BETWEEN 1 AND 100
      AND (
        o.status::text<>'assigned'
        OR o.dispatch_version<>1
        OR o.location_id<>'12000000-0000-0000-0000-000000000001'
        OR o.mise_batch_id IS DISTINCT FROM a.batch_id
        OR o.mise_driver_id IS DISTINCT FROM a.driver_id
        OR o.assignment_deadline_at
             IS DISTINCT FROM '2030-01-01 12:45:00+00'::timestamptz
        OR a.state<>'assigned'
        OR a.assignment_version<>1
        OR a.pickup_deadline_at
             IS DISTINCT FROM '2030-01-01 12:20:00+00'::timestamptz
        OR a.delivery_deadline_at
             IS DISTINCT FROM '2030-01-01 12:45:00+00'::timestamptz
        OR a.tenant_id<>'11000000-0000-0000-0000-000000000001'
        OR a.driver_id NOT IN(c.driver_a,c.driver_b)
        OR b.driver_id IS DISTINCT FROM a.driver_id
        OR b.state<>'assigned'
        OR b.state_version<>1
        OR b.route_version<>1
        OR b.location_id<>'12000000-0000-0000-0000-000000000001'
        OR b.pickup_deadline_at IS DISTINCT FROM a.pickup_deadline_at
        OR b.delivery_deadline_at IS DISTINCT FROM a.delivery_deadline_at
        OR d.state<>'assigned'
        OR d.current_capacity<>1
        OR d.state_version<>1
        OR (SELECT count(*) FROM mise_drivers other
            WHERE other.id IN(c.driver_a,c.driver_b)
              AND other.id<>a.driver_id
              AND other.state='idle'
              AND other.current_capacity=0
              AND other.state_version=0)<>1
        OR (SELECT count(*) FROM mise_delivery_batch_stops s
            WHERE s.batch_id=b.id
              AND s.order_id=o.id
              AND s.type='pickup'
              AND s.sequence=0
              AND s.state='pending'
              AND s.stop_version=0
              AND s.lat=52.0 AND s.lng=13.0
              AND s.address='pickup')<>1
        OR (SELECT count(*) FROM mise_delivery_batch_stops s
            WHERE s.batch_id=b.id
              AND s.order_id=o.id
              AND s.type='dropoff'
              AND s.sequence=1
              AND s.state='pending'
              AND s.stop_version=0
              AND s.lat=52.1 AND s.lng=13.1
              AND s.address='dropoff')<>1
        OR (SELECT count(*) FROM mise_delivery_batch_stops s
            WHERE s.batch_id=b.id)<>2
        OR (SELECT count(*) FROM dispatch_offer_audit da
            WHERE da.order_id=o.id
              AND da.batch_id=b.id
              AND da.driver_id=d.id
              AND da.event_type='assignment.created'
              AND da.outcome='assigned'
              AND da.reason_code='ATOMIC_V2_ASSIGNMENT'
              AND da.correlation_id=a.correlation_id)<>1
        OR (SELECT count(*) FROM dispatch_offer_audit da
            WHERE da.order_id=o.id)<>1
        OR (SELECT count(*) FROM dispatch_assignment_requests_v2 r
            WHERE r.action_id IN(c.action_a,c.action_b)
              AND r.action='assign'
              AND r.correlation_id=a.correlation_id
              AND r.result->>'correlation_id'=a.correlation_id::text
              AND (r.result->>'ok')::boolean)<>1
        OR (SELECT count(*) FROM dispatch_assignment_requests_v2 r
            WHERE r.action_id IN(c.action_a,c.action_b))<>1
        OR (SELECT count(*) FROM mise_push_outbox p
            WHERE p.driver_id=d.id
              AND p.type='order_assigned'
              AND p.data->>'batch_id'=b.id::text
              AND p.data->>'correlation_id'=a.correlation_id::text
              AND p.data->'order_ids' ? o.id::text
              AND p.data->'assignment_ids' ? a.id::text
              AND (p.data->>'delivery_deadline_at')::timestamptz
                    IS NOT DISTINCT FROM a.delivery_deadline_at)<>1
        OR (SELECT count(*) FROM mise_push_outbox p
            WHERE p.data->'order_ids' ? o.id::text)<>1
      )
  ) THEN
    RAISE EXCEPTION 'a repeated race left divergent atomic projections';
  END IF;

  IF EXISTS (
    SELECT order_id
    FROM dispatch_offer_assignments
    WHERE state IN ('offered','accepted','assigned','picked_up','in_progress')
    GROUP BY order_id HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'active-order database invariant violated';
  END IF;

  IF (SELECT count(*) FROM dispatch_offer_assignments a
      JOIN t02_race_cases c ON c.order_id=a.order_id
      WHERE c.iteration=101 AND a.state='assigned'
        AND a.assignment_version=1)<>1
     OR (SELECT count(*) FROM dispatch_assignment_requests_v2 r
         JOIN t02_race_cases c ON c.action_a=r.action_id
         WHERE c.iteration=101 AND r.action='assign')<>1
     OR (SELECT count(*) FROM dispatch_offer_audit a
         JOIN t02_race_cases c ON c.order_id=a.order_id
         WHERE c.iteration=101 AND a.event_type='assignment.created')<>1
     OR (SELECT count(*) FROM mise_push_outbox p
         JOIN dispatch_offer_assignments a
           ON p.data->>'correlation_id'=a.correlation_id::text
         JOIN t02_race_cases c ON c.order_id=a.order_id
         WHERE c.iteration=101 AND p.type='order_assigned')<>1 THEN
    RAISE EXCEPTION 'two-session same-key replay diverged';
  END IF;

  IF (SELECT count(*) FROM dispatch_offer_assignments a
      JOIN t02_race_cases c ON c.order_id=a.order_id
      WHERE c.iteration=102 AND a.state='assigned'
        AND a.assignment_version=1)<>1
     OR (SELECT count(*) FROM dispatch_assignment_requests_v2 r
         JOIN t02_race_cases c ON c.action_a=r.action_id
         WHERE c.iteration=102 AND r.action='assign')<>1
     OR (SELECT count(*) FROM dispatch_offer_audit a
         JOIN t02_race_cases c ON c.order_id=a.order_id
         WHERE c.iteration=102 AND a.event_type='assignment.created')<>1
     OR (SELECT count(*) FROM mise_push_outbox p
         JOIN dispatch_offer_assignments a
           ON p.data->>'correlation_id'=a.correlation_id::text
         JOIN t02_race_cases c ON c.order_id=a.order_id
         WHERE c.iteration=102 AND p.type='order_assigned')<>1 THEN
    RAISE EXCEPTION 'two-session fingerprint conflict diverged';
  END IF;

  SELECT order_id INTO STRICT v_cancel_order
  FROM t02_race_cases WHERE iteration=103;
  SELECT status::text='cancelled' INTO STRICT v_cancelled
  FROM customer_orders WHERE id=v_cancel_order;

  IF v_cancelled THEN
    IF NOT EXISTS (
      SELECT 1
      FROM t02_race_cases c
      JOIN dispatch_offer_assignments a ON a.order_id=c.order_id
      JOIN mise_delivery_batches b ON b.id=a.batch_id
      JOIN mise_drivers d ON d.id=a.driver_id
      JOIN customer_orders o ON o.id=a.order_id
      WHERE c.iteration=103
        AND o.status::text='cancelled'
        AND o.dispatch_version=2
        AND o.mise_batch_id IS NULL
        AND o.mise_driver_id IS NULL
        AND o.assignment_deadline_at IS NULL
        AND a.state='cancelled'
        AND a.assignment_version=2
        AND a.pickup_deadline_at
              ='2030-01-01 12:20:00+00'::timestamptz
        AND a.delivery_deadline_at
              ='2030-01-01 12:45:00+00'::timestamptz
        AND b.state='cancelled'
        AND b.state_version=2
        AND b.route_version=1
        AND b.location_id='12000000-0000-0000-0000-000000000001'
        AND b.pickup_deadline_at IS NOT DISTINCT FROM a.pickup_deadline_at
        AND b.delivery_deadline_at IS NOT DISTINCT FROM a.delivery_deadline_at
        AND d.state='idle'
        AND d.current_capacity=0
        AND d.state_version=2
        AND (SELECT count(*) FROM mise_delivery_batch_stops s
             WHERE s.batch_id=b.id
               AND s.state='cancelled'
               AND s.stop_version=1) = 2
        AND (SELECT count(*) FROM mise_delivery_batch_stops s
             WHERE s.batch_id=b.id) = 2
        AND (SELECT count(*) FROM dispatch_offer_audit da
             WHERE da.order_id=o.id
               AND da.event_type IN(
                 'assignment.created','assignment.cancelled'
               ))=2
        AND (SELECT count(*) FROM dispatch_offer_audit da
             JOIN dispatch_assignment_requests_v2 r
               ON r.correlation_id=da.correlation_id
             WHERE da.order_id=o.id
               AND (
                 (da.event_type='assignment.created' AND r.action='assign')
                 OR
                 (da.event_type='assignment.cancelled' AND r.action='cancel')
               ))=2
        AND (SELECT count(*) FROM dispatch_assignment_requests_v2 r
             WHERE r.action_id IN(c.action_a,c.action_b)
               AND r.action IN('assign','cancel'))=2
        AND (SELECT count(*) FROM mise_push_outbox p
             WHERE p.data->>'order_id'=o.id::text
                OR p.data->'order_ids' ? o.id::text)=2
        AND (SELECT count(*) FROM mise_push_outbox p
             JOIN dispatch_assignment_requests_v2 r
               ON p.data->>'correlation_id'=r.correlation_id::text
             WHERE r.action_id IN(c.action_a,c.action_b)
               AND (
                 (r.action='assign' AND p.type='order_assigned')
                 OR
                 (r.action='cancel' AND p.type='assignment_cancelled')
               ))=2
    ) THEN
      RAISE EXCEPTION
        'cancellation winner did not leave exact terminal projections';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM t02_race_cases c
      JOIN customer_orders o ON o.id=c.order_id
      JOIN dispatch_offer_assignments a ON a.order_id=o.id
      JOIN mise_delivery_batches b ON b.id=a.batch_id
      JOIN mise_drivers d ON d.id=a.driver_id
      WHERE c.iteration=103
        AND o.status::text='assigned'
        AND o.dispatch_version=1
        AND o.assignment_deadline_at
              ='2030-01-01 12:45:00+00'::timestamptz
        AND a.state='assigned' AND a.assignment_version=1
        AND b.state='assigned' AND b.state_version=1
        AND d.state='assigned' AND d.current_capacity=1
        AND d.state_version=1
        AND (SELECT count(*) FROM mise_delivery_batch_stops s
             WHERE s.batch_id=b.id AND s.state='pending'
               AND s.stop_version=0)=2
        AND (SELECT count(*) FROM dispatch_offer_audit da
             WHERE da.order_id=o.id
               AND da.event_type='assignment.created')=1
        AND (SELECT count(*) FROM dispatch_assignment_requests_v2 r
             WHERE r.action_id IN(c.action_a,c.action_b)
               AND r.action='assign')=1
        AND NOT EXISTS (
          SELECT 1 FROM dispatch_assignment_requests_v2 r
          WHERE r.action_id=c.action_b
        )
        AND (SELECT count(*) FROM mise_push_outbox p
             WHERE p.data->'order_ids' ? o.id::text
               AND p.type='order_assigned')=1
    ) THEN
      RAISE EXCEPTION
        'assignment winner did not leave exact canonical projections';
    END IF;
  END IF;

  SELECT order_id INTO STRICT v_delivery_order
  FROM t02_race_cases WHERE iteration=104;
  IF NOT EXISTS (
    SELECT 1
    FROM t02_race_cases c
    JOIN customer_orders o ON o.id=c.order_id
    JOIN dispatch_offer_assignments a ON a.order_id=o.id
    JOIN mise_delivery_batches b ON b.id=a.batch_id
    JOIN mise_drivers d ON d.id=a.driver_id
    WHERE c.iteration=104
      AND o.status::text='delivered'
      AND o.dispatch_version=4
      AND o.mise_batch_id=a.batch_id
      AND o.mise_driver_id=a.driver_id
      AND o.assignment_deadline_at IS NOT DISTINCT FROM a.delivery_deadline_at
      AND o.geliefert_am IS NOT NULL
      AND a.state='completed'
      AND a.assignment_version=4
      AND a.driver_id=c.driver_a
      AND a.pickup_deadline_at IS NOT NULL
      AND a.delivery_deadline_at>a.pickup_deadline_at
      AND b.state='completed'
      AND b.state_version=4
      AND b.route_version=1
      AND b.location_id='12000000-0000-0000-0000-000000000001'
      AND b.pickup_deadline_at IS NOT DISTINCT FROM a.pickup_deadline_at
      AND b.delivery_deadline_at IS NOT DISTINCT FROM a.delivery_deadline_at
      AND b.picked_up_at IS NOT NULL
      AND b.completed_at IS NOT NULL
      AND d.state='returning'
      AND d.current_capacity=0
      AND d.state_version=4
      AND (SELECT count(*) FROM mise_delivery_batch_stops s
           WHERE s.batch_id=b.id
             AND s.order_id=o.id
             AND s.type='pickup'
             AND s.sequence=0
             AND s.state='completed'
             AND s.stop_version=1
             AND s.completed_at IS NOT NULL)=1
      AND (SELECT count(*) FROM mise_delivery_batch_stops s
           WHERE s.batch_id=b.id
             AND s.order_id=o.id
             AND s.type='dropoff'
             AND s.sequence=1
             AND s.state='completed'
             AND s.stop_version=1
             AND s.completed_at IS NOT NULL)=1
      AND (SELECT count(*) FROM mise_delivery_batch_stops s
           WHERE s.batch_id=b.id)=2
      AND (SELECT count(*) FROM dispatch_offer_audit da
           WHERE da.order_id=o.id
             AND da.event_type IN(
               'assignment.created','assignment.picked_up',
               'assignment.in_progress','assignment.completed'
             ))=4
      AND (SELECT count(*) FROM dispatch_offer_audit da
           JOIN dispatch_assignment_requests_v2 r
             ON r.correlation_id=da.correlation_id
           WHERE da.order_id=o.id
             AND (
               (da.event_type='assignment.created' AND r.action='assign')
               OR
               (da.event_type='assignment.picked_up'
                    AND r.action='confirm_pickup')
               OR
               (da.event_type='assignment.in_progress'
                    AND r.action='start_delivery')
               OR
               (da.event_type='assignment.completed'
                    AND r.action='complete_delivery')
             ))=4
      AND (SELECT count(*) FROM dispatch_assignment_requests_v2 r
           WHERE r.correlation_id IN(
             SELECT da.correlation_id FROM dispatch_offer_audit da
             WHERE da.order_id=o.id
           ))=4
      AND (SELECT count(*) FROM mise_push_outbox p
           WHERE p.data->'order_ids' ? o.id::text
             AND p.type='order_assigned')=1
      AND (SELECT count(*) FROM mise_push_outbox p
           JOIN dispatch_assignment_requests_v2 r
             ON p.data->>'correlation_id'=r.correlation_id::text
           WHERE r.action='assign'
             AND r.action_id=c.action_a
             AND p.type='order_assigned')=1
      AND NOT EXISTS (
        SELECT 1
        FROM mise_push_outbox p
        JOIN dispatch_assignment_requests_v2 r
          ON p.data->>'correlation_id'=r.correlation_id::text
        WHERE r.action='complete_delivery'
          AND r.action_id=c.action_b
      )
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_assignment_requests_v2 r
        WHERE r.action_id='16000000-0000-0000-0000-000000000104'
      )
      AND (SELECT count(*) FROM dispatch_offer_assignments other
           WHERE other.order_id=o.id)=1
  ) THEN
    RAISE EXCEPTION
      'reassignment-vs-delivery did not preserve exact custody projections';
  END IF;
END
$assert$;
