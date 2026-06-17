// Catalog of MCP clients we are compatible with. The Consumption gateway exposes a REMOTE
// MCP server over Streamable HTTP at `/mcp`, authenticated with an `Authorization: Bearer
// <api-key>` header (ADR-021). So the only compatible clients are AI tools that accept a
// remote MCP server with a custom auth header — which is exactly what this list curates.
//
// Each entry generates a ready-to-paste config from the live origin + the freshly issued key,
// so the user copies a working snippet instead of hand-assembling it. Snippets are CODE, not
// prose — they are not translated; the step-by-step instructions live in i18n.

export const MCP_SERVER_NAME = "domain-expert";

export type SnippetLanguage = "bash" | "json";

export interface McpClient {
  readonly id: string;
  /** Proper noun (Cursor, VS Code, …) — not translated. `generic` is relabelled in the UI. */
  readonly label: string;
  readonly language: SnippetLanguage;
  snippet(url: string, key: string): string;
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export const MCP_CLIENTS: ReadonlyArray<McpClient> = [
  {
    id: "claude-code",
    label: "Claude Code",
    language: "bash",
    snippet: (url, key) =>
      `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} \\\n  --header "Authorization: Bearer ${key}"`,
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    language: "json",
    // Claude Desktop's config takes stdio servers, so a remote HTTP server is bridged through
    // the `mcp-remote` npx shim (requires Node.js on the machine).
    snippet: (url, key) =>
      json({
        mcpServers: {
          [MCP_SERVER_NAME]: {
            command: "npx",
            args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${key}`],
          },
        },
      }),
  },
  {
    id: "cursor",
    label: "Cursor",
    language: "json",
    snippet: (url, key) =>
      json({
        mcpServers: { [MCP_SERVER_NAME]: { url, headers: { Authorization: `Bearer ${key}` } } },
      }),
  },
  {
    id: "vscode",
    label: "VS Code",
    language: "json",
    snippet: (url, key) =>
      json({
        servers: {
          [MCP_SERVER_NAME]: { type: "http", url, headers: { Authorization: `Bearer ${key}` } },
        },
      }),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    language: "json",
    snippet: (url, key) =>
      json({
        mcpServers: {
          [MCP_SERVER_NAME]: { serverUrl: url, headers: { Authorization: `Bearer ${key}` } },
        },
      }),
  },
  {
    id: "generic",
    label: "Other",
    language: "json",
    snippet: (url, key) => json({ url, headers: { Authorization: `Bearer ${key}` } }),
  },
];

/** The remote MCP endpoint for a given origin (e.g. `https://app.example.com` → `…/mcp`). */
export function mcpServerUrl(origin: string): string {
  return origin.replace(/\/+$/, "") + "/mcp";
}
