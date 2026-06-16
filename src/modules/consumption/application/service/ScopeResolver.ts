import type { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import type { EffectiveScope } from "../types.ts";
import { ScopeViolationError } from "../errors.ts";

/**
 * A request's optional narrowing of the credential scope. The request may only narrow
 * within what the credential allows (ADR-022) — it never widens.
 */
export interface ScopeRequest {
  readonly collectionIds?: ReadonlyArray<string> | undefined;
  readonly sensitivityCeiling?: string | undefined;
}

/**
 * Computes the effective scope = credential ∩ request (ADR-022), pure and stateless.
 *
 * Rules:
 * - Collections: with no request filter, the effective list is the credential's whole
 *   allowlist. A request filter may only NARROW: a requested collection that is not in the
 *   credential's allowlist is a `ScopeViolationError` (→ 403), never silently widened. An
 *   empty effective collection list is kept as-is — fail-closed: it means "nothing in
 *   scope", which the query layer translates to empty results, never "all collections".
 * - Sensitivity: the effective ceiling is the minimum (least permissive) of the credential
 *   ceiling and any requested ceiling; a request can only lower it.
 *
 * `permits` is the single-item gate used by `getItem` to decide visibility without leaking
 * out-of-scope items (fail-closed: a collection not in the effective list, or a sensitivity
 * above the ceiling, is invisible).
 */
export class ScopeResolver {
  public resolve(credentialScope: CredentialScope, request: ScopeRequest): EffectiveScope {
    const effectiveCollectionIds = this.resolveCollectionIds(credentialScope, request.collectionIds);
    const effectiveCeiling = this.resolveCeiling(credentialScope, request.sensitivityCeiling);
    return {
      collectionIds: effectiveCollectionIds,
      sensitivityCeiling: effectiveCeiling.name,
    };
  }

  public permits(scope: EffectiveScope, collectionId: string, sensitivity: string): boolean {
    if (!scope.collectionIds.includes(collectionId)) {
      return false;
    }
    const ceiling = SensitivityLevel.of(scope.sensitivityCeiling);
    return SensitivityLevel.of(sensitivity).isAtMost(ceiling);
  }

  private resolveCollectionIds(
    credentialScope: CredentialScope,
    requested: ReadonlyArray<string> | undefined,
  ): ReadonlyArray<string> {
    if (requested === undefined) {
      return [...credentialScope.collectionIds];
    }
    const narrowed: Array<string> = [];
    for (const collectionId of requested) {
      if (!credentialScope.includesCollection(collectionId)) {
        throw new ScopeViolationError(collectionId);
      }
      if (!narrowed.includes(collectionId)) {
        narrowed.push(collectionId);
      }
    }
    return narrowed;
  }

  private resolveCeiling(
    credentialScope: CredentialScope,
    requested: string | undefined,
  ): SensitivityLevel {
    const credentialCeiling = credentialScope.sensitivityCeiling;
    if (requested === undefined) {
      return credentialCeiling;
    }
    const requestedCeiling = SensitivityLevel.of(requested);
    return requestedCeiling.isAtMost(credentialCeiling) ? requestedCeiling : credentialCeiling;
  }
}
