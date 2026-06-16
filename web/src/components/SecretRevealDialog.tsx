import { useState } from "react";
import { Modal } from "./Modal.tsx";

// Shows a freshly issued/rotated credential secret EXACTLY once (PRD-6 acceptance:
// "Nenhuma tela expõe segredo de credencial após a emissão"). The secret lives only in
// the dialog's props while open; closing it (the only way out) drops it from the tree, so
// it can never reappear. A copy button writes to the clipboard without persisting anywhere.
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
    <Modal title="Credential secret" onClose={onClose}>
      <p className="notice notice--warning">
        Copy this secret now. It is shown only once and cannot be retrieved again.
      </p>
      <code className="secret" data-testid="credential-secret">
        {secret}
      </code>
      <div className="modal__actions">
        <button type="button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
