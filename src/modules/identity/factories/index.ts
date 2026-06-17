import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { AggregatePersister } from "../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";

import { Organization } from "../domain/aggregates/Organization.ts";
import { User } from "../domain/aggregates/User.ts";
import { ConsumerCredential } from "../domain/aggregates/ConsumerCredential.ts";

import { OrganizationEntity } from "../infrastructure/persistence/mikro-orm/entities/OrganizationEntity.ts";
import { UserEntity } from "../infrastructure/persistence/mikro-orm/entities/UserEntity.ts";
import { ConsumerCredentialEntity } from "../infrastructure/persistence/mikro-orm/entities/ConsumerCredentialEntity.ts";
import { OrganizationMapper } from "../infrastructure/persistence/mikro-orm/mappers/OrganizationMapper.ts";
import { UserMapper } from "../infrastructure/persistence/mikro-orm/mappers/UserMapper.ts";
import { ConsumerCredentialMapper } from "../infrastructure/persistence/mikro-orm/mappers/ConsumerCredentialMapper.ts";
import { MikroOrmOrganizationRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmOrganizationRepository.ts";
import { MikroOrmUserRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmUserRepository.ts";
import { MikroOrmConsumerCredentialRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmConsumerCredentialRepository.ts";
import { MikroOrmSessionRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmSessionRepository.ts";
import { Argon2idPasswordHasher } from "../infrastructure/auth/Argon2idPasswordHasher.ts";
import { Sha256OpaqueSecret } from "../infrastructure/auth/Sha256OpaqueSecret.ts";
import { OrganizationPolicyAdapter } from "../infrastructure/knowledge/OrganizationPolicyAdapter.ts";

import { ProvisionOrganizationUseCase } from "../application/usecase/ProvisionOrganizationUseCase.ts";
import { AuthenticateUseCase } from "../application/usecase/AuthenticateUseCase.ts";
import { ResolveSessionUseCase } from "../application/usecase/ResolveSessionUseCase.ts";
import { InviteUserUseCase } from "../application/usecase/InviteUserUseCase.ts";
import { AcceptInvitationUseCase } from "../application/usecase/AcceptInvitationUseCase.ts";
import { ChangeUserRolesUseCase } from "../application/usecase/ChangeUserRolesUseCase.ts";
import { DisableUserUseCase } from "../application/usecase/DisableUserUseCase.ts";
import { SetOrganizationPolicyUseCase } from "../application/usecase/SetOrganizationPolicyUseCase.ts";
import { IssueConsumerCredentialUseCase } from "../application/usecase/IssueConsumerCredentialUseCase.ts";
import { RotateConsumerCredentialUseCase } from "../application/usecase/RotateConsumerCredentialUseCase.ts";
import { RevokeConsumerCredentialUseCase } from "../application/usecase/RevokeConsumerCredentialUseCase.ts";
import { ListConsumerCredentialsUseCase } from "../application/usecase/ListConsumerCredentialsUseCase.ts";
import { DescribeCurrentUserUseCase } from "../application/usecase/DescribeCurrentUserUseCase.ts";
import { ListOrgUsersUseCase } from "../application/usecase/ListOrgUsersUseCase.ts";
import { ReadOrgPolicyUseCase } from "../application/usecase/ReadOrgPolicyUseCase.ts";
import { IdentityModule } from "../bootstrap/IdentityModule.ts";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MILLISECONDS_PER_SECOND = 1000;

export interface IdentityModuleSetup {
  readonly persisters: ReadonlyArray<AggregatePersister>;
  // Cross-module dependencies consumed by the Knowledge slice (ADR-008/010 session
  // resolution; ADR-013 org governance policy). Exposed so the composition root can wire
  // Knowledge without Knowledge importing Identity's aggregates.
  readonly resolveSession: ResolveSessionUseCase;
  readonly organizationPolicy: OrganizationPolicyAdapter;
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

export class IdentityModuleFactory {
  public static create(entityManagerProvider: EntityManagerProvider): IdentityModuleSetup {
    const organizationRepository = new MikroOrmOrganizationRepository(entityManagerProvider);
    const userRepository = new MikroOrmUserRepository(entityManagerProvider);
    const credentialRepository = new MikroOrmConsumerCredentialRepository(entityManagerProvider);
    const sessionRepository = new MikroOrmSessionRepository(entityManagerProvider);

    const passwordHasher = new Argon2idPasswordHasher();
    const opaqueSecret = new Sha256OpaqueSecret();

    const resolveSession = new ResolveSessionUseCase(sessionRepository, userRepository, opaqueSecret);
    const organizationPolicy = new OrganizationPolicyAdapter(organizationRepository);

    const persisters: ReadonlyArray<AggregatePersister> = [
      new MikroOrmAggregatePersister({
        aggregateClass: Organization,
        ormEntityClass: OrganizationEntity,
        toOrmEntity: (organization: Organization) => OrganizationMapper.toOrmEntity(organization),
        getNestedEntities: (): Array<object> => [],
      }),
      new MikroOrmAggregatePersister({
        aggregateClass: User,
        ormEntityClass: UserEntity,
        toOrmEntity: (user: User) => UserMapper.toOrmEntity(user),
        getNestedEntities: (): Array<object> => [],
      }),
      new MikroOrmAggregatePersister({
        aggregateClass: ConsumerCredential,
        ormEntityClass: ConsumerCredentialEntity,
        toOrmEntity: (credential: ConsumerCredential) =>
          ConsumerCredentialMapper.toOrmEntity(credential),
        getNestedEntities: (): Array<object> => [],
      }),
    ];

    return {
      persisters,
      resolveSession,
      organizationPolicy,
      register(infrastructure: InfrastructureResult, _logger: LoggerPort): void {
        const identityModule = new IdentityModule({
          applicationService: infrastructure.applicationService,
          sessionRepository,
          provisionOrganization: new ProvisionOrganizationUseCase(
            organizationRepository,
            userRepository,
            passwordHasher,
          ),
          authenticate: new AuthenticateUseCase(
            userRepository,
            sessionRepository,
            passwordHasher,
            opaqueSecret,
            SESSION_TTL_SECONDS * MILLISECONDS_PER_SECOND,
          ),
          resolveSession,
          inviteUser: new InviteUserUseCase(userRepository, opaqueSecret),
          acceptInvitation: new AcceptInvitationUseCase(userRepository, passwordHasher, opaqueSecret),
          changeUserRoles: new ChangeUserRolesUseCase(userRepository),
          disableUser: new DisableUserUseCase(userRepository, sessionRepository),
          setOrganizationPolicy: new SetOrganizationPolicyUseCase(organizationRepository),
          issueConsumerCredential: new IssueConsumerCredentialUseCase(credentialRepository, opaqueSecret),
          rotateConsumerCredential: new RotateConsumerCredentialUseCase(credentialRepository, opaqueSecret),
          revokeConsumerCredential: new RevokeConsumerCredentialUseCase(credentialRepository),
          listConsumerCredentials: new ListConsumerCredentialsUseCase(credentialRepository),
          describeCurrentUser: new DescribeCurrentUserUseCase(userRepository),
          listOrgUsers: new ListOrgUsersUseCase(userRepository),
          readOrgPolicy: new ReadOrgPolicyUseCase(organizationRepository),
          operatorSecret: process.env.OPERATOR_SECRET ?? null,
          sessionTtlSeconds: SESSION_TTL_SECONDS,
          cookieSecure: process.env.NODE_ENV === "production",
        });

        identityModule.registerRoutes(infrastructure.httpServer);
      },
    };
  }
}
