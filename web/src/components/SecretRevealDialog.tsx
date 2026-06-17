import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { MCP_CLIENTS, mcpServerUrl } from "../lib/mcpClients.ts";
import { Button } from "./ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";

// Shows a freshly issued/rotated credential secret EXACTLY once (PRD-6 acceptance:
// "Nenhuma tela expõe segredo de credencial após a emissão") AND, in the same one-shot dialog,
// a ready-to-paste MCP client config built from the live origin + the key, so the consumer can
// wire up their AI tool without leaving the screen. The secret lives only in this dialog's
// props while open; closing it (the only way out) drops it from the tree.
export function SecretRevealDialog({
  secret,
  onClose,
}: {
  readonly secret: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [clientId, setClientId] = useState(MCP_CLIENTS[0]!.id);

  const client = MCP_CLIENTS.find((candidate) => candidate.id === clientId) ?? MCP_CLIENTS[0]!;
  const serverUrl = useMemo(() => mcpServerUrl(window.location.origin), []);
  const snippet = useMemo(() => client.snippet(serverUrl, secret), [client, serverUrl, secret]);
  const steps = t(`admin.credentials.mcp.steps.${client.id}`, { returnObjects: true }) as unknown;
  const stepList = Array.isArray(steps) ? (steps as ReadonlyArray<string>) : [];
  const clientLabel = client.id === "generic" ? t("admin.credentials.mcp.generic") : client.label;

  const copyTo = async (value: string, mark: (copied: boolean) => void): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      mark(true);
    } catch {
      mark(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.credentials.secret.title")}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("admin.credentials.secret.warning")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <code
            className="block flex-1 break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
            data-testid="credential-secret"
          >
            {secret}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyTo(secret, setCopiedSecret)}
          >
            {copiedSecret ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copiedSecret ? t("admin.credentials.secret.copied") : t("common.actions.copy")}
          </Button>
        </div>

        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{t("admin.credentials.mcp.heading")}</h3>
            <p className="text-sm text-muted-foreground">{t("admin.credentials.mcp.subtitle")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="mcp-client">
              {t("admin.credentials.mcp.clientLabel")}
            </label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="mcp-client" className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MCP_CLIENTS.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.id === "generic" ? t("admin.credentials.mcp.generic") : candidate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("admin.credentials.mcp.configFor", { client: clientLabel })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyTo(snippet, setCopiedConfig)}
              >
                {copiedConfig ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {copiedConfig ? t("admin.credentials.mcp.copied") : t("admin.credentials.mcp.copy")}
              </Button>
            </div>
            <pre
              className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed"
              data-testid="mcp-snippet"
            >
              {snippet}
            </pre>
          </div>

          {stepList.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {stepList.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t("admin.credentials.secret.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
