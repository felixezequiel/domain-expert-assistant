#!/usr/bin/env node
/*
 * Seeds a fixed set of TEST-ONLY users + demo knowledge items for local development and
 * manual E2E walkthroughs. These are intentionally committed (see docs/test-accounts.md) —
 * they only ever exist in a local/dev database.
 *
 * Two idempotent steps:
 *   1. Accounts — if the admin can log in, reuse it; otherwise provision the org (operator
 *      endpoint) + admin, then invite and activate the members.
 *   2. Demo items — if the "Knowledge Lifecycle Demo" collection exists, skip; otherwise
 *      create one item in EACH lifecycle state (draft, in_review, published, deprecated,
 *      archived) so a dev sees the whole system at a glance. The published item carries four
 *      genuinely-different versions to exercise the version-compare (Monaco) diff.
 *
 * Requires the server running with the SAME OPERATOR_SECRET this script is given (only needed
 * the first time, to provision). Usage:
 *   docker compose up -d && npm run migration:up
 *   OPERATOR_SECRET=dev-secret npm start            # in one terminal
 *   OPERATOR_SECRET=dev-secret npm run seed:test    # in another
 */

const BASE_URL = process.env.SEED_BASE_URL ?? "http://localhost:3000";
const OPERATOR_SECRET = process.env.OPERATOR_SECRET ?? "";
const ORGANIZATION_NAME = "Acme Knowledge E2E";
const SESSION_COOKIE_NAME = "des_session";
const HTTP_OK = 200;
const HTTP_CREATED = 201;

const ADMIN = { email: "ada@e2e.test", displayName: "Ada Admin", password: "Passw0rd!23" };
const CURATOR = { email: "carl.curator@e2e.test", displayName: "Carl Curator", password: "Curator!23", roles: ["curator"] };
const REVIEWER = { email: "rita.reviewer@e2e.test", displayName: "Rita Reviewer", password: "Reviewer!23", roles: ["reviewer"] };
const AUDITOR = { email: "amy.auditor@e2e.test", displayName: "Amy Auditor", password: "Auditor!23", roles: ["auditor"] };
const MEMBERS = [CURATOR, REVIEWER, AUDITOR];

const DEMO_COLLECTION = "Knowledge Lifecycle Demo";
const SENSITIVITY = "internal";

// --- HTTP helpers ---

