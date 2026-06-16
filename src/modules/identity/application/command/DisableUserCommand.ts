import { UserId } from "../../domain/identifiers/UserId.ts";

export class DisableUserCommand {
  public readonly userId: UserId;

  private constructor(userId: UserId) {
    this.userId = userId;
  }

  public static of(userId: string): DisableUserCommand {
    return new DisableUserCommand(new UserId(userId));
  }
}
