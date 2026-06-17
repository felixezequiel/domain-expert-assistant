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

## Demo knowledge items (all lifecycle states)

The seed also creates a **"Knowledge Lifecycle Demo"** collection with one item in **each**
state, so a dev sees the whole system at a glance:

| State | Item |
|-------|------|
| `draft` | Release Notes — Q3 (draft) |
| `in_review` | Refund Policy |
| `published` | Customer Onboarding Guide — **4 different versions**, to exercise the Monaco version-compare diff |
| `deprecated` | Incident Response Runbook |
| `archived` | Legacy Billing Flow (sunset) |

Authored by the curator and approved by the reviewer (honours `requireSeparateReviewer`).

## Seeding them

The seed runs **two idempotent steps**: (1) accounts — if the admin can already log in it
reuses them, otherwise it provisions the org + admin (operator endpoint) and invites +
activates the members; (2) demo items — if the "Knowledge Lifecycle Demo" collection exists it
skips, otherwise it creates the items above.

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
