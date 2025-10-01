// app/(app)/incidents/manage-incidents.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import {
  addReportNote,
  fetchReports,
  Note,
  ReportSummary,
  updateReportStatus,
} from "@/lib/api";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Hammer,
  Inbox,
  Info as InfoIcon,
  MessageSquare,
} from "lucide-react-native";

type Role = "citizen" | "officer";
type Priority = "Urgent" | "Normal" | "Low";
type Status = "New" | "In Review" | "Approved" | "Assigned" | "Ongoing" | "Resolved";

type Row = {
  id: string;
  title: string;
  citizen: string;
  status: Status;
  suggestedPriority: Priority;
  reportedAgo: string;
  notes?: Note[];
  showUpdate?: boolean;
  showNotes?: boolean;
  newNoteDraft?: string;
  newNoteHeight?: number;
  statusDraft?: Status;
};

type TabKey = "pending" | "ongoing" | "solved";

const TAB_LABEL: Record<TabKey, string> = {
  pending: "Pending",
  ongoing: "Ongoing",
  solved: "Solved",
};

const priorityWeight: Record<Priority, number> = { Urgent: 3, Normal: 2, Low: 1 };
const statusWeight: Record<Status, number> = {
  "In Review": 5,
  Approved: 4,
  Assigned: 3,
  Ongoing: 2,
  Resolved: 1,
  New: 6,
};

function isTabKey(v: any): v is TabKey {
  return v === "pending" || v === "ongoing" || v === "solved";
}

