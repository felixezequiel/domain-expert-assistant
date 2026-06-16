import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { runWithActor, type Actor } from "../../../shared/application/context/ActorContext.ts";
import {
  readSessionToken,
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
import type { ResolveSessionUseCase } from "../application/usecase/ResolveSessionUseCase.ts";
import type { InviteUserUseCase } from "../application/usecase/InviteUserUseCase.ts";
import type { AcceptInvitationUseCase } from "../application/usecase/AcceptInvitationUseCase.ts";
import type { ChangeUserRolesUseCase } from "../application/usecase/ChangeUserRolesUseCase.ts";
import type { DisableUserUseCase } from "../application/usecase/DisableUserUseCase.ts";
import type { SetOrganizationPolicyUseCase } from "../application/usecase/SetOrganizationPolicyUseCase.ts";
import type { IssueConsumerCredentialUseCase } from "../application/usecase/IssueConsumerCredentialUseCase.ts";
import type { RotateConsumerCredentialUseCase } from "../application/usecase/RotateConsumerCredentialUseCase.ts";
import type { RevokeConsumerCredentialUseCase } from "../application/usecase/RevokeConsumerCredentialUseCase.ts";
import type { ListConsumerCredentialsUseCase } from "../application/usecase/ListConsumerCredentialsUseCase.ts";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
  readonly setCookie?: string;
}

