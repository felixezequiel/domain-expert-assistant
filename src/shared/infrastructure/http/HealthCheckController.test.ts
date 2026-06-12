import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HealthCheckController } from "./HealthCheckController.ts";
import type { EntityManagerProvider } from "../persistence/adapters/EntityManagerProvider.ts";

function createFakeEntityManagerProvider(isConnected: boolean): EntityManagerProvider {
  return {
    getEntityManager() {
      return {
        getConnection() {
          return {
            isConnected() {
              return Promise.resolve(isConnected);
            },
          };
        },
      } as ReturnType<EntityManagerProvider["getEntityManager"]>;
    },
    setEntityManager() {},
    runWithScope<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

describe("HealthCheckController", () => {
  describe("handleLive", () => {
    it("should return 200 with status ok", async () => {
      const provider = createFakeEntityManagerProvider(true);
      const controller = new HealthCheckController(provider);

      const response = await controller.handleLive();

      assert.equal(response.statusCode, 200);
      const body = response.body as { status: string };
      assert.equal(body.status, "ok");
    });
  });

  describe("handleReady", () => {
    it("should return 200 with status ready when database is connected", async () => {
      const provider = createFakeEntityManagerProvider(true);
      const controller = new HealthCheckController(provider);

      const response = await controller.handleReady();

      assert.equal(response.statusCode, 200);
      const body = response.body as { status: string };
      assert.equal(body.status, "ready");
    });

    it("should return 503 with status not_ready when database is disconnected", async () => {
      const provider = createFakeEntityManagerProvider(false);
      const controller = new HealthCheckController(provider);

      const response = await controller.handleReady();

      assert.equal(response.statusCode, 503);
      const body = response.body as { status: string; reason: string };
      assert.equal(body.status, "not_ready");
      assert.equal(body.reason, "database");
    });

    it("should return 503 when database connection check throws", async () => {
      const provider: EntityManagerProvider = {
        getEntityManager() {
          return {
            getConnection() {
              return {
                isConnected() {
                  return Promise.reject(new Error("connection refused"));
                },
              };
            },
          } as ReturnType<EntityManagerProvider["getEntityManager"]>;
        },
        setEntityManager() {},
        runWithScope<T>(fn: () => Promise<T>): Promise<T> {
          return fn();
        },
      };
      const controller = new HealthCheckController(provider);

      const response = await controller.handleReady();

      assert.equal(response.statusCode, 503);
      const body = response.body as { status: string; reason: string };
      assert.equal(body.status, "not_ready");
      assert.equal(body.reason, "database");
    });
  });
});
