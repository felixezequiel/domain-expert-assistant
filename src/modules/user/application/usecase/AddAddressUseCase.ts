import type { AddAddressPort } from "../port/primary/AddAddressPort.ts";
import type { UserRepositoryPort } from "../port/secondary/UserRepositoryPort.ts";
import type { AddAddressCommand } from "../command/AddAddressCommand.ts";
import type { User } from "../../domain/aggregates/User.ts";

export class AddAddressUseCase implements AddAddressPort {
  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(command: AddAddressCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId);

    if (user === null) {
      throw new Error("User not found: " + command.userId.value);
    }

    user.addAddress(
      command.addressId,
      command.street,
      command.number,
      command.city,
      command.state,
      command.zipCode,
    );

    return user;
  }
}
