import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";

export class SendWelcomeEmailCommand {
  public readonly userId: UserId;
  public readonly email: Email;
  public readonly causationId: string | null;

  private constructor(userId: UserId, email: Email, causationId: string | null) {
    this.userId = userId;
    this.email = email;
    this.causationId = causationId;
  }

  public static of(
    userId: string,
    email: string,
    causationId: string | null = null,
  ): SendWelcomeEmailCommand {
    return new SendWelcomeEmailCommand(new UserId(userId), new Email(email), causationId);
  }
}
