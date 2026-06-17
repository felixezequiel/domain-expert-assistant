import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

interface OrganizationNameProps {
  readonly value: string;
}

const MAX_ORGANIZATION_NAME_LENGTH = 200;

export class OrganizationName extends ValueObject<OrganizationNameProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_ORGANIZATION_NAME_LENGTH) {
      throw new DomainError(
        "identity.organizationNameLength",
        "internal",
        { max: MAX_ORGANIZATION_NAME_LENGTH },
        "Organization name must be 1.." + MAX_ORGANIZATION_NAME_LENGTH + " characters",
      );
    }
    super({ value: trimmed });
  }
}
