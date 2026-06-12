import type { ServerResponse } from "node:http";

const HEARTBEAT_INTERVAL_MS = 30000;

export class SseService {
  private readonly clients: Map<string, Set<ServerResponse>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  public addClient(channelId: string, response: ServerResponse): void {
    let clientSet = this.clients.get(channelId);
    if (clientSet === undefined) {
      clientSet = new Set();
      this.clients.set(channelId, clientSet);
    }
    clientSet.add(response);

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    response.write(":ok\n\n");

    if (this.heartbeatInterval === null) {
      this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    }

    response.on("close", () => {
      this.removeClient(channelId, response);
    });
  }

  public removeClient(channelId: string, response: ServerResponse): void {
    const clientSet = this.clients.get(channelId);
    if (clientSet !== undefined) {
      clientSet.delete(response);
      if (clientSet.size === 0) {
        this.clients.delete(channelId);
      }
    }

    if (this.clients.size === 0 && this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    for (const clientSet of this.clients.values()) {
      for (const response of clientSet) {
        response.write(":heartbeat\n\n");
      }
    }
  }

  public broadcast(channelId: string, eventName: string, data: unknown): void {
    const clientSet = this.clients.get(channelId);
    if (clientSet === undefined) {
      return;
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const response of clientSet) {
      response.write(payload);
    }
  }

  public getClientCount(channelId: string): number {
    const clientSet = this.clients.get(channelId);
    return clientSet !== undefined ? clientSet.size : 0;
  }

  public dispose(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.clear();
  }
}
