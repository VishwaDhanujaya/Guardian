// app/(app)/incidents/my-reports.tsx
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { ChevronRight, ClipboardList, Inbox } from "lucide-react-native";

/** Types */
type Priority = "Urgent" | "Normal" | "Low";
type Status = "New" | "In Review" | "Approved" | "Assigned" | "Ongoing" | "Resolved";

type Row = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  reportedAgo: string;
};

const statusTone = (s: Status) =>
  s === "Resolved" ? "text-muted-foreground"
  : s === "Ongoing" || s === "Assigned" || s === "Approved" ? "text-ring"
  : s === "In Review" ? "text-primary"
  : "text-foreground";

/** Screen */
export default function MyReports() {
  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: "citizen" } });
  }, [navigation]);

  // Mock user's reports
  const all = useMemo<Row[]>(
    () => [
      { id: "m1", title: "Traffic accident · Main St", status: "Ongoing",   priority: "Urgent", reportedAgo: "2h ago" },
      { id: "m2", title: "Vandalism · Park gate",      status: "In Review", priority: "Normal", reportedAgo: "Yesterday" },
      { id: "m3", title: "Streetlight outage",         status: "Resolved",  priority: "Low",    reportedAgo: "2d ago" },
    ],
    []
  );

  const [filter, setFilter] = useState<"All" | "Pending" | "Ongoing" | "Resolved">("All");
  const filtered = useMemo(() => {
    if (filter === "All") return all;
    if (filter === "Pending") return all.filter((r) => r.status === "New" || r.status === "In Review");
    if (filter === "Ongoing")
      return all.filter((r) => r.status === "Approved" || r.status === "Assigned" || r.status === "Ongoing");
    return all.filter((r) => r.status === "Resolved");
  }, [all, filter]);

  const priorityTone: Record<Priority, "danger" | "accent" | "primary"> = {
    Urgent: "danger",
    Normal: "accent",
    Low: "primary",
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
          trailing={<Pill label={`${filtered.length} shown`} tone="primary" />}
        />

        <View className="flex-row flex-wrap gap-2">
          {(["All", "Pending", "Ongoing", "Resolved"] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
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
          {filtered.length === 0 ? (
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
                onPress={() => router.push({ pathname: "/incidents/view", params: { id: r.id, role: "citizen" } })}
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
                  </View>
                  <Pill
                    tone={priorityTone[r.priority]}
                    label={`Priority: ${r.priority}`}
                    className="self-start"
                  />
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
