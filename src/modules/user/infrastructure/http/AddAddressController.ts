import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type {
  HttpResponse,
  RouteParams,
} from "../../../../shared/infrastructure/http/HttpServer.ts";
import type { AddAddressPort } from "../../application/port/primary/AddAddressPort.ts";
import { AddAddressCommand } from "../../application/command/AddAddressCommand.ts";
import { randomUUID } from "node:crypto";

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

const USER_NOT_FOUND_PREFIX = "User not found";

export class AddAddressController {
  private readonly applicationService: ApplicationService;
  private readonly addAddressUseCase: AddAddressPort;

  constructor(applicationService: ApplicationService, addAddressUseCase: AddAddressPort) {
    this.applicationService = applicationService;
    this.addAddressUseCase = addAddressUseCase;
  }

  public async handle(
    requestBody: Record<string, unknown>,
    params: RouteParams,
  ): Promise<HttpResponse> {
    const validationError = this.validate(requestBody);
    if (validationError !== null) {
      return { statusCode: HTTP_BAD_REQUEST, body: { error: validationError } };
    }

    const userId = params.userId as string;
    const addressId = randomUUID();
    const street = requestBody.street as string;
    const number = requestBody.number as string;
    const city = requestBody.city as string;
    const state = requestBody.state as string;
    const zipCode = requestBody.zipCode as string;

    try {
      const command = AddAddressCommand.of(userId, addressId, street, number, city, state, zipCode);
      await this.applicationService.execute(this.addAddressUseCase, command);

      return {
        statusCode: HTTP_CREATED,
        body: {
          userId,
          addressId,
          street,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private validate(requestBody: Record<string, unknown>): string | null {
    if (requestBody.street === undefined || requestBody.street === "") {
      return "Street is required";
    }

    return null;
  }

  private handleError(error: Error): HttpResponse {
    const isNotFound = error.message.startsWith(USER_NOT_FOUND_PREFIX);
    if (isNotFound) {
      return { statusCode: HTTP_NOT_FOUND, body: { error: error.message } };
    }

    return { statusCode: HTTP_INTERNAL_ERROR, body: { error: error.message } };
  }
}
