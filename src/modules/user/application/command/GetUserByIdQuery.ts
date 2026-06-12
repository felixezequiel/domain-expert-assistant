import { UserId } from "../../domain/identifiers/UserId.ts";

export class GetUserByIdQuery {
  public readonly userId: UserId;

  private constructor(userId: UserId) {
    this.userId = userId;
  }

  public static of(userId: string): GetUserByIdQuery {
    return new GetUserByIdQuery(new UserId(userId));
  }
}
