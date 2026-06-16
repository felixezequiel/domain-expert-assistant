import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface OrganizationPolicyProps {
  readonly requireSeparateReviewer: boolean;
}

/**
 * Tenant governance policy. `requireSeparateReviewer` (default on) is injected into the
 * Knowledge approval flow (ADR-013) — it is a domain rule there, not authorization.
 */
export class OrganizationPolicy extends ValueObject<OrganizationPolicyProps> {
  public get requireSeparateReviewer(): boolean {
    return this.props.requireSeparateReviewer;
  }

  private constructor(requireSeparateReviewer: boolean) {
    super({ requireSeparateReviewer });
  }

  public static default(): OrganizationPolicy {
    return new OrganizationPolicy(true);
  }

  public static of(requireSeparateReviewer: boolean): OrganizationPolicy {
    return new OrganizationPolicy(requireSeparateReviewer);
  }

  public withRequireSeparateReviewer(requireSeparateReviewer: boolean): OrganizationPolicy {
    return new OrganizationPolicy(requireSeparateReviewer);
  }
}
