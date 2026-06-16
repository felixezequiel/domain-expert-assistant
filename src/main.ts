import { ConsoleLogger } from "./shared/infrastructure/logging/ConsoleLogger.ts";
import { DatabaseFactory, InfrastructureFactory } from "./shared/factories/index.ts";
import { HealthCheckController } from "./shared/infrastructure/http/HealthCheckController.ts";

/**
 * Composition Root — Monolith entry point.
 *
 * Each module is a self-contained vertical slice:
 *   - Owns its domain, application, and infrastructure layers
 *   - Registers its own HTTP routes and GraphQL resolvers
 *   - Can be extracted to a standalone microservice by replacing
 *     this composition root with its own main + dedicated servers
 *
 * Shared infrastructure (UnitOfWork, EventPublisher, Logger) is provided
 * by the monolith and injected into each module's ApplicationService.
 *
 * Adding a new adapter (Broker, CLI) means adding a new
 * registerXxx() method to each module — the use cases remain unchanged.
 */

const REST_PORT = 3000;
const GRAPHQL_PORT = 4000;

async function main(): Promise<void> {
  const logger = new ConsoleLogger();

  // --- Database initialization ---
  const entityManagerProvider = await DatabaseFactory.create(logger);

  // --- Shared infrastructure ---
  // Bounded-context modules (Identity, …) register their persisters and adapters here as
  // each is wired. Persistence + domain land first; the HTTP/bootstrap wiring follows.
  const infrastructure = InfrastructureFactory.create(entityManagerProvider, []);

  // --- Health checks (cross-cutting) ---
  const healthCheckController = new HealthCheckController(entityManagerProvider);
  infrastructure.httpServer.get("/health/live", () => healthCheckController.handleLive());
  infrastructure.httpServer.get("/health/ready", () => healthCheckController.handleReady());

  // --- Start ---
  const restPort = await infrastructure.httpServer.start(REST_PORT);
  const graphqlPort = await infrastructure.graphqlServer.start(GRAPHQL_PORT);

  logger.info("REST server started", { port: restPort, url: "http://localhost:" + restPort });
  logger.info("GraphQL server started", {
    port: graphqlPort,
    url: "http://localhost:" + graphqlPort + "/graphql",
  });
  logger.info("Available endpoints:", {
    "POST /auth/login": "REST - authenticate a user (email + password)",
    "GET /health/ready": "REST - readiness probe",
  });
}

main();
