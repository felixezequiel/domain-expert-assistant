import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DescribeInvitationUseCase } from "./DescribeInvitationUseCase.ts";
import {
  FakeUserRepository,
  FakeOrganizationRepository,
  FakeOpaqueSecret,
} from "../testDoubles/index.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../domain/valueObjects/OrganizationName.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";

const COMPANY = "company-1";
const TOKEN = "invite-token";

function buildUseCase(): {
  useCase: DescribeInvitationUseCase;
  users: FakeUserRepository;
  organizations: FakeOrganizationRepository;
  opaqueSecret: FakeOpaqueSecret;
} {
  const users = new FakeUserRepository();
  const organizations = new FakeOrganizationRepository();
  const opaqueSecret = new FakeOpaqueSecret();
  const useCase = new DescribeInvitationUseCase(users, organizations, opaqueSecret);
  return { useCase, users, organizations, opaqueSecret };
}

async function seedInvitedUser(
  users: FakeUserRepository,
  opaqueSecret: FakeOpaqueSecret,
): Promise<void> {
  await users.save(
    User.invite(
      new UserId("user-1"),
      COMPANY,
      new Email("carl@example.test"),
      new DisplayName("Carl Curator"),
      ["curator", "reviewer"],
      opaqueSecret.hash(TOKEN),
    ),
  );
}

describe("DescribeInvitationUseCase", () => {
  it("describes a pending invitation: org name, invitee email, and assigned roles", async () => {
    const { useCase, users, organizations, opaqueSecret } = buildUseCase();
    await organizations.save(Organization.provision(new OrganizationId(COMPANY), new OrganizationName("Acme Inc")));
    await seedInvitedUser(users, opaqueSecret);

    const invitation = await useCase.execute(TOKEN);

    assert.deepEqual(invitation, {
      organizationName: "Acme Inc",
      email: "carl@example.test",
      roles: ["curator", "reviewer"],
    });
  });

  it("returns null for an unknown token", async () => {
    const { useCase } = buildUseCase();

    assert.equal(await useCase.execute("nope"), null);
  });

  it("returns null once the invitation has been accepted (token no longer pending)", async () => {
    const { useCase, users, organizations, opaqueSecret } = buildUseCase();
    await organizations.save(Organization.provision(new OrganizationId(COMPANY), new OrganizationName("Acme Inc")));
    await seedInvitedUser(users, opaqueSecret);
    const invited = await users.findByInvitationTokenHash(opaqueSecret.hash(TOKEN));
    invited!.activate({ value: "h:secret" } as never);
    await users.save(invited!);

    assert.equal(await useCase.execute(TOKEN), null);
  });
});
