import type { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

/**
 * A consumer credential's access scope (PRD-1): an explicit allowlist of collections
 * plus a sensitivity ceiling. Collection ids reference Knowledge collections (PRD-2) by
 * id only — validated at runtime in the use case, never an FK or a cross-context type
 * import (PRD-1 §12).
 *
 * Not a ValueObject subclass: it holds a collection (array), which the shared
 * value-equality (shallow per-key compare) cannot compare correctly. It is immutable by
 * construction (frozen array) and compared structurally only where needed.
 */
export class CredentialScope {
  private readonly _collectionIds: ReadonlyArray<string>;
  private readonly _sensitivityCeiling: SensitivityLevel;

  private constructor(collectionIds: ReadonlyArray<string>, sensitivityCeiling: SensitivityLevel) {
    this._collectionIds = Object.freeze([...collectionIds]);
    this._sensitivityCeiling = sensitivityCeiling;
  }

  public static of(
    collectionIds: ReadonlyArray<string>,
    sensitivityCeiling: SensitivityLevel,
  ): CredentialScope {
    const seen = new Set<string>();
    const deduped: Array<string> = [];
    for (const id of collectionIds) {
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }
    return new CredentialScope(deduped, sensitivityCeiling);
  }

  public get collectionIds(): ReadonlyArray<string> {
    return this._collectionIds;
  }

  public get sensitivityCeiling(): SensitivityLevel {
    return this._sensitivityCeiling;
  }

  public includesCollection(collectionId: string): boolean {
    return this._collectionIds.includes(collectionId);
  }

  public permitsSensitivity(level: SensitivityLevel): boolean {
    return level.isAtMost(this._sensitivityCeiling);
  }
}
