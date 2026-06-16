import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  onClose(): void;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