export interface IdentityModuleDeps {
  readonly applicationService: ApplicationService;
  readonly sessionRepository: SessionRepositoryPort;
  readonly provisionOrganization: ProvisionOrganizationUseCase;
  readonly authenticate: AuthenticateUseCase;
  readonly resolveSession: ResolveSessionUseCase;
  readonly inviteUser: InviteUserUseCase;
  readonly acceptInvitation: AcceptInvitationUseCase;
  readonly changeUserRoles: ChangeUserRolesUseCase;
  readonly disableUser: DisableUserUseCase;
  readonly setOrganizationPolicy: SetOrganizationPolicyUseCase;
  readonly issueConsumerCredential: IssueConsumerCredentialUseCase;
  readonly rotateConsumerCredential: RotateConsumerCredentialUseCase;
  readonly revokeConsumerCredential: RevokeConsumerCredentialUseCase;
  readonly listConsumerCredentials: ListConsumerCredentialsUseCase;
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
    httpServer.rawPost("/auth/login", (request, response) => {
      void this.handleLogin(request, response);
    });
    httpServer.rawPost("/auth/logout", (request, response) => {
      void this.authed(request, response, async (actor) => this.handleLogout(actor));
    });
    httpServer.rawPost("/operator/organizations", (request, response) => {
      void this.handleProvision(request, response);
    });
    httpServer.rawPost("/invitations/:token/accept", (request, response, params) => {
      void this.handleAcceptInvitation(request, response, params.token!);
    });
    httpServer.rawPost("/organizations/:orgId/users/invite", (request, response) => {
      void this.authed(request, response, async (actor) => this.handleInvite(request, actor));
    });
    httpServer.rawPut("/users/:userId/roles", (request, response, params) => {
      void this.authed(request, response, async (actor) =>
        this.handleChangeRoles(request, params.userId!, actor),
      );
    });
    httpServer.rawPost("/users/:userId/disable", (request, response, params) => {
      void this.authed(request, response, async (actor) => this.handleDisable(params.userId!, actor));
    });
    httpServer.rawPut("/organizations/:orgId/policy", (request, response) => {
      void this.authed(request, response, async (actor) => this.handleSetPolicy(request, actor));
    });
    httpServer.rawPost("/credentials", (request, response) => {
      void this.authed(request, response, async (actor) => this.handleIssueCredential(request, actor));
    });
    httpServer.rawPost("/credentials/:id/rotate", (request, response, params) => {
      void this.authed(request, response, async (actor) => this.handleRotate(params.id!, actor));
    });
    httpServer.rawDelete("/credentials/:id", (request, response, params) => {
      void this.authed(request, response, async (actor) => this.handleRevoke(params.id!, actor));
    });
    httpServer.rawGet("/credentials", (request, response) => {
      void this.authed(request, response, async (actor) => this.handleListCredentials(actor));
    });
  }

  // --- auth wrappers ---

  private async authed(
    request: IncomingMessage,
    response: ServerResponse,
    run: (actor: Actor) => Promise<RouteResult>,
  ): Promise<void> {
    const token = readSessionToken(request.headers.cookie);
    const principal = token === null ? null : await this.deps.resolveSession.execute(token);
    if (principal === null) {
      this.respond(response, { statusCode: HTTP_UNAUTHORIZED, body: { error: "Unauthorized" } });
      return;
    }
    const actor: Actor = {
      companyId: principal.companyId,
      actorId: principal.actorId,
      actorType: principal.actorType,
      roles: principal.roles,
    };
    await this.runAndRespond(response, () => runWithActor(actor, () => run(actor)));
  }

  private async runAndRespond(
    response: ServerResponse,
    run: () => Promise<RouteResult>,
  ): Promise<void> {
    try {
      this.respond(response, await run());
    } catch (error) {
      this.respondError(response, error);
    }
  }

  // --- handlers ---

  private async handleLogin(request: IncomingMessage, response: ServerResponse): Promise<void> {
    await this.runAndRespond(response, async () => {
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
        setCookie: buildSessionCookie(result.token, this.deps.sessionTtlSeconds, this.deps.cookieSecure),
      };
    });
  }

  private async handleLogout(actor: Actor): Promise<RouteResult> {
    if (actor.actorId !== null) {
      await this.deps.sessionRepository.revokeAllForUser(actor.actorId);
    }
    return { statusCode: HTTP_OK, body: { status: "logged-out" }, setCookie: buildClearedSessionCookie() };
  }

  private async handleProvision(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (this.deps.operatorSecret === null) {
      this.respond(response, {
        statusCode: HTTP_SERVICE_UNAVAILABLE,
        body: { error: "Operator provisioning is disabled (no operator secret configured)" },
      });
      return;
    }
    const presented = request.headers[OPERATOR_SECRET_HEADER];
    if (presented !== this.deps.operatorSecret) {
      this.respond(response, { statusCode: HTTP_FORBIDDEN, body: { error: "Forbidden" } });
      return;
    }

    const operator: Actor = { companyId: null, actorId: "operator", actorType: "operator" };
    await this.runAndRespond(response, () =>
      runWithActor(operator, async () => {
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
      }),
    );
  }

  private async handleAcceptInvitation(
    request: IncomingMessage,
    response: ServerResponse,
    token: string,
  ): Promise<void> {
    const system: Actor = { companyId: null, actorId: null, actorType: "system" };
    await this.runAndRespond(response, () =>
      runWithActor(system, async () => {
        const body = await HttpServer.readJsonBody(request);
        const command = AcceptInvitationCommand.of(token, IdentityModule.requireString(body, "password"));
        const user = await this.deps.applicationService.execute(this.deps.acceptInvitation, command);
        return { statusCode: HTTP_OK, body: { userId: user.id.value, status: user.status } };
      }),
    );
  }

  private async handleInvite(request: IncomingMessage, _actor: Actor): Promise<RouteResult> {
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
    _actor: Actor,
  ): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = ChangeUserRolesCommand.of(userId, IdentityModule.requireStringArray(body, "roles"));
    const user = await this.deps.applicationService.execute(this.deps.changeUserRoles, command);
    return { statusCode: HTTP_OK, body: { userId: user.id.value, roles: [...user.roles] } };
  }

  private async handleDisable(userId: string, _actor: Actor): Promise<RouteResult> {
    const user = await this.deps.applicationService.execute(this.deps.disableUser, DisableUserCommand.of(userId));
    return { statusCode: HTTP_OK, body: { userId: user.id.value, status: user.status } };
  }

  private async handleSetPolicy(request: IncomingMessage, _actor: Actor): Promise<RouteResult> {
    const body = await HttpServer.readJsonBody(request);
    const command = SetOrganizationPolicyCommand.of(IdentityModule.requireBoolean(body, "requireSeparateReviewer"));
    const organization = await this.deps.applicationService.execute(this.deps.setOrganizationPolicy, command);
    return {
      statusCode: HTTP_OK,
      body: { organizationId: organization.id.value, requireSeparateReviewer: organization.policy.requireSeparateReviewer },
    };
  }

  private async handleIssueCredential(request: IncomingMessage, _actor: Actor): Promise<RouteResult> {
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

  private async handleRotate(credentialId: string, _actor: Actor): Promise<RouteResult> {
    const result = await this.deps.applicationService.execute(
      this.deps.rotateConsumerCredential,
      RotateConsumerCredentialCommand.of(credentialId),
    );
    return { statusCode: HTTP_OK, body: { id: result.credential.id.value, secret: result.secret } };
  }

  private async handleRevoke(credentialId: string, _actor: Actor): Promise<RouteResult> {
    const credential = await this.deps.applicationService.execute(
      this.deps.revokeConsumerCredential,
      RevokeConsumerCredentialCommand.of(credentialId),
    );
    return { statusCode: HTTP_OK, body: { id: credential.id.value, status: credential.status } };
  }

  private async handleListCredentials(_actor: Actor): Promise<RouteResult> {
    const credentials: ReadonlyArray<ConsumerCredentialView> =
      await this.deps.applicationService.execute(this.deps.listConsumerCredentials, undefined);
    return { statusCode: HTTP_OK, body: { credentials } };
  }

  // --- response helpers ---

  private respond(response: ServerResponse, result: RouteResult): void {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (result.setCookie !== undefined) {
      headers["Set-Cookie"] = result.setCookie;
    }
    response.writeHead(result.statusCode, headers);
    response.end(JSON.stringify(result.body));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const statusCode = IdentityModule.statusForError(message);
    this.respond(response, { statusCode, body: { error: message } });
  }

  private static statusForError(message: string): number {
    if (message === "Invalid credentials" || message.startsWith("Forbidden")) {
      return message === "Invalid credentials" ? HTTP_UNAUTHORIZED : HTTP_FORBIDDEN;
    }
    if (
      message.includes("not found") ||
      message.includes("already") ||
      message.includes("Invalid") ||
      message.includes("required") ||
      message.includes("at least one")
    ) {
      return HTTP_BAD_REQUEST;
    }
    return HTTP_INTERNAL_ERROR;
  }

  private static requireString(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Field '" + field + "' is required");
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
      throw new Error("Field '" + field + "' is required (boolean)");
    }
    return value;
  }

  private static requireStringArray(body: Record<string, unknown>, field: string): ReadonlyArray<string> {
    const value = body[field];
    if (!Array.isArray(value)) {
      throw new Error("Field '" + field + "' is required (array)");
    }
    const result: Array<string> = [];
    for (const item of value) {
      if (typeof item !== "string") {
        throw new Error("Field '" + field + "' must contain only strings");
      }
      result.push(item);
    }
    return result;
  }
}
