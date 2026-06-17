import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import {
  type RouteResult,
  authenticatedRoute,
  publicRoute,
} from "../../../shared/infrastructure/http/authenticatedRoute.ts";
import {
  buildSessionCookie,
  buildClearedSessionCookie,
} from "../infrastructure/http/SessionCookie.ts";
import type {
  SessionRepositoryPort,
  ConsumerCredentialView,
} from "../application/types.ts";
import { ProvisionOrganizationCommand } from "../application/command/ProvisionOrganizationCommand.ts";
import { AuthenticateCommand } from "../application/command/AuthenticateCommand.ts";
import { InviteUserCommand } from "../application/command/InviteUserCommand.ts";
import { AcceptInvitationCommand } from "../application/command/AcceptInvitationCommand.ts";
import { ChangeUserRolesCommand } from "../application/command/ChangeUserRolesCommand.ts";
import { DisableUserCommand } from "../application/command/DisableUserCommand.ts";
import { SetOrganizationPolicyCommand } from "../application/command/SetOrganizationPolicyCommand.ts";
import { IssueConsumerCredentialCommand } from "../application/command/IssueConsumerCredentialCommand.ts";
import { RotateConsumerCredentialCommand } from "../application/command/RotateConsumerCredentialCommand.ts";
import { RevokeConsumerCredentialCommand } from "../application/command/RevokeConsumerCredentialCommand.ts";
import type { ProvisionOrganizationUseCase } from "../application/usecase/ProvisionOrganizationUseCase.ts";
import type { AuthenticateUseCase } from "../application/usecase/AuthenticateUseCase.ts";
import type { InviteUserUseCase } from "../application/usecase/InviteUserUseCase.ts";
import type { AcceptInvitationUseCase } from "../application/usecase/AcceptInvitationUseCase.ts";
import type { ChangeUserRolesUseCase } from "../application/usecase/ChangeUserRolesUseCase.ts";
import type { DisableUserUseCase } from "../application/usecase/DisableUserUseCase.ts";
import type { SetOrganizationPolicyUseCase } from "../application/usecase/SetOrganizationPolicyUseCase.ts";
import type { IssueConsumerCredentialUseCase } from "../application/usecase/IssueConsumerCredentialUseCase.ts";
import type { RotateConsumerCredentialUseCase } from "../application/usecase/RotateConsumerCredentialUseCase.ts";
import type { RevokeConsumerCredentialUseCase } from "../application/usecase/RevokeConsumerCredentialUseCase.ts";
import type { ListConsumerCredentialsUseCase } from "../application/usecase/ListConsumerCredentialsUseCase.ts";
import type { DescribeCurrentUserUseCase } from "../application/usecase/DescribeCurrentUserUseCase.ts";
import type { ListOrgUsersUseCase } from "../application/usecase/ListOrgUsersUseCase.ts";
import type { ReadOrgPolicyUseCase } from "../application/usecase/ReadOrgPolicyUseCase.ts";
import type { DescribeInvitationUseCase } from "../application/usecase/DescribeInvitationUseCase.ts";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

export interface IdentityModuleDeps {
  readonly applicationService: ApplicationService;
  readonly sessionRepository: SessionRepositoryPort;
  readonly provisionOrganization: ProvisionOrganizationUseCase;
  readonly authenticate: AuthenticateUseCase;
  readonly sessionResolver: SessionResolverPort;
  readonly inviteUser: InviteUserUseCase;
  readonly acceptInvitation: AcceptInvitationUseCase;
  readonly changeUserRoles: ChangeUserRolesUseCase;
  readonly disableUser: DisableUserUseCase;
  readonly setOrganizationPolicy: SetOrganizationPolicyUseCase;
  readonly issueConsumerCredential: IssueConsumerCredentialUseCase;
  readonly rotateConsumerCredential: RotateConsumerCredentialUseCase;
  readonly revokeConsumerCredential: RevokeConsumerCredentialUseCase;
  readonly listConsumerCredentials: ListConsumerCredentialsUseCase;
  readonly describeCurrentUser: DescribeCurrentUserUseCase;
  readonly listOrgUsers: ListOrgUsersUseCase;
  readonly readOrgPolicy: ReadOrgPolicyUseCase;
  readonly describeInvitation: DescribeInvitationUseCase;
  readonly operatorSecret: string | null;
  readonly sessionTtlSeconds: number;
  readonly cookieSecure: boolean;
}

