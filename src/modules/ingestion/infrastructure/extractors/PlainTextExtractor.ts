import type { ExtractorPort } from "../../application/types.ts";

const PLAIN_TEXT_MIMES: ReadonlyArray<string> = ["text/plain", "text/markdown"];

/**
 * Extracts text from plain-text / markdown documents (ADR-015). PDF/DOCX extractors are
 * separate adapters behind the same port (added with their parsers).
 */
export class PlainTextExtractor implements ExtractorPort {
  public supports(mimeType: string): boolean {
    return PLAIN_TEXT_MIMES.includes(mimeType);
  }

  public async extract(content: Buffer): Promise<string> {
    return content.toString("utf8");
  }
}
