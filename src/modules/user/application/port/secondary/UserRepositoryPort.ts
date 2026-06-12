import type { RepositoryPort } from "../../../../../shared/ports/RepositoryPort.ts";
import type { UserId } from "../../../domain/identifiers/UserId.ts";
import type { User } from "../../../domain/aggregates/User.ts";

export interface UserRepositoryPort extends RepositoryPort<UserId, User> {
  findByEmail(email: string): Promise<User | null>;
}
