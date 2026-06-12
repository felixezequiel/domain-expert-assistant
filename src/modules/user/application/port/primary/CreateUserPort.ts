import type { UseCase } from "../../../../../shared/application/UseCase.ts";
import type { CreateUserCommand } from "../../command/CreateUserCommand.ts";
import type { User } from "../../../domain/aggregates/User.ts";

export type CreateUserPort = UseCase<CreateUserCommand, User>;
