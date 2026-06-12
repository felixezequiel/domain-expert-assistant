import type { CreateUserPort } from "../port/primary/CreateUserPort.ts";
import type { UserRepositoryPort } from "../port/secondary/UserRepositoryPort.ts";
import type { CreateUserCommand } from "../command/CreateUserCommand.ts";
import { User } from "../../domain/aggregates/User.ts";

export class CreateUserUseCase implements CreateUserPort {
  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(command: CreateUserCommand): Promise<User> {
    const emailValue = command.email.value;
    const existingUser = await this.userRepository.findByEmail(emailValue);

    if (existingUser !== null) {
      throw new Error("User with email " + emailValue + " already exists");
    }

    return User.create(command.userId, command.name, command.email);
  }
}