export default function ManageIncidents() {
  const { role, tab: tabParam } = useLocalSearchParams<{ role?: string; tab?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";
  const isOfficer = resolvedRole === "officer";

  const layout = useResponsiveLayout();
  const isCompact = layout.width < 420;

  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: resolvedRole } });
  }, [navigation, resolvedRole]);

  const { value: mount } = useMountAnimation({ damping: 14, stiffness: 160, mass: 0.6 });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rowActions, setRowActions] = useState<Record<string, boolean>>({});
  const [noteActions, setNoteActions] = useState<Record<string, boolean>>({});

  const mapSummaryToRow = useCallback(
    (summary: ReportSummary): Row => ({
      id: summary.id,
      title: summary.title,
      citizen: summary.citizen,
      status: summary.status,
      suggestedPriority: summary.suggestedPriority,
      reportedAgo: summary.reportedAgo,
      notes: [],
    }),
    [],
  );

  const loadRows = useCallback(() => {
    setLoading(true);
    fetchReports()
      .then((list) => {
        setRows(list.map(mapSummaryToRow));
        setLoadError(false);
        setRowActions({});
        setNoteActions({});
      })
      .catch(() => {
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [mapSummaryToRow]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  useEffect(() => {
    if (isTabKey(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  const [priorityFilter, setPriorityFilter] = useState<"All" | Priority>("All");

  const tabBuckets = useMemo(() => {
    const pendingSet: Status[] = ["New", "In Review"];
    const ongoingSet: Status[] = ["Approved", "Assigned", "Ongoing"];
    const solvedSet: Status[] = ["Resolved"];

    const pending = rows.filter((r) => pendingSet.includes(r.status));
    const ongoing = rows.filter((r) => ongoingSet.includes(r.status));
    const solved = rows.filter((r) => solvedSet.includes(r.status));

    return { pending, ongoing, solved } as const;
  }, [rows]);

  const counts = {
    pending: tabBuckets.pending.length,
    ongoing: tabBuckets.ongoing.length,
    solved: tabBuckets.solved.length,
  } as const;

  const visibleRows = useMemo(() => {
    const base =
      activeTab === "pending"
        ? tabBuckets.pending
        : activeTab === "ongoing"
        ? tabBuckets.ongoing
        : tabBuckets.solved;

    const filtered = base.filter((r) =>
      priorityFilter === "All" ? true : r.suggestedPriority === priorityFilter,
    );

    return [...filtered].sort((a, b) => {
      const sw = statusWeight[b.status] - statusWeight[a.status];
      if (sw !== 0) return sw;
      const pw = priorityWeight[b.suggestedPriority] - priorityWeight[a.suggestedPriority];
      return pw;
    });
  }, [activeTab, tabBuckets, priorityFilter]);

  const prioPill = (p: Priority) =>
    p === "Urgent"
      ? { wrap: "bg-destructive/10 border-destructive/30", text: "text-destructive", Icon: AlertTriangle }
      : p === "Normal"
      ? { wrap: "bg-ring/10 border-ring/30", text: "text-ring", Icon: InfoIcon }
      : { wrap: "bg-primary/10 border-primary/30", text: "text-primary", Icon: CheckCircle2 };

  const statusTone = (s: Status) =>
    s === "Ongoing"
      ? "text-ring"
      : s === "Resolved"
      ? "text-muted-foreground"
      : s === "In Review"
      ? "text-primary"
      : "text-foreground";

  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-transparent bg-primary/10" : "border-border bg-background"
      }`}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      hitSlop={6}
    >
      <Text className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );

  const toggleUpdatePanel = (id: string) => {
    if (!isOfficer) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              showUpdate: !r.showUpdate,
              showNotes: false,
              statusDraft: r.showUpdate ? undefined : r.status,
            }
          : r,
      ),
    );
  };

  const toggleNotesPanel = (id: string) => {
    if (!isOfficer) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, showNotes: !r.showNotes, showUpdate: false, statusDraft: undefined }
          : r,
      ),
    );
  };

  const setRowAction = (id: string, active: boolean) => setRowActions((prev) => ({ ...prev, [id]: active }));
  const setNoteAction = (id: string, active: boolean) => setNoteActions((prev) => ({ ...prev, [id]: active }));
  const isRowBusy = (id: string) => rowActions[id] === true;
  const isNoteBusy = (id: string) => noteActions[id] === true;

  const applyRowStatus = async (id: string, next: Status, successMessage: string) => {
    if (!isOfficer) return;
    setRowAction(id, true);
    try {
      await updateReportStatus(id, next);
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next, showUpdate: false, statusDraft: undefined } : r)),
      );
      toast.success(successMessage);
    } catch (error) {
      toast.error("Failed to update report");
    } finally {
      setRowAction(id, false);
    }
  };

  const approveRow = (id: string) => applyRowStatus(id, "Approved", "Report approved");
  const rejectRow = (id: string) => applyRowStatus(id, "Resolved", "Report rejected");

  const setDraftNote = (id: string, text: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteDraft: text } : r)));

  const setNoteHeight = (id: string, height: number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteHeight: height } : r)));

  const addNote = (id: string) => {
    if (!isOfficer) return;
    const row = rows.find((r) => r.id === id);
    const text = (row?.newNoteDraft ?? "").trim();
    if (!row || !text || isNoteBusy(id)) {
      return;
    }
    setNoteAction(id, true);
    addReportNote(id, "Officer", text)
      .then((created) => {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  notes: [...(r.notes ?? []), created],
                  newNoteDraft: "",
                  newNoteHeight: undefined,
                  showNotes: true,
                }
              : r,
          ),
        );
        toast.success("Note added");
      })
      .catch(() => toast.error("Failed to add note"))
      .finally(() => setNoteAction(id, false));
  };

  const TabButton = ({
    tab,
    label,
    count,
    Icon,
  }: {
    tab: TabKey;
    label: string;
    count?: number;
    Icon: ComponentType<{ size?: number; color?: string }>;
  }) => {
    const active = activeTab === tab;
    return (
      <Pressable
        onPress={() => {
          setActiveTab(tab);
          router.setParams({ role: resolvedRole, tab });
        }}
        className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 ${
          active ? "bg-foreground" : "bg-transparent"
        }`}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={isCompact ? { minWidth: 140 } : undefined}
      >
        <Icon size={16} color={active ? "#FFFFFF" : "#0F172A"} />
        <Text className={`text-[13px] font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}>
          {label}
        </Text>
        {typeof count === "number" ? (
          <View
            className={`${
              active ? "bg-primary/30" : "bg-foreground/10"
            } rounded-full px-1.5 py-0.5`}
          >
            <Text className={`text-[11px] ${active ? "text-primary-foreground" : "text-foreground"}`}>{count}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <AppScreen
      scrollComponent={KeyboardAwareScrollView}
      scrollViewProps={{
        enableOnAndroid: true,
        enableAutomaticScroll: true,
        keyboardShouldPersistTaps: "handled",
        extraScrollHeight: 120,
        onScrollBeginDrag: Keyboard.dismiss,
      }}
      contentClassName="px-5 pb-8"
    >
      <ScreenHeader
        title={isOfficer ? "Manage incidents" : "Incident queue"}
        subtitle={
          isOfficer
            ? "Review citizen reports, update statuses, and share progress notes."
            : "Browse the queue of incidents and tap any card to see the latest details."
        }
        icon={ClipboardList}
        onBack={goBack}
        action={<Pill label={`${rows.length} total`} tone="neutral" />}
      />

      <Animated.View style={animStyle}>
        <AppCard className="gap-5 p-5">
          <SectionHeader
            title="Queues"
            description="Switch between queues and refine the list by priority."
            trailing={<Pill label={`${counts[activeTab]} in ${TAB_LABEL[activeTab]}`} tone="primary" />}
          />

          <View className={`flex-row gap-2 ${isCompact ? "flex-wrap" : "items-center"}`}>
            <TabButton tab="pending" label="Pending" count={counts.pending} Icon={BadgeCheck} />
            <TabButton tab="ongoing" label="Ongoing" count={counts.ongoing} Icon={Hammer} />
            <TabButton tab="solved" label="Solved" count={counts.solved} Icon={CheckCircle} />
          </View>

          <View>
            <Text className="mb-2 text-xs font-medium text-muted-foreground">Priority filter</Text>
            <View className="flex-row flex-wrap gap-2">
              {(["All", "Urgent", "Normal", "Low"] as const).map((p) => (
                <Chip key={p} label={p} active={priorityFilter === p} onPress={() => setPriorityFilter(p)} />
              ))}
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View style={animStyle}>
        <AppCard className="gap-4 p-5">
          <SectionHeader
            title={isOfficer ? "Reports" : "Reports overview"}
            description={
              isOfficer
                ? "Tap a report to open details, change status, or add a note for the citizen."
                : "Tap any report to follow its progress."
            }
          />

          {loading ? (
            <View className="items-center justify-center rounded-2xl border border-border bg-background/70 p-6">
              <ActivityIndicator color="#0F172A" />
              <Text className="mt-2 text-xs text-muted-foreground">Loading reports…</Text>
            </View>
          ) : loadError ? (
            <View className="items-center rounded-2xl border border-border bg-background/70 p-6">
              <Text className="font-semibold text-foreground">Failed to load reports</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">Please try again.</Text>
              <Button className="mt-3 h-9 rounded-lg px-4" onPress={loadRows}>
                <Text className="text-[12px] text-primary-foreground">Retry</Text>
              </Button>
            </View>
          ) : visibleRows.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-border bg-background/60 p-6">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-ring/10">
                <Inbox size={28} color="#0F172A" />
              </View>
              <Text className="mt-3 font-semibold text-foreground">Nothing here</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Try a different tab or adjust the priority filter.
              </Text>
            </View>
          ) : (
            visibleRows.map((r) => {
              const pill = prioPill(r.suggestedPriority);
              const PillIcon = pill.Icon;

              return (
                <Pressable
                  key={r.id}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                  onPress={() =>
                    router.push({
                      pathname: "/incidents/view",
                      params: { id: r.id, role: resolvedRole, tab: activeTab },
                    })
                  }
                  android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                >
                  {isCompact ? (
                    <View className="gap-3">
                      <View className="min-w-0 pr-1">
                        <Text className="text-base font-medium text-foreground" numberOfLines={2} ellipsizeMode="tail">
                          {r.title}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap items-center gap-2">
                          <Text className={`text-xs font-medium ${statusTone(r.status)}`}>{r.status}</Text>
                          {r.status === "In Review" ? (
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: "/incidents/view",
                                  params: { id: r.id, role: resolvedRole, tab: activeTab },
                                })
                              }
                              className="flex-row items-center"
                              hitSlop={6}
                            >
                              <Text className="text-xs text-primary"> · Read more</Text>
                              <ChevronRight size={12} color="#2563EB" />
                            </Pressable>
                          ) : null}
                          <Text className="text-xs text-muted-foreground">• {r.reportedAgo}</Text>
                          <Text className="text-xs text-muted-foreground">• By {r.citizen}</Text>
                        </View>
                      </View>

                      <View className={`self-start rounded-full border px-2 py-0.5 ${pill.wrap}`}>
                        <View className="flex-row items-center gap-1">
                          <PillIcon size={12} color="#0F172A" />
                          <Text className={`text-[11px] font-medium ${pill.text}`}>
                            Priority: {r.suggestedPriority}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row flex-wrap items-start justify-between gap-3">
                      <View className="min-w-0 flex-1 pr-1">
                        <Text className="text-base font-medium text-foreground" numberOfLines={2} ellipsizeMode="tail">
                          {r.title}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap items-center gap-2">
                          <Text className={`text-xs font-medium ${statusTone(r.status)}`}>{r.status}</Text>
                          {r.status === "In Review" ? (
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: "/incidents/view",
                                  params: { id: r.id, role: resolvedRole, tab: activeTab },
                                })
                              }
                              className="flex-row items-center"
                              hitSlop={6}
                            >
                              <Text className="text-xs text-primary"> · Read more</Text>
                              <ChevronRight size={12} color="#2563EB" />
                            </Pressable>
                          ) : null}
                          <Text className="text-xs text-muted-foreground">• {r.reportedAgo}</Text>
                          <Text className="text-xs text-muted-foreground">• By {r.citizen}</Text>
                        </View>
                      </View>

                      <View className={`self-start rounded-full border px-2 py-0.5 ${pill.wrap}`}>
                        <View className="flex-row items-center gap-1">
                          <PillIcon size={12} color="#0F172A" />
                          <Text className={`text-[11px] font-medium ${pill.text}`}>
                            Priority: {r.suggestedPriority}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {isOfficer ? (
                    <View className="mt-3 gap-3">
                      <View className="flex-row flex-wrap items-center gap-2">
                        {activeTab === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant={
                                activeTab === "pending" && (r.status === "New" || r.status === "In Review")
                                  ? "default"
                                  : "secondary"
                              }
                              disabled={! (r.status === "New" || r.status === "In Review") || isRowBusy(r.id)}
                              className="h-9 rounded-lg px-3"
                              onPress={() => approveRow(r.id)}
                            >
                              <View className="flex-row items-center gap-1">
                                <BadgeCheck
                                  size={14}
                                  color={
                                    activeTab === "pending" && (r.status === "New" || r.status === "In Review")
                                      ? "#FFFFFF"
                                      : "#0F172A"
                                  }
                                />
                                <Text
                                  className={`text-[12px] ${
                                    activeTab === "pending" && (r.status === "New" || r.status === "In Review")
                                      ? "text-primary-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {isRowBusy(r.id) ? "Working…" : "Approve"}
                                </Text>
                              </View>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isRowBusy(r.id)}
                              className="h-9 rounded-lg px-3"
                              onPress={() => rejectRow(r.id)}
                            >
                              <View className="flex-row items-center gap-1">
                                <AlertTriangle size={14} color="#DC2626" />
                                <Text className="text-[12px]" style={{ color: "#DC2626" }}>
                                  {isRowBusy(r.id) ? "Working…" : "Reject"}
                                </Text>
                              </View>
                            </Button>
                          </>
                        ) : null}

                        <Button
                          size="sm"
                          variant="secondary"
                          className="ml-auto h-9 rounded-lg px-3"
                          onPress={() => toggleUpdatePanel(r.id)}
                        >
                          <View className="flex-row items-center gap-1">
                            <ClipboardList size={14} color="#0F172A" />
                            <Text className="text-[12px] text-foreground">
                              {r.showUpdate ? "Close" : "Update status"}
                            </Text>
                          </View>
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 rounded-lg px-3"
                          onPress={() => toggleNotesPanel(r.id)}
                        >
                          <View className="flex-row items-center gap-1">
                            <MessageSquare size={14} color="#0F172A" />
                            <Text className="text-[12px] text-foreground">
                              {r.showNotes ? "Hide notes" : "Notes"}
                            </Text>
                          </View>
                        </Button>
                      </View>

                      {r.showUpdate ? (
                        <View className="rounded-xl border border-border bg-muted px-4 py-3">
                          <Text className="text-[12px] text-foreground">Update status</Text>
                          <View className="mt-2 flex-row flex-wrap gap-2">
                            {(["Approved", "Assigned", "Ongoing", "Resolved"] as const).map((opt) => {
                              const active = (r.statusDraft ?? r.status) === opt;
                              return (
                                <Pressable
                                  key={opt}
                                  onPress={() =>
                                    setRows((prev) =>
                                      prev.map((x) =>
                                        x.id === r.id ? { ...x, statusDraft: opt } : x,
                                      ),
                                    )
                                  }
                                  className={`rounded-full border px-3 py-1 ${
                                    active ? "border-transparent bg-foreground/10" : "border-border bg-background"
                                  }`}
                                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                                >
                                  <Text className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>
                                    {opt}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View className="mt-3 flex-row flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 rounded-lg px-3"
                              onPress={() => toggleUpdatePanel(r.id)}
                            >
                              <Text className="text-[12px] text-foreground">Cancel</Text>
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 rounded-lg px-3"
                              disabled={isRowBusy(r.id)}
                              onPress={() => {
                                const target = r.statusDraft ?? r.status;
                                applyRowStatus(r.id, target, "Status updated");
                              }}
                            >
                              <Text className="text-[12px] text-primary-foreground">
                                {isRowBusy(r.id) ? "Saving…" : "Save"}
                              </Text>
                            </Button>
                          </View>
                        </View>
                      ) : null}

                      {r.showNotes ? (
                        <View className="overflow-hidden rounded-xl border border-border bg-muted">
                          <View className="border-b border-border px-4 py-3">
                            <View className="flex-row items-center gap-2">
                              <InfoIcon size={14} color="#0F172A" />
                              <Text className="text-[12px] text-foreground">Notes (visible to the citizen)</Text>
                            </View>
                          </View>

                          <View className="px-4 pb-2 pt-3">
                            {(r.notes ?? []).length > 0 ? (
                              (r.notes ?? []).slice().reverse().map((n) => (
                                <View key={n.id} className="mb-2 rounded-lg border border-border bg-background px-3 py-2">
                                  <Text className="text-[12px] text-foreground">{n.text}</Text>
                                  <Text className="mt-1 text-[10px] text-muted-foreground">{n.by} · {n.at}</Text>
                                </View>
                              ))
                            ) : (
                              <View className="rounded-lg border border-border bg-background px-3 py-2">
                                <Text className="text-[12px] text-muted-foreground">No notes yet.</Text>
                              </View>
                            )}
                          </View>

                          <View className="px-4 pb-3">
                            <Input
                              value={r.newNoteDraft ?? ""}
                              onChangeText={(t) => setDraftNote(r.id, t)}
                              onContentSizeChange={(e) => setNoteHeight(r.id, e.nativeEvent.contentSize.height)}
                              placeholder="Add a note for the citizen…"
                              className="rounded-xl bg-background"
                              style={{
                                minHeight: 96,
                                height: Math.max(96, r.newNoteHeight ?? 0),
                                textAlignVertical: "top",
                                paddingTop: 12,
                              }}
                              multiline
                              numberOfLines={4}
                              scrollEnabled={false}
                            />
                          </View>

                          <View className="border-t border-border bg-muted px-4 py-3">
                            <View className="flex-row flex-wrap items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-9 min-w-[96px] rounded-lg px-3"
                                onPress={() => toggleNotesPanel(r.id)}
                              >
                                <Text className="text-[12px] text-foreground">Close</Text>
                              </Button>
                              <Button
                                size="sm"
                                className="h-9 min-w-[96px] rounded-lg px-3"
                                onPress={() => addNote(r.id)}
                                disabled={isNoteBusy(r.id) || !(r.newNoteDraft ?? "").trim()}
                              >
                                <Text className="text-[12px] text-primary-foreground">
                                  {isNoteBusy(r.id) ? "Saving…" : "Add note"}
                                </Text>
                              </Button>
                            </View>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}
