import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type { EventEmitterEventBus } from "../../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import type { ProjectItemUseCase } from "../../application/usecase/IndexingUseCases.ts";
import type {
  DeprecateItemIndexUseCase,
  RemoveItemFromIndexUseCase,
} from "../../application/usecase/IndexingUseCases.ts";
import {
  ProjectItemCommand,
  DeprecateItemIndexCommand,
  RemoveItemFromIndexCommand,
} from "../../application/command/RetrievalCommands.ts";

type Signal = "project" | "deprecate" | "remove";

interface IndexTask {
  readonly signal: Signal;
  readonly companyId: string;
  readonly itemId: string;
}

/**
 * In-process index projection worker (ADR-020, no broker). Knowledge lifecycle events are the
 * triggers: `Published` → re-chunk+embed+replace; `Deprecated` → keep indexed, flag stale;
 * `Archived` → remove. Crucially, indexing must NEVER run inside the publish commit — so the
 * EventBus subscriber only ENQUEUES the (already-enriched, companyId-stamped) signal and
 * returns immediately; the publish transaction commits unblocked. A drain loop then runs each
 * task through the ApplicationService in the item's OWN tenant scope as a `system` actor
 * (privileged scope, ADR-009), giving eventual consistency. Each use case is idempotent, so a
 * retry or a later rebuild converges to the same index state.
 */
export class IndexProjectionWorker {
  private readonly applicationService: ApplicationService;
  private readonly projectItem: ProjectItemUseCase;
  private readonly deprecateItem: DeprecateItemIndexUseCase;
  private readonly removeItem: RemoveItemFromIndexUseCase;
  private readonly queue: Array<IndexTask> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  constructor(
    applicationService: ApplicationService,
    projectItem: ProjectItemUseCase,
    deprecateItem: DeprecateItemIndexUseCase,
    removeItem: RemoveItemFromIndexUseCase,
  ) {
    this.applicationService = applicationService;
    this.projectItem = projectItem;
    this.deprecateItem = deprecateItem;
    this.removeItem = removeItem;
  }

  /**
   * Wires the subscriptions onto the EventBus the publish transaction publishes through. The
   * handlers run inside that transaction's publishAll, so they only enqueue — never index.
   */
  public subscribe(eventBus: EventEmitterEventBus): void {
    eventBus.subscribe("KnowledgeItemPublished", async (event) => this.enqueue("project", event));
    eventBus.subscribe("KnowledgeItemRolledBack", async (event) => this.enqueue("project", event));
    eventBus.subscribe("KnowledgeItemDeprecated", async (event) => this.enqueue("deprecate", event));
    eventBus.subscribe("KnowledgeItemArchived", async (event) => this.enqueue("remove", event));
  }

  private enqueue(signal: Signal, event: DomainEvent): void {
    const companyId = event.companyId;
    if (companyId === null || companyId === undefined) {
      return;
    }
    this.queue.push({ signal, companyId, itemId: event.aggregateId });
  }

  public async drainOnce(): Promise<number> {
    if (this.draining) {
      return 0;
    }
    this.draining = true;
    let processed = 0;
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!;
        await this.runTask(task);
        processed += 1;
      }
    } finally {
      this.draining = false;
    }
    return processed;
  }

  private async runTask(task: IndexTask): Promise<void> {
    await runWithActor(
      { companyId: task.companyId, actorId: "system", actorType: "system" },
      async () => {
        if (task.signal === "project") {
          await this.applicationService.execute(this.projectItem, ProjectItemCommand.of(task.itemId));
        } else if (task.signal === "deprecate") {
          await this.applicationService.execute(
            this.deprecateItem,
            DeprecateItemIndexCommand.of(task.companyId, task.itemId),
          );
        } else {
          await this.applicationService.execute(
            this.removeItem,
            RemoveItemFromIndexCommand.of(task.companyId, task.itemId),
          );
        }
      },
    );
  }

  public start(intervalMs: number): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.drainOnce().catch(() => {
        // a failed drain must not crash the worker; a later event or rebuild reprojects (ADR-020)
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public pendingCount(): number {
    return this.queue.length;
  }
}
