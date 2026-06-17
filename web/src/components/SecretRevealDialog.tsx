import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Button } from "./ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.tsx";

// Shows a freshly issued/rotated credential secret EXACTLY once (PRD-6 acceptance:
// "Nenhuma tela expõe segredo de credencial após a emissão"). The secret lives only in this
// dialog's props while open; closing it (the only way out) drops it from the tree.
export function SecretRevealDialog({
  secret,
  onClose,
}: {
  readonly secret: string;
  onClose(): void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credential secret</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Copy this secret now. It is shown only once and cannot be retrieved again.
          </DialogDescription>
        </DialogHeader>
        <code
          className="block break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
          data-testid="credential-secret"
        >
          {secret}
        </code>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
