import { useCallback, useEffect, useState } from "react";

/** Cancels obsolete reads on navigation, dependency changes, refresh and unmount. */
export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<{ data: T }>,
  initial: T,
) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result.data);
          setLastLoadedAt(new Date());
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load records.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, version]);
  return { data, setData, loading, error, setError, refresh, lastLoadedAt };
}
