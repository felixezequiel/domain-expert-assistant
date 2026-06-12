import { randomUUID } from "node:crypto";
import { Bench } from "tinybench";
import { EventEmitterEventBus } from "../EventEmitterEventBus.ts";
import type { DomainEvent } from "../../../domain/events/DomainEvent.ts";

class FakeBenchmarkEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;

  constructor(eventName: string, aggregateId: string) {
    this.eventId = randomUUID();
    this.eventName = eventName;
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.causationId = null;
  }
}

const SUBSCRIBERS_PER_EVENT = 5;
const TOTAL_EVENT_TYPES = 50;
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

async function runEventBusBenchmarks(): Promise<void> {
  console.log("=== EventEmitterEventBus Benchmarks ===\n");

  // --- Throughput benchmarks ---

  const throughputBench = new Bench({
    time: BENCH_TIME_MS,
    warmupTime: WARMUP_TIME_MS,
  });

  // Scenario 1: Single subscriber
  const singleSubscriberBus = new EventEmitterEventBus();
  singleSubscriberBus.subscribe("BenchEvent", async () => {});

  throughputBench.add("publish — 1 subscriber", async () => {
    const event = new FakeBenchmarkEvent("BenchEvent", "agg-1");
    await singleSubscriberBus.publish(event);
  });

  // Scenario 2: Multiple subscribers
  const multiSubscriberBus = new EventEmitterEventBus();
  for (let subscriberIndex = 0; subscriberIndex < SUBSCRIBERS_PER_EVENT; subscriberIndex++) {
    multiSubscriberBus.subscribe("BenchEvent", async () => {});
  }

  throughputBench.add("publish — " + SUBSCRIBERS_PER_EVENT + " subscribers", async () => {
    const event = new FakeBenchmarkEvent("BenchEvent", "agg-1");
    await multiSubscriberBus.publish(event);
  });

  // Scenario 3: Many event types
  const multiTypeBus = new EventEmitterEventBus();
  for (let typeIndex = 0; typeIndex < TOTAL_EVENT_TYPES; typeIndex++) {
    const eventName = "EventType_" + typeIndex;
    for (let subscriberIndex = 0; subscriberIndex < SUBSCRIBERS_PER_EVENT; subscriberIndex++) {
      multiTypeBus.subscribe(eventName, async () => {});
    }
  }

  let eventTypeCounter = 0;
  throughputBench.add(
    "publish — " + TOTAL_EVENT_TYPES + " event types (" + SUBSCRIBERS_PER_EVENT + " subs each)",
    async () => {
      const typeIndex = eventTypeCounter % TOTAL_EVENT_TYPES;
      eventTypeCounter = eventTypeCounter + 1;
      const eventName = "EventType_" + typeIndex;
      const event = new FakeBenchmarkEvent(eventName, "agg-" + typeIndex);
      await multiTypeBus.publish(event);
    },
  );

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

  console.log("\n=== Stress Test: Sustained Burst ===\n");

  const STRESS_EVENTS = 100_000;
  const stressBus = new EventEmitterEventBus();
  let stressReceivedCount = 0;

  for (let subscriberIndex = 0; subscriberIndex < SUBSCRIBERS_PER_EVENT; subscriberIndex++) {
    stressBus.subscribe("StressEvent", async () => {
      stressReceivedCount = stressReceivedCount + 1;
    });
  }

  const memoryBefore = process.memoryUsage();
  const stressStartTime = performance.now();

  for (let eventIndex = 0; eventIndex < STRESS_EVENTS; eventIndex++) {
    const event = new FakeBenchmarkEvent("StressEvent", "agg-" + eventIndex);
    await stressBus.publish(event);
  }

  const stressDurationMs = performance.now() - stressStartTime;
  const memoryAfter = process.memoryUsage();

  const stressDurationSeconds = stressDurationMs / 1000;
  const eventsPerSecond = Math.round(STRESS_EVENTS / stressDurationSeconds);
  const expectedReceived = STRESS_EVENTS * SUBSCRIBERS_PER_EVENT;

  console.log("Burst: " + STRESS_EVENTS + " events to " + SUBSCRIBERS_PER_EVENT + " subscribers");
  console.log("Duration: " + stressDurationMs.toFixed(2) + "ms");
  console.log("Throughput: " + eventsPerSecond + " events/sec");
  console.log("Total deliveries: " + stressReceivedCount + " (expected: " + expectedReceived + ")");

  printMemorySnapshot("Sustained Burst", memoryBefore, memoryAfter);
}

runEventBusBenchmarks();
