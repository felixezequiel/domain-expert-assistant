import { CredentialId } from "../../domain/identifiers/CredentialId.ts";

export class RotateConsumerCredentialCommand {
  public readonly credentialId: CredentialId;

  private constructor(credentialId: CredentialId) {
    this.credentialId = credentialId;
  }

  public static of(credentialId: string): RotateConsumerCredentialCommand {
    return new RotateConsumerCredentialCommand(new CredentialId(credentialId));
  }
}
