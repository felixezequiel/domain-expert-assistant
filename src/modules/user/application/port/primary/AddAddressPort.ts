import type { UseCase } from "../../../../../shared/application/UseCase.ts";
import type { AddAddressCommand } from "../../command/AddAddressCommand.ts";
import type { User } from "../../../domain/aggregates/User.ts";

export type AddAddressPort = UseCase<AddAddressCommand, User>;
