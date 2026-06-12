import type { GetUserByIdPort } from "../port/primary/GetUserByIdPort.ts";
import type { UserRepositoryPort } from "../port/secondary/UserRepositoryPort.ts";
import type { GetUserByIdQuery } from "../command/GetUserByIdQuery.ts";
import type { User } from "../../domain/aggregates/User.ts";

export class GetUserByIdUseCase implements GetUserByIdPort {
  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(query: GetUserByIdQuery): Promise<User> {
    const user = await this.userRepository.findById(query.userId);

    if (user === null) {
      throw new Error("User not found: " + query.userId.value);
    }

    return user;
  }
}
