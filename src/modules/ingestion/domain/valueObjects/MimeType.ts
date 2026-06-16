import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface MimeTypeProps {
  readonly value: string;
}

const PLAIN_TEXT_MIMES: ReadonlyArray<string> = ["text/plain", "text/markdown"];
const DOCUMENT_MIMES: ReadonlyArray<string> = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const SUPPORTED_MIMES: ReadonlyArray<string> = [...PLAIN_TEXT_MIMES, ...DOCUMENT_MIMES];

/**
 * Mime type of an uploaded document, restricted to the formats the extractors handle
 * (ADR-015). Plain-text/markdown are extracted natively; pdf/docx via dedicated extractors.
 */
export class MimeType extends ValueObject<MimeTypeProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!SUPPORTED_MIMES.includes(normalized)) {
      throw new Error("Unsupported document mime type: " + value);
    }
    super({ value: normalized });
  }

  public isPlainText(): boolean {
    return PLAIN_TEXT_MIMES.includes(this.props.value);
  }
}
