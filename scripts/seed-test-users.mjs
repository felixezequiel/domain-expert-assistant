#!/usr/bin/env node
/*
 * Seeds a fixed set of TEST-ONLY users for local development and manual E2E walkthroughs.
 * These credentials are intentionally committed (see docs/test-accounts.md) — they only ever
 * exist in a local/dev database.
 *
 * Idempotent: if the admin can already log in, it exits without changes; otherwise it
 * provisions the org (operator endpoint) + admin, then invites and activates the members.
 *
 * Requires the server running with the SAME OPERATOR_SECRET this script is given. Usage:
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
const MEMBERS = [
  { email: "carl.curator@e2e.test", displayName: "Carl Curator", password: "Curator!23", roles: ["curator"] },
  { email: "rita.reviewer@e2e.test", displayName: "Rita Reviewer", password: "Reviewer!23", roles: ["reviewer"] },
  { email: "amy.auditor@e2e.test", displayName: "Amy Auditor", password: "Auditor!23", roles: ["auditor"] },
];

async function postJson(path, body, headers = {}) {
  const response = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
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

async function main() {
  const probe = await postJson("/auth/login", { email: ADMIN.email, password: ADMIN.password });
  if (probe.status === HTTP_OK) {
    process.stdout.write(`Test users already present (${ADMIN.email} can log in). Nothing to do.\n`);
    return;
  }

  if (OPERATOR_SECRET === "") {
    throw new Error(
      "OPERATOR_SECRET is required to provision the test org. Start the server with it and pass the same value here.",
    );
  }

  const provision = await postJson(
    "/operator/organizations",
    {
      organizationName: ORGANIZATION_NAME,
      adminEmail: ADMIN.email,
      adminDisplayName: ADMIN.displayName,
      adminPassword: ADMIN.password,
    },
    { "x-operator-secret": OPERATOR_SECRET },
  );
  if (provision.status !== HTTP_CREATED) {
    throw new Error("Provisioning failed (" + provision.status + "): " + JSON.stringify(provision.payload));
  }
  const organizationId = provision.payload.organizationId;
  process.stdout.write('Provisioned "' + ORGANIZATION_NAME + '" (' + organizationId + ") with admin " + ADMIN.email + ".\n");

  const adminLogin = await postJson("/auth/login", { email: ADMIN.email, password: ADMIN.password });
  const cookie = readSessionCookie(adminLogin.setCookie);
  if (cookie === null) {
    throw new Error("Could not read the admin session cookie after login.");
  }

  for (const member of MEMBERS) {
    const invite = await postJson(
      "/organizations/" + organizationId + "/users/invite",
      { email: member.email, displayName: member.displayName, roles: member.roles },
      { Cookie: cookie },
    );
    if (invite.status !== HTTP_CREATED) {
      throw new Error("Invite failed for " + member.email + " (" + invite.status + "): " + JSON.stringify(invite.payload));
    }
    const accept = await postJson(
      "/invitations/" + encodeURIComponent(invite.payload.invitationToken) + "/accept",
      { password: member.password },
    );
    if (accept.status !== HTTP_OK) {
      throw new Error("Activation failed for " + member.email + " (" + accept.status + "): " + JSON.stringify(accept.payload));
    }
    process.stdout.write("Created " + member.email + " [" + member.roles.join(", ") + "].\n");
  }

  process.stdout.write("Done — see docs/test-accounts.md for the credentials.\n");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exit(1);
});
