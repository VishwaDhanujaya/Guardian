// app/(app)/incidents/my-reports.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/toast";
import {
  fetchLostItems,
  fetchReports,
  formatRelativeTime,
  type LostItemDetail,
  type ReportSummary,
} from "@/lib/api";

import { ChevronRight, ClipboardList, Inbox } from "lucide-react-native";

/** Types */
type Priority = "Urgent" | "Normal" | "Low";
type KindFilter = "All" | "Incidents" | "Lost";

type Row = {
  id: string;
  resourceId: string;
  title: string;
  status: string;
  reportedAgo: string;
  priority?: Priority | null;
  kind: "incident" | "lost";
  meta?: string;
};

const statusTone = (s: string) =>
  s === "Resolved" || s === "Returned"
    ? "text-muted-foreground"
    : s === "Ongoing" || s === "Assigned" || s === "Approved" || s === "Searching"
    ? "text-ring"
    : s === "In Review" || s === "New"
    ? "text-primary"
    : "text-foreground";

/** Screen */
export default function MyReports() {
  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: "citizen" } });
  }, [navigation]);

  const params = useLocalSearchParams<{ filter?: string }>();

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [lostItems, setLostItems] = useState<LostItemDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentData, lostData] = await Promise.all([
        fetchReports(),
        fetchLostItems(),
      ]);
      setReports(incidentData);
      setLostItems(lostData);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to load reports";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const all = useMemo<Row[]>(() => {
    const incidentRows = reports.map(
      (report): Row => ({
        id: `incident-${report.id}`,
        resourceId: report.id,
        title: report.title,
        status: report.status,
        priority: report.suggestedPriority,
        reportedAgo: report.reportedAgo,
        kind: "incident",
      }),
    );
    const lostRows = lostItems.map((item): Row => {
      const subtitleParts = [item.branch, item.lastLocation].filter(
        (part): part is string => Boolean(part && part.trim()),
      );
      return {
        id: `lost-${item.id}`,
        resourceId: item.id,
        title: item.name?.trim() ? item.name : "Lost item report",
        status: item.status ?? "In Review",
        reportedAgo: formatRelativeTime(item.createdAt ?? null),
        priority: null,
        kind: "lost",
        meta: subtitleParts.join(" • "),
      };
    });
    return [...incidentRows, ...lostRows];
  }, [reports, lostItems]);

  const [categoryFilter, setCategoryFilter] = useState<KindFilter>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Ongoing" | "Resolved">("All");

  useEffect(() => {
    const initialFilter = params?.filter;
    if (typeof initialFilter === "string") {
      if (initialFilter.toLowerCase() === "lost") {
        setCategoryFilter("Lost");
      } else if (initialFilter.toLowerCase() === "incidents") {
        setCategoryFilter("Incidents");
      }
    }
  }, [params?.filter]);

  const filtered = useMemo(() => {
    return all.filter((row) => {
      if (categoryFilter === "Incidents" && row.kind !== "incident") return false;
      if (categoryFilter === "Lost" && row.kind !== "lost") return false;
      if (statusFilter === "All") return true;
      if (statusFilter === "Pending") return row.status === "New" || row.status === "In Review";
      if (statusFilter === "Ongoing") {
        return ["Approved", "Assigned", "Ongoing", "Searching"].includes(row.status);
      }
      return row.status === "Resolved" || row.status === "Returned";
    });
  }, [all, categoryFilter, statusFilter]);

  const priorityTone: Record<Priority, "danger" | "accent" | "primary"> = {
    Urgent: "danger",
    Normal: "accent",
    Low: "primary",
  };

  const categoryLabels: Record<KindFilter, string> = {
    All: "All reports",
    Incidents: "Incidents",
    Lost: "Lost items",
  };

  return (
    <AppScreen>
      <ScreenHeader
        title="My Reports"
        subtitle="Track updates on the incidents you've submitted."
        icon={ClipboardList}
        onBack={goBack}
      />

      <AppCard className="gap-5">
        <SectionHeader
          title="Your reports"
          description="Filter by status and tap a report to view progress."
          trailing={
            <View className="flex-row items-center gap-2">
              <Pill label={`${filtered.length} shown`} tone="primary" />
              <Button
                size="sm"
                variant="secondary"
                onPress={loadReports}
                className="h-9 rounded-full px-3"
                disabled={loading}
              >
                <Text className="text-[12px] text-foreground">{loading ? "Refreshing…" : "Refresh"}</Text>
              </Button>
            </View>
          }
        />

        <View className="flex-row flex-wrap gap-2">
          {(["All", "Incidents", "Lost"] as const).map((kind) => {
            const active = categoryFilter === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => setCategoryFilter(kind)}
                className={`rounded-full border px-3 py-1 ${
                  active ? "border-transparent bg-primary/15" : "border-border bg-background"
                }`}
                android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
              >
                <Text className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {categoryLabels[kind]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row flex-wrap gap-2">
          {(["All", "Pending", "Ongoing", "Resolved"] as const).map((f) => {
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setStatusFilter(f)}
                className={`rounded-full border px-3 py-1 ${
                  active ? "border-transparent bg-primary/10" : "border-border bg-background"
                }`}
                android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
              >
                <Text className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-3">
          {loading && all.length === 0 ? (
            <View className="items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
              <ActivityIndicator size="small" color="#0F172A" />
              <Text className="text-sm font-semibold text-foreground">Loading reports…</Text>
              <Text className="text-center text-[12px] text-muted-foreground">
                Fetching your submitted incidents from the server.
              </Text>
            </View>
          ) : error && all.length === 0 ? (
            <View className="items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
              <Text className="text-sm font-semibold text-destructive">Unable to load reports</Text>
              <Text className="text-center text-[12px] text-destructive/80">
                {error}
              </Text>
              <Button onPress={loadReports} size="sm" className="h-9 rounded-full px-4">
                <Text className="text-[12px] text-primary-foreground">Try again</Text>
              </Button>
            </View>
          ) : filtered.length === 0 ? (
            <View className="items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-ring/10">
                <Inbox size={28} color="#0F172A" />
              </View>
              <Text className="text-sm font-semibold text-foreground">No reports yet</Text>
              <Text className="text-center text-[12px] text-muted-foreground">
                When you submit a report, it will appear here.
              </Text>
            </View>
          ) : (
            filtered.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  if (r.kind === "incident") {
                    router.push({ pathname: "/incidents/view", params: { id: r.resourceId, role: "citizen" } });
                  } else {
                    router.push({
                      pathname: "/lost-found/view",
                      params: { id: r.resourceId, type: "lost", role: "citizen" },
                    });
                  }
                }}
                className="rounded-2xl border border-border bg-background px-4 py-4"
                android_ripple={{ color: "rgba(0,0,0,0.04)", borderless: false }}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                      {r.title}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-center gap-2">
                      <Text className={`text-xs font-medium ${statusTone(r.status)}`}>{r.status}</Text>
                      <Text className="text-xs text-muted-foreground">• {r.reportedAgo}</Text>
                    </View>
                    {r.meta ? (
                      <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                        {r.meta}
                      </Text>
                    ) : null}
                  </View>
                  {r.kind === "incident" ? (
                    <Pill
                      tone={priorityTone[(r.priority ?? "Normal") as Priority]}
                      label={`Priority: ${r.priority ?? "Normal"}`}
                      className="self-start"
                    />
                  ) : (
                    <Pill tone="accent" label="Lost item" className="self-start" />
                  )}
                </View>
                <View className="mt-3 flex-row justify-end">
                  <ChevronRight size={18} color="#94A3B8" />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </AppCard>

      <AppCard translucent className="items-center gap-3">
        <Text className="text-sm font-medium text-foreground">Need to report something new?</Text>
        <Text className="text-center text-xs text-muted-foreground">
          Start a fresh report whenever you notice an issue in your neighborhood.
        </Text>
        <Button
          onPress={() => router.push({ pathname: "/incidents", params: { role: "citizen" } })}
          className="h-12 rounded-2xl px-5"
        >
          <Text className="text-primary-foreground">Report a New Incident</Text>
        </Button>
      </AppCard>
    </AppScreen>
  );
}