const OPERATOR_SECRET_HEADER = "x-operator-secret";

/**
 * Identity REST edge. Raw routes give access to headers/cookies. Humans authenticate via
 * the httpOnly session cookie; the cookie token resolves to a fresh principal that opens
 * the Actor Context (ADR-008/010). Role enforcement is automatic: command use cases declare
 * `requiredRoles` and run through ApplicationService, whose authorize step rejects non-admins.
 */
export class IdentityModule {
  private readonly deps: IdentityModuleDeps;

  constructor(deps: IdentityModuleDeps) {
    this.deps = deps;
  }

  public registerRoutes(httpServer: HttpServer): void {
    const requireSession = this.deps.sessionResolver;
    httpServer.rawPost("/auth/login", publicRoute((request) => this.handleLogin(request)));
    httpServer.rawPost(
      "/auth/logout",
      authenticatedRoute(requireSession, (_request, _params, actor) => this.handleLogout(actor)),
    );
    httpServer.rawGet("/auth/me", authenticatedRoute(requireSession, () => this.handleMe()));
    httpServer.rawPost("/operator/organizations", publicRoute((request) => this.handleProvision(request)));
    httpServer.rawGet(
      "/invitations/:token",
      publicRoute((_request, params) => this.handleDescribeInvitation(params.token!)),
    );
    httpServer.rawPost(
      "/invitations/:token/accept",
      publicRoute((request, params) => this.handleAcceptInvitation(request, params.token!)),
    );
    httpServer.rawGet(
      "/organizations/:orgId/users",
      authenticatedRoute(requireSession, () => this.handleListUsers()),
    );
    httpServer.rawGet(
      "/organizations/:orgId/policy",
      authenticatedRoute(requireSession, () => this.handleReadPolicy()),
    );
    httpServer.rawPost(
      "/organizations/:orgId/users/invite",
      authenticatedRoute(requireSession, (request) => this.handleInvite(request)),
    );
    httpServer.rawPut(
      "/users/:userId/roles",
      authenticatedRoute(requireSession, (request, params) =>
        this.handleChangeRoles(request, params.userId!),
      ),
    );
    httpServer.rawPost(
      "/users/:userId/disable",
      authenticatedRoute(requireSession, (_request, params) => this.handleDisable(params.userId!)),
    );
    httpServer.rawPut(
      "/organizations/:orgId/policy",
      authenticatedRoute(requireSession, (request) => this.handleSetPolicy(request)),
    );
    httpServer.rawPost(
      "/credentials",
      authenticatedRoute(requireSession, (request) => this.handleIssueCredential(request)),
    );
    httpServer.rawPost(
      "/credentials/:id/rotate",
      authenticatedRoute(requireSession, (_request, params) => this.handleRotate(params.id!)),
    );
    httpServer.rawDelete(
      "/credentials/:id",
      authenticatedRoute(requireSession, (_request, params) => this.handleRevoke(params.id!)),
    );
    httpServer.rawGet("/credentials", authenticatedRoute(requireSession, () => this.handleListCredentials()));
  }

  // --- handlers ---

  private async handleLogin(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    // Login is a pre-tenant system operation: there is no actor yet. It must run through the
    // UnitOfWork (in a system scope) so the new session is flushed — repositories no longer
    // flush themselves (ADR-004). The system scope opens the transaction the session write
    // and its events commit in.
    const loginScope: Actor = { companyId: null, actorId: null, actorType: "system" };
    const result = await runWithActor(loginScope, () =>
      this.deps.applicationService.execute(
        this.deps.authenticate,
        AuthenticateCommand.of(IdentityModule.requireString(body, "email"), IdentityModule.requireString(body, "password")),
      ),
    );
    return {
      statusCode: HTTP_OK,
      body: { userId: result.userId, companyId: result.companyId, expiresAt: result.expiresAt.toISOString() },
      headers: { "Set-Cookie": buildSessionCookie(result.token, this.deps.sessionTtlSeconds, this.deps.cookieSecure) },
    };
  }

