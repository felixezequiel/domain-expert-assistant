import type { UserRepositoryPort } from "../../../application/port/secondary/UserRepositoryPort.ts";
import type { UserId } from "../../../domain/identifiers/UserId.ts";
import type { User } from "../../../domain/aggregates/User.ts";

export class InMemoryUserRepository implements UserRepositoryPort {
  private users: Map<string, User> = new Map();

  public async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
  }

  public async findById(id: UserId): Promise<User | null> {
    const user = this.users.get(id.value);
    return user ?? null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.value === email) {
        return user;
      }
    }
    return null;
  }

  public async delete(id: UserId): Promise<void> {
    this.users.delete(id.value);
  }
}
