# Test accounts (local / dev only)

These are **throwaway credentials for local development and manual E2E walkthroughs**. They
only ever exist in a local Postgres (`docker compose`) — never in any real deployment — so
they're committed on purpose, so we don't have to recreate or remember them each time.

> ⚠️ Never reuse these emails/passwords for anything real, and never point the seed at a
> non-local database.

## Organization

| Field | Value |
|-------|-------|
| Name | `Acme Knowledge E2E` |
| Provisioned via | `POST /operator/organizations` (operator endpoint, needs `x-operator-secret`) |

## Accounts

| Persona | Email | Password | Roles |
|---------|-------|----------|-------|
| Admin | `ada@e2e.test` | `Passw0rd!23` | `admin` |
| Curator | `carl.curator@e2e.test` | `Curator!23` | `curator` |
| Reviewer | `rita.reviewer@e2e.test` | `Reviewer!23` | `reviewer` |
| Auditor | `amy.auditor@e2e.test` | `Auditor!23` | `auditor` |

The admin can reach every screen (admin implies all capabilities); the others exercise the
role-tailored navigation and the curation → review → publish lifecycle.

## Seeding them

The seed is **idempotent** — if the admin can already log in it does nothing. Against a fresh
database it provisions the org + admin (operator endpoint) and then invites + activates the
members.

```bash
docker compose up -d
npm run migration:up

# Start the server with an operator secret (any value; remember it):
OPERATOR_SECRET=dev-operator-secret npm start

# In another terminal, seed with the SAME secret:
OPERATOR_SECRET=dev-operator-secret npm run seed:test
```

Then open http://localhost:3000 and sign in with any account above.

- `SEED_BASE_URL` overrides the target (defaults to `http://localhost:3000`).
- `OPERATOR_SECRET` must match the value the server was started with (only needed the first
  time — once the org exists, the seed exits early and the secret is irrelevant).
- To start completely fresh, `docker compose down -v` wipes the database; re-run the steps above.

Implemented in [`scripts/seed-test-users.mjs`](../scripts/seed-test-users.mjs).
