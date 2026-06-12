import type {
  HttpResponse,
  RouteParams,
} from "../../../../shared/infrastructure/http/HttpServer.ts";
import type { GetUserByIdPort } from "../../application/port/primary/GetUserByIdPort.ts";
import { GetUserByIdQuery } from "../../application/command/GetUserByIdQuery.ts";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_ERROR = 500;

const USER_NOT_FOUND_PREFIX = "User not found";

export class GetUserController {
  private readonly getUserByIdUseCase: GetUserByIdPort;

  constructor(_applicationService: unknown, getUserByIdUseCase: GetUserByIdPort) {
    this.getUserByIdUseCase = getUserByIdUseCase;
  }

  public async handle(
    _requestBody: Record<string, unknown>,
    params: RouteParams,
  ): Promise<HttpResponse> {
    const userId = params.userId as string;

    try {
      const query = GetUserByIdQuery.of(userId);
      const user = await this.getUserByIdUseCase.execute(query);

      const addresses: Array<object> = [];
      for (const address of user.addresses) {
        addresses.push({
          id: address.id.value,
          street: address.street.value,
          number: address.number.value,
          city: address.city.value,
          state: address.state.value,
          zipCode: address.zipCode.value,
        });
      }

      return {
        statusCode: HTTP_OK,
        body: {
          id: user.id.value,
          name: user.name,
          email: user.email.value,
          addresses,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private handleError(error: Error): HttpResponse {
    const isNotFound = error.message.startsWith(USER_NOT_FOUND_PREFIX);
    if (isNotFound) {
      return { statusCode: HTTP_NOT_FOUND, body: { error: error.message } };
    }

    return { statusCode: HTTP_INTERNAL_ERROR, body: { error: error.message } };
  }
}
