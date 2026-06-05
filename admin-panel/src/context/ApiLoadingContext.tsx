import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type ApiLoadingContextValue = {
  pendingCount: number;
  isLoading: boolean;
};

type Listener = (pendingCount: number) => void;

const MIN_VISIBLE_MS = 300;
let pendingCount = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(pendingCount));
}

export const apiLoadingTracker = {
  start() {
    pendingCount += 1;
    emit();
  },
  finish() {
    pendingCount = Math.max(0, pendingCount - 1);
    emit();
  },
  getPendingCount() {
    return pendingCount;
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(pendingCount);
    return () => {
      listeners.delete(listener);
    };
  },
};

const ApiLoadingContext = createContext<ApiLoadingContextValue>({
  pendingCount: 0,
  isLoading: false,
});

export function ApiLoadingProvider({ children }: { children: React.ReactNode }) {
  const [currentPendingCount, setCurrentPendingCount] = useState(apiLoadingTracker.getPendingCount());
  const [isVisible, setIsVisible] = useState(currentPendingCount > 0);
  const visibleSinceRef = useRef<number | null>(currentPendingCount > 0 ? Date.now() : null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => apiLoadingTracker.subscribe(setCurrentPendingCount), []);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (currentPendingCount > 0) {
      if (!isVisible) {
        visibleSinceRef.current = Date.now();
        setIsVisible(true);
      }
      return;
    }

    if (!isVisible) return;

    const visibleSince = visibleSinceRef.current ?? Date.now();
    const elapsed = Date.now() - visibleSince;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = window.setTimeout(() => {
      visibleSinceRef.current = null;
      setIsVisible(false);
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [currentPendingCount, isVisible]);

  const value = useMemo(
    () => ({
      pendingCount: currentPendingCount,
      isLoading: isVisible,
    }),
    [currentPendingCount, isVisible],
  );

  return <ApiLoadingContext.Provider value={value}>{children}</ApiLoadingContext.Provider>;
}

export function useApiLoading() {
  return useContext(ApiLoadingContext);
}