  private async handleLogout(actor: Actor): Promise<RouteResult> {
    if (actor.actorId !== null) {
      await this.deps.sessionRepository.revokeAllForUser(actor.actorId);
    }
    return { statusCode: HTTP_OK, body: { status: "logged-out" }, headers: { "Set-Cookie": buildClearedSessionCookie() } };
  }

  private async handleProvision(request: IncomingMessage): Promise<RouteResult> {
    const operator: Actor = { companyId: null, actorId: "operator", actorType: "operator" };
    return runWithActor(operator, async () => {
      if (this.deps.operatorSecret === null) {
        throw new DomainError(
          "identity.operatorProvisioningDisabled",
          "unavailable",
          undefined,
          "Operator provisioning is disabled (no operator secret configured)",
        );
      }
      const presented = request.headers[OPERATOR_SECRET_HEADER];
      if (presented !== this.deps.operatorSecret) {
        throw new DomainError("identity.forbidden", "forbidden", undefined, "Forbidden");
      }

      const body = await HttpServer.readJsonBody(request);
      const organizationId = IdentityModule.optionalString(body, "organizationId") ?? randomUUID();
      const command = ProvisionOrganizationCommand.of(
        organizationId,
        IdentityModule.requireString(body, "organizationName"),
        IdentityModule.optionalString(body, "adminUserId") ?? randomUUID(),
        IdentityModule.requireString(body, "adminEmail"),
        IdentityModule.requireString(body, "adminDisplayName"),
        IdentityModule.requireString(body, "adminPassword"),
      );
      const organization = await this.deps.applicationService.execute(this.deps.provisionOrganization, command);
      return { statusCode: HTTP_CREATED, body: { organizationId: organization.id.value } };
    });
  }

  private async handleDescribeInvitation(token: string): Promise<RouteResult> {
    // Public, pre-auth lookup keyed by the bearer token — run in a system scope so the
    // privileged (unfiltered) read can find the invited user across tenants.
    const system: Actor = { companyId: null, actorId: null, actorType: "system" };
    return runWithActor(system, async () => {
      const invitation = await this.deps.applicationService.execute(
        this.deps.describeInvitation,
        token,
      );
      if (invitation === null) {
        throw new DomainError(
          "identity.invitationNotFound",
          "not_found",
          undefined,
          "Invitation not found",
        );
      }
      return { statusCode: HTTP_OK, body: invitation };
    });
  }

  private async handleAcceptInvitation(
    request: IncomingMessage,
    token: string,
  ): Promise<RouteResult> {
    const system: Actor = { companyId: null, actorId: null, actorType: "system" };
    return runWithActor(system, async () => {
      const body = await HttpServer.readJsonBody(request);
      const command = AcceptInvitationCommand.of(token, IdentityModule.requireString(body, "password"));
      const user = await this.deps.applicationService.execute(this.deps.acceptInvitation, command);
      return { statusCode: HTTP_OK, body: { userId: user.id.value, status: user.status } };
    });
  }

  private async handleInvite(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = InviteUserCommand.of(
      IdentityModule.optionalString(body, "userId") ?? randomUUID(),
      IdentityModule.requireString(body, "email"),
      IdentityModule.requireString(body, "displayName"),
      IdentityModule.requireStringArray(body, "roles"),
    );
    const result = await this.deps.applicationService.execute(this.deps.inviteUser, command);
    return {
      statusCode: HTTP_CREATED,
      body: { userId: result.user.id.value, invitationToken: result.invitationToken },
    };
  }

