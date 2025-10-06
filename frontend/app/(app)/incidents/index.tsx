import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef } from "react";

/**
 * Incidents index screen that redirects to the correct incidents route for the role.
 * Falls back to the citizen flow when the role is missing or invalid.
 *
 * @returns Nothing; navigation happens immediately.
 */
export default function IncidentsIndex() {
  const { role } = useLocalSearchParams<{ role?: string }>();

  const normalizedRole = useMemo<"officer" | "citizen">(() => normalizeRole(role), [role]);
  const pathname = useMemo<IncidentsPath>(() => getIncidentsPath(normalizedRole), [normalizedRole]);

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const href = {
      pathname,
      params: { role: normalizedRole },
    } satisfies { pathname: IncidentsPath; params: { role: "officer" | "citizen" } };

    router.replace(href);
  }, [pathname, normalizedRole]);

  return null;
}

/** Normalize role to a supported value. */
function normalizeRole(raw?: string): "officer" | "citizen" {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "officer" ? "officer" : "citizen";
}

/** Allowed incidents paths (literal union). */
type IncidentsPath = "/incidents/manage-incidents" | "/incidents/report-incidents";

/** Resolve incidents route by role. */
function getIncidentsPath(role: "officer" | "citizen"): IncidentsPath {
  return role === "officer"
    ? "/incidents/manage-incidents"
    : "/incidents/report-incidents";
}
