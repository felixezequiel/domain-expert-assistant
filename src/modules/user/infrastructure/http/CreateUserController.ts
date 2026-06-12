import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type { HttpResponse } from "../../../../shared/infrastructure/http/HttpServer.ts";
import type { CreateUserPort } from "../../application/port/primary/CreateUserPort.ts";
import { CreateUserCommand } from "../../application/command/CreateUserCommand.ts";
import { randomUUID } from "node:crypto";

const ALREADY_EXISTS_PREFIX = "User with email ";
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;

export class CreateUserController {
  private readonly applicationService: ApplicationService;
  private readonly createUserUseCase: CreateUserPort;

  constructor(applicationService: ApplicationService, createUserUseCase: CreateUserPort) {
    this.applicationService = applicationService;
    this.createUserUseCase = createUserUseCase;
  }

  public async handle(requestBody: Record<string, unknown>): Promise<HttpResponse> {
    const validationError = this.validate(requestBody);
    if (validationError !== null) {
      return { statusCode: HTTP_BAD_REQUEST, body: { error: validationError } };
    }

    const name = requestBody.name as string;
    const email = requestBody.email as string;
    const userId = randomUUID();

    try {
      const command = CreateUserCommand.of(userId, name, email);
      const user = await this.applicationService.execute(this.createUserUseCase, command);

      return {
        statusCode: HTTP_CREATED,
        body: {
          id: user.id.value,
          name: user.name,
          email: user.email.value,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private validate(requestBody: Record<string, unknown>): string | null {
    if (requestBody.name === undefined || requestBody.name === "") {
      return "Name is required";
    }

    if (requestBody.email === undefined || requestBody.email === "") {
      return "Email is required";
    }

    return null;
  }

  private handleError(error: Error): HttpResponse {
    const isConflict = error.message.startsWith(ALREADY_EXISTS_PREFIX);
    if (isConflict) {
      return { statusCode: HTTP_CONFLICT, body: { error: error.message } };
    }

    const isValidationError = error.message.includes("Invalid email");
    if (isValidationError) {
      return { statusCode: HTTP_BAD_REQUEST, body: { error: error.message } };
    }

    return { statusCode: HTTP_INTERNAL_ERROR, body: { error: error.message } };
  }
}
