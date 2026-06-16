import { CredentialId } from "../../domain/identifiers/CredentialId.ts";

export class RevokeConsumerCredentialCommand {
  public readonly credentialId: CredentialId;

  private constructor(credentialId: CredentialId) {
    this.credentialId = credentialId;
  }

  public static of(credentialId: string): RevokeConsumerCredentialCommand {
    return new RevokeConsumerCredentialCommand(new CredentialId(credentialId));
  }
}
