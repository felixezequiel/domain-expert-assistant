import { Session } from "../../../../domain/entities/Session.ts";
import { SessionId } from "../../../../domain/identifiers/SessionId.ts";
import { SessionEntity } from "../entities/SessionEntity.ts";

export class SessionMapper {
  public static toOrmEntity(session: Session): SessionEntity {
    const entity = new SessionEntity();
    entity.id = session.id.value;
    entity.tokenHash = session.tokenHash;
    entity.userId = session.userId;
    entity.companyId = session.companyId;
    entity.createdAt = session.createdAt.toISOString();
    entity.expiresAt = session.expiresAt.toISOString();
    entity.revoked = session.isRevoked;
    return entity;
  }

  public static toDomain(entity: SessionEntity): Session {
    return Session.reconstitute(
      new SessionId(entity.id),
      entity.tokenHash,
      entity.userId,
      entity.companyId,
      new Date(entity.createdAt),
      new Date(entity.expiresAt),
      entity.revoked,
    );
  }
}
