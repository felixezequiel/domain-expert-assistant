import { LoggerRegistry } from "../logging/LoggerRegistry.ts";

interface LogOptions {
  readonly level: "info" | "warn" | "error" | "debug";
}

const DEFAULT_LOG_LEVEL: LogOptions["level"] = "info";

/**
 * Method decorator for automatic logging.
 *
 * Logs method entry (with arguments), exit (with duration),
 * and errors automatically. Works with both sync and async methods.
 *
 * Usage:
 *   @log                       - logs at "info" level
 *   @log({ level: "debug" })   - logs at custom level
 */
export function log(target: object, propertyKey: string, descriptor: PropertyDescriptor): void;

export function log(
  options: LogOptions,
): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void;

export function log(
  targetOrOptions: object | LogOptions,
  propertyKey?: string,
  descriptor?: PropertyDescriptor,
): void | ((target: object, key: string, desc: PropertyDescriptor) => void) {
  if (propertyKey !== undefined && descriptor !== undefined) {
    applyLogging(targetOrOptions, propertyKey, descriptor, DEFAULT_LOG_LEVEL);
    return;
  }

  const options = targetOrOptions as LogOptions;
  return function decoratorFactory(target: object, key: string, desc: PropertyDescriptor): void {
    applyLogging(target, key, desc, options.level);
  };
}

function applyLogging(
  target: object,
  propertyKey: string,
  descriptor: PropertyDescriptor,
  level: LogOptions["level"],
): void {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  const fullMethodName = className + "." + propertyKey;

  descriptor.value = function loggedMethod(this: unknown, ...args: Array<unknown>): unknown {
    const logger = LoggerRegistry.getLogger();

    logger[level](fullMethodName + " - entry", { args });

    const startTime = performance.now();

    try {
      const result = originalMethod.apply(this, args);

      const isPromise =
        result !== null &&
        result !== undefined &&
        typeof (result as Promise<unknown>).then === "function";

      if (isPromise) {
        return (result as Promise<unknown>).then(
          (resolvedValue) => {
            const durationMs = performance.now() - startTime;
            logger[level](fullMethodName + " - exit", { durationMs });
            return resolvedValue;
          },
          (error) => {
            const durationMs = performance.now() - startTime;
            logger.error(fullMethodName + " - error", {
              durationMs,
              error: String(error),
            });
            throw error;
          },
        );
      }

      const durationMs = performance.now() - startTime;
      logger[level](fullMethodName + " - exit", { durationMs });
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      logger.error(fullMethodName + " - error", {
        durationMs,
        error: String(error),
      });
      throw error;
    }
  };
}
