import type { UseCase } from "../../../../../shared/application/UseCase.ts";
import type { GetUserByIdQuery } from "../../command/GetUserByIdQuery.ts";
import type { User } from "../../../domain/aggregates/User.ts";

export type GetUserByIdPort = UseCase<GetUserByIdQuery, User>;
