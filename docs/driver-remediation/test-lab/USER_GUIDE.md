# Test-lab user guide

Set only isolated values, then use the CLI. A minimal local invocation is:

```sh
MISE_TEST_LAB_ENABLED=true \
MISE_TEST_LAB_ENV=local \
MISE_TEST_LAB_DATABASE_URL=postgresql://lab:lab@127.0.0.1:5432/mise_driver_test \
MISE_TEST_LAB_TENANT_ID=testlab_operator \
MISE_TEST_LAB_PUSH_MODE=sink \
MISE_TEST_LAB_EMAIL_MODE=sink \
MISE_TEST_LAB_SMS_MODE=sink \
MISE_TEST_LAB_WHATSAPP_MODE=sink \
MISE_TEST_LAB_ROUTING_MODE=fixture \
npm run test:lab:smoke
```

The generated run ID and seed are printed. Reports are under
`artifacts/driver-system-lab/<run-id>/`. The dashboard route is `/test-lab`
and is a hard 404 unless explicitly enabled outside production. It currently
offers catalog/filter/seed/headed preview; execution intentionally remains CLI
only until authenticated pause/abort leases have their own gate evidence.
