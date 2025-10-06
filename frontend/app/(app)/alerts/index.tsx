import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef } from "react";

/**
 * Alerts index screen that redirects to the role-appropriate alerts route.
 * Defaults to the citizen view when the role is missing or invalid.
 *
 * @returns Nothing; navigation happens immediately.
 */
export default function AlertsIndex() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const normalizedRole = useMemo<Role>(() => normalizeRole(role), [role]);
  const pathname = useMemo<AlertsPath>(() => getAlertsPath(normalizedRole), [normalizedRole]);

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    router.replace({ pathname, params: { role: normalizedRole } });
  }, [pathname, normalizedRole]);

  return null;
}

type Role = "officer" | "citizen";

type AlertsPath = "/alerts/manage" | "/alerts/citizen";

function normalizeRole(raw?: string): Role {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "officer" ? "officer" : "citizen";
}

function getAlertsPath(role: Role): AlertsPath {
  return role === "officer" ? "/alerts/manage" : "/alerts/citizen";
}
