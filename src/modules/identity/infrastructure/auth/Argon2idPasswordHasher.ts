import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import type { PasswordHasherPort } from "../../application/types.ts";

/**
 * argon2id password hasher (ADR-010): memory-hard, the current OWASP default. The hash
 * string is self-describing (algorithm + params + salt), so verification needs no extra
 * stored parameters and is constant-time.
 */
export class Argon2idPasswordHasher implements PasswordHasherPort {
  public async hash(plaintext: string): Promise<string> {
    return argonHash(plaintext);
  }

  public async verify(plaintext: string, hash: string): Promise<boolean> {
    try {
      return await argonVerify(hash, plaintext);
    } catch {
      // A malformed/foreign hash must read as "no match", never throw.
      return false;
    }
  }
}
