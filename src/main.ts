import { ConsoleLogger } from "./shared/infrastructure/logging/ConsoleLogger.ts";
import { DatabaseFactory, InfrastructureFactory } from "./shared/factories/index.ts";
import { HealthCheckController } from "./shared/infrastructure/http/HealthCheckController.ts";
import { IdentityModuleFactory } from "./modules/identity/factories/index.ts";
import { KnowledgeModuleFactory } from "./modules/knowledge/factories/index.ts";
import { IngestionModuleFactory } from "./modules/ingestion/factories/index.ts";
import { RetrievalModuleFactory } from "./modules/retrieval/factories/index.ts";
import { ConsumptionModuleFactory } from "./modules/consumption/factories/index.ts";
import { AuditModuleFactory } from "./modules/audit/factories/index.ts";
import { TransformersEmbedder } from "./modules/retrieval/infrastructure/embedding/TransformersEmbedder.ts";
import { SpaController } from "./shared/infrastructure/http/SpaController.ts";

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

  // --- Module factories (vertical slices) ---
  const identityModule = IdentityModuleFactory.create(entityManagerProvider);
  const knowledgeModule = KnowledgeModuleFactory.create(entityManagerProvider, {
    resolveSession: identityModule.resolveSession,
    organizationPolicy: identityModule.organizationPolicy,
    userDirectory: identityModule.userDirectory,
  });
  const ingestionModule = IngestionModuleFactory.create(entityManagerProvider, {
    resolveSession: identityModule.resolveSession,
  });
  // One local BGE-M3 embedder, shared by Retrieval (projection) and Consumption (search), so
  // the multi-hundred-MB model is loaded once (ADR-017).
  const embedder = new TransformersEmbedder();
  // Retrieval & Indexing (PRD-4): derived read-model, so it owns no aggregate/persister.
  const retrievalModule = RetrievalModuleFactory.create(entityManagerProvider, {
    resolveSession: identityModule.resolveSession,
    embedder,
  });
  // Consumption Gateway (PRD-5): consumer-facing REST + MCP, owns no aggregate/persister.
  const consumptionModule = ConsumptionModuleFactory.create(entityManagerProvider, { embedder });
  // Audit trail (PRD-6, Auditor): read-only window onto the tenant's domain-event stream.
  const auditModule = AuditModuleFactory.create(entityManagerProvider, {
    resolveSession: identityModule.resolveSession,
    userDirectory: identityModule.userDirectory,
  });

  // --- Shared infrastructure ---
  const infrastructure = InfrastructureFactory.create(entityManagerProvider, [
    ...identityModule.persisters,
    ...knowledgeModule.persisters,
    ...ingestionModule.persisters,
  ]);

  // --- Module registration ---
  identityModule.register(infrastructure, logger);
  knowledgeModule.register(infrastructure, logger);
  ingestionModule.register(infrastructure, logger);
  // Subscribes to Knowledge's publish/deprecate/archive events and starts the projection worker.
  retrievalModule.register(infrastructure, logger);
  // Registers the consumer REST API (/v1/*) and the MCP server (/mcp).
  consumptionModule.register(infrastructure, logger);
  // Registers the read-only audit trail API (GET /audit/events).
  auditModule.register(infrastructure, logger);

  // --- Health checks (cross-cutting) ---
  const healthCheckController = new HealthCheckController(entityManagerProvider);
  infrastructure.httpServer.get("/health/live", () => healthCheckController.handleLive());
  infrastructure.httpServer.get("/health/ready", () => healthCheckController.handleReady());

  // --- Curation & Admin SPA (PRD-6, ADR-023) ---
  // Registered LAST so it cannot shadow API routes; it only serves "/", "/index.html", and
  // "/assets/*" (the SPA uses a HashRouter, so no history fallback is needed).
  new SpaController().register(infrastructure.httpServer);

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
