import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { OpaqueSecretPort, GeneratedSecret } from "../../application/types.ts";

const SECRET_BYTES = 32;
const PREFIX_CHARS = 12;

/**
 * Opaque secrets (API keys, session/invitation tokens). Because the secret is
 * high-entropy random (256 bits), a single SHA-256 is sufficient for verification — no
 * memory-hard hashing needed (unlike passwords). The token is `<prefix>.<random>`; the
 * prefix is a non-secret display/lookup label, the whole token is what gets hashed.
 */
export class Sha256OpaqueSecret implements OpaqueSecretPort {
  public generate(): GeneratedSecret {
    const prefix = randomBytes(PREFIX_CHARS).toString("base64url").slice(0, PREFIX_CHARS);
    const random = randomBytes(SECRET_BYTES).toString("base64url");
    return { plaintext: prefix + "." + random, prefix };
  }

  public hash(plaintext: string): string {
    return createHash("sha256").update(plaintext).digest("hex");
  }

  public verify(plaintext: string, hash: string): boolean {
    const computed = Buffer.from(this.hash(plaintext), "hex");
    const expected = Buffer.from(hash, "hex");
    if (computed.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(computed, expected);
  }
}
