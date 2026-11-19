"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { queryKeys } from "@/services/api/query";
import {
  assessNetworkStatus,
  probeNetworkStatus,
  type NetworkStatusAssessment,
  type NetworkStatusProbe
} from "@/services/operators";

type NetworkStatusValue = {
  assessment: NetworkStatusAssessment;
  isOnline: boolean;
  recheck: () => void;
};

const statusProbeIntervalMs = 60_000;

const NetworkStatusContext = createContext<NetworkStatusValue | undefined>(undefined);

/**
 * Shares one browser online/offline listener and one read-only backend probe
 * across the shell. The probe never invalidates queries or retries mutations,
 * so reconnecting cannot replay an unsafe payment action.
 */
export function NetworkStatusProvider({
  children,
  probe = probeNetworkStatus
}: {
  children: React.ReactNode;
  probe?: () => Promise<NetworkStatusProbe>;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [browserObservedAt, setBrowserObservedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    const syncBrowserState = () => {
      setIsOnline(window.navigator.onLine);
      setBrowserObservedAt(new Date().toISOString());
    };

    syncBrowserState();
    window.addEventListener("online", syncBrowserState);
    window.addEventListener("offline", syncBrowserState);

    return () => {
      window.removeEventListener("online", syncBrowserState);
      window.removeEventListener("offline", syncBrowserState);
    };
  }, []);

  const statusQuery = useQuery({
    enabled: isOnline,
    queryFn: () => probe(),
    queryKey: queryKeys.networkStatus,
    refetchInterval: statusProbeIntervalMs,
    staleTime: 0
  });

  const assessment = useMemo(
    () =>
      assessNetworkStatus({
        browserObservedAt,
        online: isOnline,
        probe: statusQuery.data
      }),
    [browserObservedAt, isOnline, statusQuery.data]
  );

  const recheck = useCallback(() => {
    if (!isOnline) return;

    // Refetch only the read-only status probe. This is the sole recovery
    // action: no query invalidation and no mutation replay.
    void statusQuery.refetch();
  }, [isOnline, statusQuery]);

  const value = useMemo(() => ({ assessment, isOnline, recheck }), [assessment, isOnline, recheck]);

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);

  if (context === undefined) {
    throw new Error("useNetworkStatus must be used within NetworkStatusProvider.");
  }

  return context;
}
