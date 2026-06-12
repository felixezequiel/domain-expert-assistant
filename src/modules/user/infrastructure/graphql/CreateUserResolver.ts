import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type { CreateUserPort } from "../../application/port/primary/CreateUserPort.ts";
import { CreateUserCommand } from "../../application/command/CreateUserCommand.ts";
import { randomUUID } from "node:crypto";

interface CreateUserInput {
  readonly name: string;
  readonly email: string;
}

interface CreateUserPayload {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export class CreateUserResolver {
  private readonly applicationService: ApplicationService;
  private readonly createUserUseCase: CreateUserPort;

  public readonly schemaFragment = `
    input CreateUserInput {
      name: String!
      email: String!
    }

    type CreateUserPayload {
      id: ID!
      name: String!
      email: String!
    }

    extend type Mutation {
      createUser(input: CreateUserInput!): CreateUserPayload!
    }
  `;

  constructor(applicationService: ApplicationService, createUserUseCase: CreateUserPort) {
    this.applicationService = applicationService;
    this.createUserUseCase = createUserUseCase;
  }

  public async resolve(input: CreateUserInput): Promise<CreateUserPayload> {
    const userId = randomUUID();
    const command = CreateUserCommand.of(userId, input.name, input.email);
    const user = await this.applicationService.execute(this.createUserUseCase, command);

    return {
      id: user.id.value,
      name: user.name,
      email: user.email.value,
    };
  }
}
