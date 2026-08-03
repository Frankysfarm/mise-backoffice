SELECT public.fn_dispatch_set_writer_v2(
  '80000000-0000-4000-8000-000000000001', 'atomic_v2', true
);
SELECT public.fn_dispatch_claim_writer_v2(
  '80000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001', 120
);
