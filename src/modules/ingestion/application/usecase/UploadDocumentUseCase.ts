import { randomUUID } from "node:crypto";
import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type { IngestionJobRepositoryPort, FileStoragePort } from "../types.ts";
import type { UploadDocumentCommand } from "../command/IngestionCommands.ts";
import { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";

/**
 * Curator uploads a document. The bytes are stored via the FileStoragePort and a `pending`
 * IngestionJob is created; the use case returns immediately — extraction happens async in
 * the worker (ADR-015). The job auto-persists via its aggregate persister at commit.
 */
export class UploadDocumentUseCase implements UseCase<UploadDocumentCommand, IngestionJob> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["curator"];

  private readonly fileStorage: FileStoragePort;

  constructor(fileStorage: FileStoragePort) {
    this.fileStorage = fileStorage;
  }

  public async execute(command: UploadDocumentCommand): Promise<IngestionJob> {
    const actor = getCurrentActor();
    const companyId = actor?.companyId ?? null;
    const createdBy = actor?.actorId ?? null;
    if (companyId === null || createdBy === null) {
      throw new Error("Cannot upload a document without a tenant/actor in the context");
    }

    const jobId = new IngestionJobId(randomUUID());
    const storageRef = companyId + "/" + jobId.value;
    await this.fileStorage.store(companyId, storageRef, command.content);

    return IngestionJob.upload(
      jobId,
      companyId,
      command.collectionId,
      command.filename,
      command.mimeType,
      storageRef,
      createdBy,
    );
  }
}
