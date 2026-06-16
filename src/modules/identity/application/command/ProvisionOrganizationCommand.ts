import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../domain/valueObjects/OrganizationName.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";

/**
 * Provisions a tenant plus its first Admin (the only path without self-service signup,
 * PRD-1). The admin password is plaintext here; the use case hashes it via the
 * PasswordHasherPort and never persists it in the clear (ADR-010).
 */
export class ProvisionOrganizationCommand {
  public readonly organizationId: OrganizationId;
  public readonly organizationName: OrganizationName;
  public readonly adminUserId: UserId;
  public readonly adminEmail: Email;
  public readonly adminDisplayName: DisplayName;
  public readonly adminPassword: string;

  private constructor(
    organizationId: OrganizationId,
    organizationName: OrganizationName,
    adminUserId: UserId,
    adminEmail: Email,
    adminDisplayName: DisplayName,
    adminPassword: string,
  ) {
    this.organizationId = organizationId;
    this.organizationName = organizationName;
    this.adminUserId = adminUserId;
    this.adminEmail = adminEmail;
    this.adminDisplayName = adminDisplayName;
    this.adminPassword = adminPassword;
  }

  public static of(
    organizationId: string,
    organizationName: string,
    adminUserId: string,
    adminEmail: string,
    adminDisplayName: string,
    adminPassword: string,
  ): ProvisionOrganizationCommand {
    return new ProvisionOrganizationCommand(
      new OrganizationId(organizationId),
      new OrganizationName(organizationName),
      new UserId(adminUserId),
      new Email(adminEmail),
      new DisplayName(adminDisplayName),
      adminPassword,
    );
  }
}