async function api(method, path, { body, cookie, headers = {} } = {}) {
  const allHeaders = { ...headers };
  if (body !== undefined) {
    allHeaders["Content-Type"] = "application/json";
  }
  if (cookie) {
    allHeaders.Cookie = cookie;
  }
  const response = await fetch(BASE_URL + path, {
    method,
    headers: allHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  return { status: response.status, payload, setCookie: response.headers.get("set-cookie") };
}

function readSessionCookie(setCookieHeader) {
  if (setCookieHeader === null) {
    return null;
  }
  const match = new RegExp(SESSION_COOKIE_NAME + "=[^;]+").exec(setCookieHeader);
  return match === null ? null : match[0];
}

async function loginCookie(email, password) {
  const result = await api("POST", "/auth/login", { body: { email, password } });
  if (result.status !== HTTP_OK) {
    throw new Error("Login failed for " + email + " (" + result.status + ").");
  }
  const cookie = readSessionCookie(result.setCookie);
  if (cookie === null) {
    throw new Error("Could not read the session cookie for " + email + ".");
  }
  return cookie;
}

// Calls an endpoint and throws on an unexpected status, returning the JSON payload.
async function call(method, path, { body, cookie, expect = [HTTP_OK, HTTP_CREATED] } = {}) {
  const result = await api(method, path, { body, cookie });
  if (!expect.includes(result.status)) {
    throw new Error(method + " " + path + " -> " + result.status + ": " + JSON.stringify(result.payload));
  }
  return result.payload;
}

// --- step 1: accounts ---

async function ensureAccounts() {
  const probe = await api("POST", "/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
  if (probe.status === HTTP_OK) {
    process.stdout.write("Accounts already present (" + ADMIN.email + " can log in).\n");
    return readSessionCookie(probe.setCookie);
  }

  if (OPERATOR_SECRET === "") {
    throw new Error(
      "OPERATOR_SECRET is required to provision the test org. Start the server with it and pass the same value here.",
    );
  }

  const provision = await api(
    "POST",
    "/operator/organizations",
    {
      body: {
        organizationName: ORGANIZATION_NAME,
        adminEmail: ADMIN.email,
        adminDisplayName: ADMIN.displayName,
        adminPassword: ADMIN.password,
      },
      headers: { "x-operator-secret": OPERATOR_SECRET },
    },
  );
  if (provision.status !== HTTP_CREATED) {
    throw new Error("Provisioning failed (" + provision.status + "): " + JSON.stringify(provision.payload));
  }
  const organizationId = provision.payload.organizationId;
  process.stdout.write('Provisioned "' + ORGANIZATION_NAME + '" (' + organizationId + ") with admin " + ADMIN.email + ".\n");

  const cookie = await loginCookie(ADMIN.email, ADMIN.password);
  for (const member of MEMBERS) {
    const invite = await call(
      "POST",
      "/organizations/" + organizationId + "/users/invite",
      { body: { email: member.email, displayName: member.displayName, roles: member.roles }, cookie, expect: [HTTP_CREATED] },
    );
    await call(
      "POST",
      "/invitations/" + encodeURIComponent(invite.invitationToken) + "/accept",
      { body: { password: member.password }, expect: [HTTP_OK] },
    );
    process.stdout.write("Created " + member.email + " [" + member.roles.join(", ") + "].\n");
  }
  return cookie;
}

// --- step 2: demo knowledge items in every lifecycle state ---

function lines(...rows) {
  return rows.join("\n") + "\n";
}

// Four genuinely-different revisions of the same doc, so the version-compare diff is rich.
const ONBOARDING_TITLE = "Customer Onboarding Guide";
const ONBOARDING_VERSIONS = [
  lines("# Customer Onboarding Guide", "", "A short guide to onboarding a new customer.", "", "## Steps", "1. Create the account", "2. Send the welcome email"),
  lines("# Customer Onboarding Guide", "", "A short guide to onboarding a new customer.", "", "## Prerequisites", "- A signed contract", "- An assigned account manager", "", "## Steps", "1. Create the account", "2. Configure the workspace", "3. Send the welcome email"),
  lines("# Customer Onboarding Guide", "", "This guide walks an account manager through onboarding a new customer end to end.", "", "## Prerequisites", "- A signed contract", "- An assigned account manager", "- Billing details on file", "", "## Steps", "1. Create the account in the admin console", "2. Configure the workspace and default roles", "3. Invite the customer's admin user", "4. Send the welcome email", "", "## Troubleshooting", "If the welcome email bounces, verify the domain's SPF record."),
  lines("# Customer Onboarding Guide", "", "This guide walks an account manager through onboarding a new customer end to end,", "from signed contract to the customer's first successful login.", "", "## Prerequisites", "- A signed contract", "- An assigned account manager", "- Billing details on file", "", "## Onboarding steps", "1. Create the account in the admin console", "2. Configure the workspace, default roles, and SSO", "3. Invite the customer's admin user", "4. Schedule the kickoff call", "5. Send the welcome email", "", "## SLA", "First response within one business day; onboarding completed within five business days."),
];

const DEPRECATED_BODY = lines("# Incident Response Runbook", "", "During an incident, page the on-call, open a bridge, and follow the severity matrix.", "", "> Superseded by the new incident process — kept for reference.");
const ARCHIVED_BODY = lines("# Legacy Billing Flow (sunset)", "", "The pre-2026 manual billing flow. Retired; replaced by automated invoicing.");
const IN_REVIEW_BODY = lines("# Refund Policy", "", "Customers may request a refund within 30 days of purchase.", "", "Awaiting reviewer approval.");
const DRAFT_BODY = lines("# Release Notes — Q3 (draft)", "", "Work in progress. Highlights:", "- Faster search", "- New audit filters");

async function ensureKnowledgeItems(adminCookie) {
  const curator = await loginCookie(CURATOR.email, CURATOR.password);
  const reviewer = await loginCookie(REVIEWER.email, REVIEWER.password);

  const collections = (await call("GET", "/collections", { cookie: curator })).collections ?? [];
  if (collections.some((collection) => collection.name === DEMO_COLLECTION)) {
    process.stdout.write('Demo items already present (collection "' + DEMO_COLLECTION + '"). Skipping.\n');
    return;
  }

  const collectionId = (await call("POST", "/collections", {
    body: { name: DEMO_COLLECTION, description: "One knowledge item in each lifecycle state." },
    cookie: adminCookie,
  })).id;

  const createItem = async (title, body) =>
    (await call("POST", "/items", { body: { collectionId, title, body, tagIds: [], sensitivity: SENSITIVITY }, cookie: curator })).id;
  const editItem = (id, title, body) =>
    call("PUT", "/items/" + id, { body: { title, body, sensitivity: SENSITIVITY, tagIds: [] }, cookie: curator });
  const submit = (id) => call("POST", "/items/" + id + "/submit", { cookie: curator });
  const approve = (id) => call("POST", "/items/" + id + "/approve", { cookie: reviewer });
  const deprecate = (id) => call("POST", "/items/" + id + "/deprecate", { cookie: reviewer });
  const archive = (id) => call("POST", "/items/" + id + "/archive", { cookie: reviewer });

  // published — author the 4 versions, then submit + approve (separate reviewer)
  const published = await createItem(ONBOARDING_TITLE, ONBOARDING_VERSIONS[0]);
  for (let index = 1; index < ONBOARDING_VERSIONS.length; index += 1) {
    await editItem(published, ONBOARDING_TITLE, ONBOARDING_VERSIONS[index]);
  }
  await submit(published);
  await approve(published);

  // deprecated — published then deprecated (still served, flagged stale)
  const deprecated = await createItem("Incident Response Runbook", DEPRECATED_BODY);
  await submit(deprecated);
  await approve(deprecated);
  await deprecate(deprecated);

  // archived — published then archived (out of service)
  const archived = await createItem("Legacy Billing Flow (sunset)", ARCHIVED_BODY);
  await submit(archived);
  await approve(archived);
  await archive(archived);

  // in_review — submitted, awaiting approval
  const inReview = await createItem("Refund Policy", IN_REVIEW_BODY);
  await submit(inReview);

  // draft — never submitted
  await createItem("Release Notes — Q3 (draft)", DRAFT_BODY);

  process.stdout.write(
    'Seeded demo items in "' + DEMO_COLLECTION + '": published (4 versions), in_review, draft, deprecated, archived.\n',
  );
}

async function main() {
  const adminCookie = await ensureAccounts();
  await ensureKnowledgeItems(adminCookie);
  process.stdout.write("Done — see docs/test-accounts.md for the credentials.\n");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exit(1);
});
