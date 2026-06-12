import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { GraphqlServer } from "../../../shared/infrastructure/graphql/GraphqlServer.ts";
import type { EventEmitterEventBus } from "../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import type { UserCreatedEvent } from "../domain/events/UserCreatedEvent.ts";
import type { UserRepositoryPort } from "../application/port/secondary/UserRepositoryPort.ts";
import { CreateUserUseCase } from "../application/usecase/CreateUserUseCase.ts";
import { AddAddressUseCase } from "../application/usecase/AddAddressUseCase.ts";
import { GetUserByIdUseCase } from "../application/usecase/GetUserByIdUseCase.ts";
import { SendWelcomeEmailUseCase } from "../application/usecase/SendWelcomeEmailUseCase.ts";
import { SendWelcomeEmailCommand } from "../application/command/SendWelcomeEmailCommand.ts";
import { ConsoleEmailNotification } from "../infrastructure/notifications/ConsoleEmailNotification.ts";
import { CreateUserController } from "../infrastructure/http/CreateUserController.ts";
import { AddAddressController } from "../infrastructure/http/AddAddressController.ts";
import { GetUserController } from "../infrastructure/http/GetUserController.ts";
import { CreateUserResolver } from "../infrastructure/graphql/CreateUserResolver.ts";

export class UserModule {
  private readonly applicationService: ApplicationService;
  private readonly createUserUseCase: CreateUserUseCase;
  private readonly addAddressUseCase: AddAddressUseCase;
  private readonly getUserByIdUseCase: GetUserByIdUseCase;

  constructor(applicationService: ApplicationService, userRepository: UserRepositoryPort) {
    this.applicationService = applicationService;
    this.createUserUseCase = new CreateUserUseCase(userRepository);
    this.addAddressUseCase = new AddAddressUseCase(userRepository);
    this.getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  }

  public registerEventHandlers(eventBus: EventEmitterEventBus, logger: LoggerPort): void {
    eventBus.subscribe("UserCreated", async (event) => {
      const userCreatedEvent = event as UserCreatedEvent;
      const emailNotification = new ConsoleEmailNotification(logger);
      const sendWelcomeEmailUseCase = new SendWelcomeEmailUseCase(emailNotification);
      const command = SendWelcomeEmailCommand.of(
        userCreatedEvent.aggregateId,
        userCreatedEvent.email,
        userCreatedEvent.eventId,
      );
      await this.applicationService.execute(sendWelcomeEmailUseCase, command);
    });
  }

  public registerRoutes(httpServer: HttpServer): void {
    const createUserController = new CreateUserController(
      this.applicationService,
      this.createUserUseCase,
    );
    const addAddressController = new AddAddressController(
      this.applicationService,
      this.addAddressUseCase,
    );
    const getUserController = new GetUserController(
      this.applicationService,
      this.getUserByIdUseCase,
    );

    httpServer.post("/users", async (requestBody) => {
      return createUserController.handle(requestBody);
    });

    httpServer.get("/users/:userId", async (requestBody, params) => {
      return getUserController.handle(requestBody, params);
    });

    httpServer.post("/users/:userId/addresses", async (requestBody, params) => {
      return addAddressController.handle(requestBody, params);
    });
  }

  public registerResolvers(graphqlServer: GraphqlServer): void {
    const createUserResolver = new CreateUserResolver(
      this.applicationService,
      this.createUserUseCase,
    );

    graphqlServer.addSchema(createUserResolver.schemaFragment, {
      Mutation: {
        createUser: async (_parent: unknown, args: { input: { name: string; email: string } }) => {
          return createUserResolver.resolve(args.input);
        },
      },
    });
  }
}
