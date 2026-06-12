import type { UseCase } from "../../../../../shared/application/UseCase.ts";
import type { SendWelcomeEmailCommand } from "../../command/SendWelcomeEmailCommand.ts";

export type SendWelcomeEmailPort = UseCase<SendWelcomeEmailCommand, void>;