  private async handleChangeRoles(
    request: IncomingMessage,
    userId: string,
  ): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = ChangeUserRolesCommand.of(userId, IdentityModule.requireStringArray(body, "roles"));
    const user = await this.deps.applicationService.execute(this.deps.changeUserRoles, command);
    return { statusCode: HTTP_OK, body: { userId: user.id.value, roles: [...user.roles] } };
  }

  private async handleDisable(userId: string): Promise<RouteResult> {
    const user = await this.deps.applicationService.execute(this.deps.disableUser, DisableUserCommand.of(userId));
    return { statusCode: HTTP_OK, body: { userId: user.id.value, status: user.status } };
  }

  private async handleSetPolicy(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = SetOrganizationPolicyCommand.of(IdentityModule.requireBoolean(body, "requireSeparateReviewer"));
    const organization = await this.deps.applicationService.execute(this.deps.setOrganizationPolicy, command);
    return {
      statusCode: HTTP_OK,
      body: { organizationId: organization.id.value, requireSeparateReviewer: organization.policy.requireSeparateReviewer },
    };
  }

  private async handleIssueCredential(request: IncomingMessage): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = IssueConsumerCredentialCommand.of(
      IdentityModule.optionalString(body, "credentialId") ?? randomUUID(),
      IdentityModule.requireString(body, "name"),
      IdentityModule.requireStringArray(body, "collectionIds"),
      IdentityModule.requireString(body, "sensitivityCeiling"),
    );
    const result = await this.deps.applicationService.execute(this.deps.issueConsumerCredential, command);
    return { statusCode: HTTP_CREATED, body: { id: result.credential.id.value, secret: result.secret } };
  }

  private async handleRotate(credentialId: string): Promise<RouteResult> {
    const result = await this.deps.applicationService.execute(
      this.deps.rotateConsumerCredential,
      RotateConsumerCredentialCommand.of(credentialId),
    );
    return { statusCode: HTTP_OK, body: { id: result.credential.id.value, secret: result.secret } };
  }

  private async handleRevoke(credentialId: string): Promise<RouteResult> {
    const credential = await this.deps.applicationService.execute(
      this.deps.revokeConsumerCredential,
      RevokeConsumerCredentialCommand.of(credentialId),
    );
    return { statusCode: HTTP_OK, body: { id: credential.id.value, status: credential.status } };
  }

  private async handleListCredentials(): Promise<RouteResult> {
    const credentials: ReadonlyArray<ConsumerCredentialView> =
      await this.deps.applicationService.execute(this.deps.listConsumerCredentials, undefined);
    return { statusCode: HTTP_OK, body: { credentials } };
  }

  private async handleMe(): Promise<RouteResult> {
    const user = await this.deps.applicationService.execute(this.deps.describeCurrentUser, undefined);
    return { statusCode: HTTP_OK, body: user };
  }

  private async handleListUsers(): Promise<RouteResult> {
    const users = await this.deps.applicationService.execute(this.deps.listOrgUsers, undefined);
    return { statusCode: HTTP_OK, body: { users } };
  }

  private async handleReadPolicy(): Promise<RouteResult> {
    const policy = await this.deps.applicationService.execute(this.deps.readOrgPolicy, undefined);
    return { statusCode: HTTP_OK, body: policy };
  }

  // --- body parsing helpers ---

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required",
      );
    }
    return value;
  }

  private static optionalString(body: Record<string, unknown>, field: string): string | null {
    const value = body[field];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private static requireBoolean(body: Record<string, unknown>, field: string): boolean {
    const value = body[field];
    if (typeof value !== "boolean") {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required (boolean)",
      );
    }
    return value;
  }

  private static requireStringArray(body: Record<string, unknown>, field: string): ReadonlyArray<string> {
    const value = body[field];
    if (!Array.isArray(value)) {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field },
        "Field '" + field + "' is required (array)",
      );
    }
    const result: Array<string> = [];
    for (const item of value) {
      if (typeof item !== "string") {
        // No substring match in the old `statusForError` → 500; `kind: "internal"` preserves
        // it (ADR-026 migrates codes, not statuses).
        throw new DomainError(
          "common.fieldInvalid",
          "internal",
          { field },
          "Field '" + field + "' must contain only strings",
        );
      }
      result.push(item);
    }
    return result;
  }
}
