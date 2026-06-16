import type { SessionRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { Session } from "../../../../domain/entities/Session.ts";
import { SessionEntity } from "../entities/SessionEntity.ts";
import { SessionMapper } from "../mappers/SessionMapper.ts";

/**
 * Sessions are an auth artifact, not an event-sourced aggregate, so this repository stages the
 * write itself instead of routing through a persister. It never flushes: the UnitOfWork commit
 * owns the single flush and commits the session in the same transaction as the event store
 * (ADR-004). Revocation uses nativeUpdate rather than load-mutate-flush because SessionEntity
 * extends PlainObject (no MikroORM dirty-tracking).
 */
export class MikroOrmSessionRepository implements SessionRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(session: Session): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    entityManager.persist(SessionMapper.toOrmEntity(session));
  }

  public async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(SessionEntity, { tokenHash });
    return entity === null ? null : SessionMapper.toDomain(entity);
  }

  public async revoke(sessionId: string): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.nativeUpdate(SessionEntity, { id: sessionId }, { revoked: true });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.nativeUpdate(SessionEntity, { userId }, { revoked: true });
  }
}
