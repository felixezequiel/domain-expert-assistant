import { ValueObject } from "./ValueObject.ts";

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
      throw new Error("Unknown sensitivity level: " + name);
    }
    return new SensitivityLevel(name as SensitivityLevelName);
  }

  public isAtMost(ceiling: SensitivityLevel): boolean {
    return this.rank <= ceiling.rank;
  }
}
