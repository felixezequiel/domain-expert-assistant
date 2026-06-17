import { ValueObject } from "./ValueObject.ts";
import { DomainError } from "../errors/DomainError.ts";

/**
 * Three fixed, ordered sensitivity levels (`public < internal < confidential`), shared
 * across contexts: a KnowledgeItem carries one, a ConsumerCredential caps reads at a
 * ceiling (ADR-011 / PRD-1 / PRD-2). Ordering is what powers the "sensitivity ≤ ceiling"
 * consumer scope check, so the level lives in the shared kernel.
 */
export const SENSITIVITY_LEVELS = ["public", "internal", "confidential"] as const;

export type SensitivityLevelName = (typeof SENSITIVITY_LEVELS)[number];

interface SensitivityLevelProps {
  readonly name: SensitivityLevelName;
}

export class SensitivityLevel extends ValueObject<SensitivityLevelProps> {
  public get name(): SensitivityLevelName {
    return this.props.name;
  }

  public get rank(): number {
    return SENSITIVITY_LEVELS.indexOf(this.props.name);
  }

  private constructor(name: SensitivityLevelName) {
    super({ name });
  }

  public static of(name: string): SensitivityLevel {
    if (!(SENSITIVITY_LEVELS as ReadonlyArray<string>).includes(name)) {
      // kind "internal" preserves the pre-ADR-026 status: this message matched no edge's
      // substring `statusForError`, so it became a 500. Semantically this is a user-facing
      // validation failure (400) — flagged for the main agent (ADR-026 §3 keep-status rule).
      throw new DomainError(
        "common.unknownSensitivityLevel",
        "internal",
        { name },
        "Unknown sensitivity level: " + name,
      );
    }
    return new SensitivityLevel(name as SensitivityLevelName);
  }

  public isAtMost(ceiling: SensitivityLevel): boolean {
    return this.rank <= ceiling.rank;
  }
}
