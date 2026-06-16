import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: unknown;
  reload(): void;
}

// Runs an async loader on mount (and whenever `deps` change), tracking loading/error.
// `reload` lets screens re-fetch after a mutation.
export function useAsync<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runLoader = useCallback(loader, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    runLoader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runLoader, tick]);

  const reload = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  return { data, loading, error, reload };
}
