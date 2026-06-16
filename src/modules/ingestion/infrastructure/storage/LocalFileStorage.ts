import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { FileStoragePort } from "../../application/types.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

const STORAGE_ROOT = "data/ingestion";

/**
 * Local filesystem document storage (ADR-016 v1; S3 later). Files live under
 * `data/ingestion/<companyId>/...`. `read` is fail-closed: the requested companyId must
 * match the current actor-context tenant, so a forged/leaked storageRef can never read
 * another tenant's bytes even though file storage sits outside the DB tenant filter.
 */
export class LocalFileStorage implements FileStoragePort {
  public async store(companyId: string, storageRef: string, content: Buffer): Promise<void> {
    const path = LocalFileStorage.pathFor(companyId, storageRef);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  public async read(companyId: string, storageRef: string): Promise<Buffer> {
    const actorCompanyId = getCurrentActor()?.companyId ?? null;
    if (actorCompanyId !== companyId) {
      throw new Error("Fail-closed: cannot read a file outside the current tenant scope");
    }
    return readFile(LocalFileStorage.pathFor(companyId, storageRef));
  }

  private static pathFor(companyId: string, storageRef: string): string {
    if (storageRef.includes("..") || companyId.includes("..")) {
      throw new Error("Invalid storage reference");
    }
    return resolve(STORAGE_ROOT, storageRef);
  }
}
