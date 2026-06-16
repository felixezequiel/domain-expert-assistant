/**
 * Toggle the org governance policy. The organization is the actor context's own tenant
 * (an admin only ever changes their own org), so no org id is carried here.
 */
export class SetOrganizationPolicyCommand {
  public readonly requireSeparateReviewer: boolean;

  private constructor(requireSeparateReviewer: boolean) {
    this.requireSeparateReviewer = requireSeparateReviewer;
  }

  public static of(requireSeparateReviewer: boolean): SetOrganizationPolicyCommand {
    return new SetOrganizationPolicyCommand(requireSeparateReviewer);
  }
}
