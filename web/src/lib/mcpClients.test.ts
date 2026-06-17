import { describe, it, expect } from "vitest";
import { MCP_CLIENTS, MCP_SERVER_NAME, mcpServerUrl } from "./mcpClients.ts";

const URL_ = "https://app.example.com/mcp";
const KEY = "dk_secret123";

describe("mcpServerUrl", () => {
  it("appends /mcp to the origin", () => {
    expect(mcpServerUrl("https://app.example.com")).toBe("https://app.example.com/mcp");
  });

  it("strips a trailing slash before appending", () => {
    expect(mcpServerUrl("https://app.example.com/")).toBe("https://app.example.com/mcp");
  });
});

describe("MCP client snippets", () => {
  it("every client embeds the url and the bearer key", () => {
    for (const client of MCP_CLIENTS) {
      const snippet = client.snippet(URL_, KEY);
      expect(snippet, client.id).toContain(URL_);
      expect(snippet, client.id).toContain(KEY);
      expect(snippet, client.id).toMatch(/Bearer/);
    }
  });

  it("every JSON snippet is valid JSON", () => {
    for (const client of MCP_CLIENTS.filter((c) => c.language === "json")) {
      expect(() => JSON.parse(client.snippet(URL_, KEY)), client.id).not.toThrow();
    }
  });

  it("Claude Code is a `claude mcp add` HTTP command with the header flag", () => {
    const snippet = MCP_CLIENTS.find((c) => c.id === "claude-code")!.snippet(URL_, KEY);
    expect(snippet).toContain(`claude mcp add --transport http ${MCP_SERVER_NAME}`);
    expect(snippet).toContain(`--header "Authorization: Bearer ${KEY}"`);
  });

  it("Cursor uses mcpServers + url + headers", () => {
    const config = JSON.parse(MCP_CLIENTS.find((c) => c.id === "cursor")!.snippet(URL_, KEY));
    expect(config.mcpServers[MCP_SERVER_NAME].url).toBe(URL_);
    expect(config.mcpServers[MCP_SERVER_NAME].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("VS Code uses servers + type:http", () => {
    const config = JSON.parse(MCP_CLIENTS.find((c) => c.id === "vscode")!.snippet(URL_, KEY));
    expect(config.servers[MCP_SERVER_NAME].type).toBe("http");
    expect(config.servers[MCP_SERVER_NAME].url).toBe(URL_);
  });

  it("Claude Desktop bridges the remote server through mcp-remote", () => {
    const config = JSON.parse(MCP_CLIENTS.find((c) => c.id === "claude-desktop")!.snippet(URL_, KEY));
    const server = config.mcpServers[MCP_SERVER_NAME];
    expect(server.command).toBe("npx");
    expect(server.args).toContain("mcp-remote");
    expect(server.args).toContain(URL_);
  });

  it("Windsurf uses serverUrl", () => {
    const config = JSON.parse(MCP_CLIENTS.find((c) => c.id === "windsurf")!.snippet(URL_, KEY));
    expect(config.mcpServers[MCP_SERVER_NAME].serverUrl).toBe(URL_);
  });
});
