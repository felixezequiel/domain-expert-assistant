import { Bench } from "tinybench";
import { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../shared/application/DomainEventManager.ts";
import type { EventPublisherPort } from "../../../shared/ports/EventPublisherPort.ts";
import type { DomainEvent } from "../../../shared/domain/events/DomainEvent.ts";
import { NoOpUnitOfWork } from "../../../shared/infrastructure/persistence/adapters/NoOpUnitOfWork.ts";
import { NoOpEventStore } from "../../../shared/infrastructure/persistence/adapters/eventStore/NoOpEventStore.ts";
import { CreateUserUseCase } from "../application/usecase/CreateUserUseCase.ts";
import { CreateUserCommand } from "../application/command/CreateUserCommand.ts";
import { InMemoryUserRepository } from "../infrastructure/persistence/in-memory/InMemoryUserRepository.ts";

class CountingEventPublisher implements EventPublisherPort {
  public publishedCount = 0;

  public async publish(): Promise<void> {
    this.publishedCount = this.publishedCount + 1;
  }

  public async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    this.publishedCount = this.publishedCount + events.length;
  }
}

const BENCH_TIME_MS = 5000;
const WARMUP_TIME_MS = 1000;

function formatBytes(bytes: number): string {
  const MEGABYTE = 1024 * 1024;
  return (bytes / MEGABYTE).toFixed(2) + " MB";
}

function printMemorySnapshot(
  label: string,
  memoryBefore: NodeJS.MemoryUsage,
  memoryAfter: NodeJS.MemoryUsage,
): void {
  const heapUsedDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
  const rssDelta = memoryAfter.rss - memoryBefore.rss;

  console.log("\n--- Memory: " + label + " ---");
  console.log(
    "  Heap used: " +
      formatBytes(memoryAfter.heapUsed) +
      " (delta: " +
      formatBytes(heapUsedDelta) +
      ")",
  );
  console.log(
    "  RSS:       " + formatBytes(memoryAfter.rss) + " (delta: " + formatBytes(rssDelta) + ")",
  );
}

function createInfrastructure(): {
  applicationService: ApplicationService;
  userRepository: InMemoryUserRepository;
  eventManager: DomainEventManager;
  eventPublisher: CountingEventPublisher;
} {
  const userRepository = new InMemoryUserRepository();
  const unitOfWork = new NoOpUnitOfWork();
  const eventManager = new DomainEventManager();
  const eventPublisher = new CountingEventPublisher();
  const eventStore = new NoOpEventStore();
  const applicationService = new ApplicationService(
    unitOfWork,
    eventManager,
    eventPublisher,
    eventStore,
  );

  return { applicationService, userRepository, eventManager, eventPublisher };
}

async function runCreateUserBenchmarks(): Promise<void> {
  console.log("=== CreateUser Full Cycle Benchmarks ===\n");

  // --- Throughput benchmarks ---

  const throughputBench = new Bench({
    time: BENCH_TIME_MS,
    warmupTime: WARMUP_TIME_MS,
  });

  // Scenario 1: Full cycle without event handlers
  let userCounter = 0;

  throughputBench.add("full cycle — no event handlers", async () => {
    const infrastructure = createInfrastructure();
    const useCase = new CreateUserUseCase(infrastructure.userRepository);
    const userId = "user-" + userCounter;
    const userEmail = "user" + userCounter + "@bench.com";
    userCounter = userCounter + 1;

    const command = CreateUserCommand.of(userId, "Bench User", userEmail);
    await infrastructure.applicationService.execute(useCase, command);
  });

  // Scenario 2: Full cycle with domain event handler
  let userWithEventsCounter = 0;

  throughputBench.add("full cycle — with event handler", async () => {
    const infrastructure = createInfrastructure();
    const useCase = new CreateUserUseCase(infrastructure.userRepository);
    infrastructure.eventManager.register("UserCreated", async () => {});

    const userId = "user-" + userWithEventsCounter;
    const userEmail = "user" + userWithEventsCounter + "@bench.com";
    userWithEventsCounter = userWithEventsCounter + 1;

    const command = CreateUserCommand.of(userId, "Bench User", userEmail);
    await infrastructure.applicationService.execute(useCase, command);
  });

  // Scenario 3: Full cycle reusing repository (growing dataset)
  const sharedInfrastructure = createInfrastructure();
  const sharedUseCase = new CreateUserUseCase(sharedInfrastructure.userRepository);
  sharedInfrastructure.eventManager.register("UserCreated", async () => {});
  let sharedCounter = 0;

  throughputBench.add("full cycle — shared repository (growing dataset)", async () => {
    const userId = "shared-user-" + sharedCounter;
    const userEmail = "shared" + sharedCounter + "@bench.com";
    sharedCounter = sharedCounter + 1;

    const command = CreateUserCommand.of(userId, "Bench User", userEmail);
    await sharedInfrastructure.applicationService.execute(sharedUseCase, command);
  });

  console.log(
    "Running throughput benchmarks (" +
      BENCH_TIME_MS +
      "ms per task, " +
      WARMUP_TIME_MS +
      "ms warmup)...\n",
  );
  await throughputBench.run();
  console.table(throughputBench.table());

  // --- Stress test: sustained burst ---

  console.log("\n=== Stress Test: Sustained Burst (10,000 users) ===\n");

  const STRESS_USERS = 10_000;
  const stressInfra = createInfrastructure();
  const stressUseCase = new CreateUserUseCase(stressInfra.userRepository);
  let stressEventCount = 0;

  stressInfra.eventManager.register("UserCreated", async () => {
    stressEventCount = stressEventCount + 1;
  });

  const memoryBefore = process.memoryUsage();
  const stressStartTime = performance.now();

  for (let userIndex = 0; userIndex < STRESS_USERS; userIndex++) {
    const userId = "stress-" + userIndex;
    const userEmail = "stress" + userIndex + "@bench.com";
    const command = CreateUserCommand.of(userId, "Stress User", userEmail);
    await stressInfra.applicationService.execute(stressUseCase, command);
  }

  const stressDurationMs = performance.now() - stressStartTime;
  const memoryAfter = process.memoryUsage();

  const stressDurationSeconds = stressDurationMs / 1000;
  const usersPerSecond = Math.round(STRESS_USERS / stressDurationSeconds);

  console.log("Burst: " + STRESS_USERS + " users through full cycle");
  console.log("Duration: " + stressDurationMs.toFixed(2) + "ms");
  console.log("Throughput: " + usersPerSecond + " users/sec");
  console.log("Events handled: " + stressEventCount);
  console.log("Events published: " + stressInfra.eventPublisher.publishedCount);

  printMemorySnapshot("Sustained Burst (" + STRESS_USERS + " users)", memoryBefore, memoryAfter);
}

runCreateUserBenchmarks();
