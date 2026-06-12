import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { SseService } from "./SseService.ts";
import type { ServerResponse } from "node:http";

let activeService: SseService | null = null;

function createMockResponse(): ServerResponse & { written: string[]; headersSet: boolean } {
  const emitter = new EventEmitter();
  const mock = Object.assign(emitter, {
    written: [] as string[],
    headersSet: false,
    writeHead(_statusCode: number, _headers: Record<string, string>) {
      mock.headersSet = true;
    },
    write(data: string) {
      mock.written.push(data);
      return true;
    },
  });

  return mock as unknown as ServerResponse & { written: string[]; headersSet: boolean };
}

describe("SseService", () => {
  afterEach(() => {
    if (activeService !== null) {
      activeService.dispose();
      activeService = null;
    }
  });

  function createService(): SseService {
    const service = new SseService();
    activeService = service;
    return service;
  }

  it("should add a client and set SSE headers", () => {
    const service = createService();
    const response = createMockResponse();

    service.addClient("channel-1", response as unknown as ServerResponse);

    assert.equal(service.getClientCount("channel-1"), 1);
    assert.equal(response.headersSet, true);
  });

  it("should send initial connection-alive comment on addClient", () => {
    const service = createService();
    const response = createMockResponse();

    service.addClient("channel-1", response as unknown as ServerResponse);

    assert.equal(response.written.length, 1);
    assert.equal(response.written[0], ":ok\n\n");
  });

  it("should remove a client", () => {
    const service = createService();
    const response = createMockResponse();

    service.addClient("channel-1", response as unknown as ServerResponse);
    assert.equal(service.getClientCount("channel-1"), 1);

    service.removeClient("channel-1", response as unknown as ServerResponse);
    assert.equal(service.getClientCount("channel-1"), 0);
  });

  it("should broadcast to all clients of a channel", () => {
    const service = createService();
    const response1 = createMockResponse();
    const response2 = createMockResponse();

    service.addClient("channel-1", response1 as unknown as ServerResponse);
    service.addClient("channel-1", response2 as unknown as ServerResponse);

    service.broadcast("channel-1", "ItemChecked", { itemId: "item-1", quantity: 5 });

    assert.equal(response1.written.length, 2);
    assert.equal(response2.written.length, 2);
    assert.ok(response1.written[1]!.includes("event: ItemChecked"));
    assert.ok(response1.written[1]!.includes('"itemId":"item-1"'));
  });

  it("should not broadcast to clients of a different channel", () => {
    const service = createService();
    const response1 = createMockResponse();
    const response2 = createMockResponse();

    service.addClient("channel-1", response1 as unknown as ServerResponse);
    service.addClient("channel-2", response2 as unknown as ServerResponse);

    service.broadcast("channel-1", "ItemChecked", { itemId: "item-1" });

    assert.equal(response1.written.length, 2);
    assert.equal(response2.written.length, 1);
  });

  it("should handle broadcast to non-existent channel gracefully", () => {
    const service = createService();
    assert.doesNotThrow(() => service.broadcast("non-existent", "event", { data: "test" }));
  });

  it("should return 0 for client count of unknown channel", () => {
    const service = createService();
    assert.equal(service.getClientCount("unknown"), 0);
  });

  it("should auto-remove client on close event", () => {
    const service = createService();
    const response = createMockResponse();

    service.addClient("channel-1", response as unknown as ServerResponse);
    assert.equal(service.getClientCount("channel-1"), 1);

    response.emit("close");
    assert.equal(service.getClientCount("channel-1"), 0);
  });
});
