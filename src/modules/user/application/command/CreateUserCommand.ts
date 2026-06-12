import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";

export class CreateUserCommand {
  public readonly userId: UserId;
  public readonly name: string;
  public readonly email: Email;

  private constructor(userId: UserId, name: string, email: Email) {
    this.userId = userId;
    this.name = name;
    this.email = email;
  }

  public static of(userId: string, name: string, email: string): CreateUserCommand {
    return new CreateUserCommand(new UserId(userId), name, new Email(email));
  }
}
