import { useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Monotonic timestamp of the last successful fetch. */
  lastOk: number;
}

/**
 * Poll an async fetcher on an interval with abort + remount safety. The fetcher
 * receives an AbortSignal; returning the same reference each render keeps the
 * loop stable (wrap call sites in useCallback). Errors are surfaced but do not
 * clear the last good data — the deck keeps showing telemetry through a blip.
 */
export function usePoll<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): PollState<T> {
  const [state, setState] = useState<PollState<T>>({
    data: null,
    error: null,
    loading: true,
    lastOk: 0,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    // A fresh fetcher identity means a new subject — reset to loading.
    setState((s) => ({ ...s, loading: true, error: null, data: null }));

    const tick = async () => {
      controller = new AbortController();
      try {
        const data = await fetcherRef.current(controller.signal);
        if (!alive) return;
        setState({ data, error: null, loading: false, lastOk: Date.now() });
      } catch (err) {
        if (!alive || controller.signal.aborted) return;
        setState((s) => ({ ...s, error: err, loading: false }));
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    };
    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [fetcher, intervalMs]);

  return state;
}
