import { CredentialId } from "../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/**
 * Issue a consumer API key. Collection ids reference Knowledge collections (PRD-2) by id;
 * their existence within the org is validated at runtime by the use case once Collections
 * exist (PRD-1 §12) — no cross-context type import or FK here.
 */
export class IssueConsumerCredentialCommand {
  public readonly credentialId: CredentialId;
  public readonly name: string;
  public readonly scope: CredentialScope;

  private constructor(credentialId: CredentialId, name: string, scope: CredentialScope) {
    this.credentialId = credentialId;
    this.name = name;
    this.scope = scope;
  }

  public static of(
    credentialId: string,
    name: string,
    collectionIds: ReadonlyArray<string>,
    sensitivityCeiling: string,
  ): IssueConsumerCredentialCommand {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new DomainError(
        "identity.credentialNameRequired",
        "validation",
        undefined,
        "Credential name is required",
      );
    }
    return new IssueConsumerCredentialCommand(
      new CredentialId(credentialId),
      trimmedName,
      CredentialScope.of(collectionIds, SensitivityLevel.of(sensitivityCeiling)),
    );
  }
}
