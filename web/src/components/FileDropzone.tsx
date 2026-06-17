import { useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { cn } from "../lib/utils.ts";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A shadcn-styled file picker: a click-or-drag dropzone backed by a visually-hidden native
// input (so it stays labelable/accessible), and a file "chip" with size + remove once chosen.
// Replaces the raw <input type="file"> button.
export function FileDropzone({
  id,
  file,
  onFileChange,
  accept,
  disabled = false,
  hint,
}: {
  readonly id: string;
  readonly file: File | null;
  onFileChange(next: File | null): void;
  readonly accept?: string;
  readonly disabled?: boolean;
  readonly hint?: string;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = (): void => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const clear = (): void => {
    onFileChange(null);
    if (inputRef.current !== null) {
      inputRef.current.value = "";
    }
  };

  if (file !== null) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={clear} disabled={disabled} aria-label="Remove file">
          <X className="h-4 w-4" />
        </Button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped !== undefined && !disabled) {
          onFileChange(dropped);
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/20 px-4 py-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragOver ? "border-primary bg-primary/5" : null,
        disabled ? "pointer-events-none opacity-60" : null,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadCloud className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">
        Drag &amp; drop a file, or <span className="text-primary">browse</span>
      </p>
      <p className="text-xs text-muted-foreground">{hint ?? "A single document"}</p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
