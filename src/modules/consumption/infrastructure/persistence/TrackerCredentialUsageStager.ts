import { AggregateTracker } from "../../../../shared/infrastructure/persistence/AggregateTracker.ts";
import type { CredentialUsageStagerPort } from "../../application/types.ts";
import type { ConsumerCredential } from "../../../identity/domain/aggregates/ConsumerCredential.ts";

/**
 * Production stager: registers the credential with the request-scoped `AggregateTracker` so
 * the `MikroOrmUnitOfWork` routes it to the credential persister and flushes it once at
 * commit (ADR-004). `markUsed` emits no domain event, so the aggregate would not auto-track
 * itself; this explicit stage is the supported way to persist an event-free mutation.
 */
export class TrackerCredentialUsageStager implements CredentialUsageStagerPort {
  public stage(credential: ConsumerCredential): void {
    AggregateTracker.track(credential);
  }
}
