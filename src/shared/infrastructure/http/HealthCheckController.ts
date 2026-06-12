import type { HttpResponse } from "./HttpServer.ts";
import type { EntityManagerProvider } from "../persistence/adapters/EntityManagerProvider.ts";

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

export class HealthCheckController {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async handleLive(): Promise<HttpResponse> {
    return { statusCode: HTTP_OK, body: { status: "ok" } };
  }

  public async handleReady(): Promise<HttpResponse> {
    try {
      const entityManager = this.entityManagerProvider.getEntityManager();
      const connection = entityManager.getConnection();
      const connected = await connection.isConnected();

      if (connected) {
        return { statusCode: HTTP_OK, body: { status: "ready" } };
      }

      return {
        statusCode: HTTP_SERVICE_UNAVAILABLE,
        body: { status: "not_ready", reason: "database" },
      };
    } catch {
      return {
        statusCode: HTTP_SERVICE_UNAVAILABLE,
        body: { status: "not_ready", reason: "database" },
      };
    }
  }
}
