import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  RefreshControl,
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
  addLostItemNote,
  fetchLostItemNotes,
  fetchLostItems,
  ItemNote,
  LostFrontendStatus,
  LostItemDetail,
  updateLostItemStatus,
} from "@/lib/api";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Info as InfoIcon,
  MessageSquare,
  PackageSearch,
  Search,
} from "lucide-react-native";

type Role = "citizen" | "officer";
type Priority = "Urgent" | "Normal" | "Low";
type StatusLost = "New" | "In Review" | "Approved" | "Assigned" | "Searching" | "Returned";

type Row = {
  id: string;
  title: string;
  citizen: string;
  status: StatusLost;
  suggestedPriority: Priority;
  reportedAgo: string;
  notes?: ItemNote[];
  showUpdate?: boolean;
  showNotes?: boolean;
  newNoteDraft?: string;
  newNoteHeight?: number;
  statusDraft?: StatusLost;
  notesLoaded?: boolean;
  notesLoading?: boolean;
  statusUpdating?: boolean;
  noteSubmitting?: boolean;
};

type TabKey = "pending" | "searching" | "returned";
const TAB_LABEL: Record<TabKey, string> = {
  pending: "Pending",
  searching: "Searching",
  returned: "Returned",
};

const priorityWeight: Record<Priority, number> = { Urgent: 3, Normal: 2, Low: 1 };
const statusWeight: Record<StatusLost, number> = {
  "In Review": 6,
  New: 5,
  Approved: 4,
  Assigned: 3,
  Searching: 2,
  Returned: 1,
};

const statusPriorityMap: Record<StatusLost, Priority> = {
  New: "Urgent",
  "In Review": "Urgent",
  Approved: "Normal",
  Assigned: "Normal",
  Searching: "Normal",
  Returned: "Low",
};

const formatRelativeTime = (input?: string | null): string => {
  if (!input) return "Just now";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return parsed.toLocaleDateString();
};

const toStatusLost = (status?: LostFrontendStatus): StatusLost =>
  (status as StatusLost) ?? "New";

const buildRow = (item: LostItemDetail, previous?: Row): Row => {
  const status = toStatusLost(item.status);
  const titleParts = [`Lost: ${item.name || "Item"}`];
  if (item.color) {
    titleParts[0] += ` · ${item.color}`;
  }
  return {
    id: item.id,
    title: titleParts[0],
    citizen: item.reportedBy ?? `Citizen #${item.id}`,
    status,
    suggestedPriority: statusPriorityMap[status] ?? "Normal",
    reportedAgo: formatRelativeTime(item.createdAt),
    notes: previous?.notes ?? [],
    showUpdate: false,
    showNotes: previous?.showNotes ?? false,
    newNoteDraft: previous?.newNoteDraft ?? "",
    newNoteHeight: previous?.newNoteHeight,
    statusDraft: undefined,
    notesLoaded: previous?.notesLoaded ?? (previous?.notes?.length ?? 0) > 0,
    notesLoading: false,
    statusUpdating: false,
    noteSubmitting: false,
  };
};

const isTabKey = (v: any): v is TabKey => v === "pending" || v === "searching" || v === "returned";

export default function OfficerLost() {
  const { role, tab: tabParam } = useLocalSearchParams<{ role?: string; tab?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";

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
  const [refreshing, setRefreshing] = useState(false);

  const loadRows = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      mode === "initial" ? setLoading(true) : setRefreshing(true);
      try {
        const items = await fetchLostItems();
        setRows((previous) => {
          const previousMap = new Map(previous.map((row) => [row.id, row]));
          return items.map((item) => buildRow(item, previousMap.get(item.id)));
        });
      } catch (error) {
        console.error(error);
        toast.error("Failed to load lost items");
      } finally {
        mode === "initial" ? setLoading(false) : setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadRows("initial");
  }, [loadRows]);

  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  useEffect(() => {
    if (isTabKey(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  const onRefresh = useCallback(() => {
    loadRows("refresh");
  }, [loadRows]);

  const tabBuckets = useMemo(() => {
    const pendingSet: StatusLost[] = ["New", "In Review"];
    const searchingSet: StatusLost[] = ["Approved", "Assigned", "Searching"];
    const returnedSet: StatusLost[] = ["Returned"];

    const pending = rows.filter((r) => pendingSet.includes(r.status));
    const searching = rows.filter((r) => searchingSet.includes(r.status));
    const returned = rows.filter((r) => returnedSet.includes(r.status));

    return { pending, searching, returned } as const;
  }, [rows]);

  const counts = {
    pending: tabBuckets.pending.length,
    searching: tabBuckets.searching.length,
    returned: tabBuckets.returned.length,
  } as const;

  const visibleRows = useMemo(() => {
    const base =
      activeTab === "pending"
        ? tabBuckets.pending
        : activeTab === "searching"
        ? tabBuckets.searching
        : tabBuckets.returned;

    return [...base].sort((a, b) => {
      const sw = statusWeight[b.status] - statusWeight[a.status];
      if (sw !== 0) return sw;
      const pw = priorityWeight[b.suggestedPriority] - priorityWeight[a.suggestedPriority];
      return pw;
    });
  }, [activeTab, tabBuckets]);

  const prioPill = (p: Priority) =>
    p === "Urgent"
      ? { wrap: "bg-destructive/10 border-destructive/30", text: "text-destructive", Icon: AlertTriangle }
      : p === "Normal"
      ? { wrap: "bg-ring/10 border-ring/30", text: "text-ring", Icon: Search }
      : { wrap: "bg-primary/10 border-primary/30", text: "text-primary", Icon: CheckCircle2 };

  const statusTone = (s: StatusLost) =>
    s === "Searching"
      ? "text-ring"
      : s === "Returned"
      ? "text-muted-foreground"
      : s === "In Review"
      ? "text-primary"
      : "text-foreground";

  const toggleUpdatePanel = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || r.statusUpdating) return r;
        const nextShow = !r.showUpdate;
        return {
          ...r,
          showUpdate: nextShow,
          showNotes: nextShow ? false : r.showNotes,
          statusDraft: nextShow ? r.status : undefined,
        };
      }),
    );
  }, []);

  const loadNotes = useCallback(
    async (id: string) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, notesLoading: true, showNotes: true, showUpdate: false }
            : r,
        ),
      );
      try {
        const loaded = await fetchLostItemNotes(id);
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  notes: loaded,
                  notesLoaded: true,
                  notesLoading: false,
                  showNotes: true,
                  showUpdate: false,
                }
              : r,
          ),
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to load notes");
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, notesLoading: false, showNotes: false }
              : r,
          ),
        );
      }
    },
    [],
  );

  const toggleNotesPanel = useCallback(
    (id: string) => {
      setRows((prev) => {
        const target = prev.find((r) => r.id === id);
        if (!target) return prev;
        if (target.showNotes) {
          return prev.map((r) =>
            r.id === id ? { ...r, showNotes: false } : r,
          );
        }
        if (target.notesLoaded) {
          return prev.map((r) =>
            r.id === id ? { ...r, showNotes: true, showUpdate: false } : r,
          );
        }
        loadNotes(id);
        return prev.map((r) =>
          r.id === id
            ? { ...r, notesLoading: true, showNotes: true, showUpdate: false }
            : r,
        );
      });
    },
    [loadNotes],
  );

  const applyStatusChange = useCallback(
    async (id: string, next: StatusLost, successMessage: string) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, statusUpdating: true } : r)),
      );
      try {
        const updated = await updateLostItemStatus(id, next as LostFrontendStatus);
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            const merged = buildRow(updated, r);
            return {
              ...merged,
              notes: r.notes,
              notesLoaded: r.notesLoaded,
              notesLoading: r.notesLoading,
              showNotes: r.showNotes,
              newNoteDraft: r.newNoteDraft,
              newNoteHeight: r.newNoteHeight,
              noteSubmitting: r.noteSubmitting,
              statusDraft: undefined,
            };
          }),
        );
        toast.success(successMessage);
      } catch (error) {
        console.error(error);
        toast.error("Failed to update status");
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, statusUpdating: false } : r,
          ),
        );
      }
    },
    [],
  );

  const approveRow = (id: string) => applyStatusChange(id, "Approved", "Lost report approved");

  const rejectRow = (id: string) => applyStatusChange(id, "Returned", "Lost report closed");

  const setDraftNote = (id: string, text: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteDraft: text } : r)));

  const setNoteHeight = (id: string, height: number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteHeight: height } : r)));

  const addNote = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const text = (row.newNoteDraft ?? "").trim();
    if (!text || row.noteSubmitting) return;

    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, noteSubmitting: true } : r)),
    );

    addLostItemNote(id, "Officer", text)
      .then((created) => {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  notes: [...(r.notes ?? []), created],
                  notesLoaded: true,
                  noteSubmitting: false,
                  newNoteDraft: "",
                  newNoteHeight: undefined,
                  showNotes: true,
                }
              : r,
          ),
        );
        toast.success("Note added");
      })
      .catch((error) => {
        console.error(error);
        toast.error("Failed to add note");
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, noteSubmitting: false } : r,
          ),
        );
      });
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
          router.setParams({ role: "officer", tab });
        }}
        className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 ${
          active ? "bg-foreground" : "bg-transparent"
        }`}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        <Icon size={16} color={active ? "#FFFFFF" : "#0F172A"} />
        <Text className={`text-[13px] font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}>
          {label}
        </Text>
        {typeof count === "number" ? (
          <View className={`${active ? "bg-primary/30" : "bg-foreground/10"} rounded-full px-1.5 py-0.5`}>
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
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ),
        onScrollBeginDrag: Keyboard.dismiss,
      }}
      contentClassName="px-5 pb-8"
    >
      <ScreenHeader
        title="Lost item reports"
        subtitle="Prioritise citizen-submitted lost item cases and keep them updated."
        icon={PackageSearch}
        onBack={goBack}
        action={<Pill label={`${rows.length} total`} tone="neutral" />}
      />

      <Animated.View style={animStyle}>
        <AppCard className="gap-5 p-5">
          <SectionHeader
            title="Queues"
            description="Track cases by progress stage and prioritise urgent follow-up."
            trailing={<Pill label={`${counts[activeTab]} in ${TAB_LABEL[activeTab]}`} tone="primary" />}
          />

          <View className="flex-row items-center gap-2">
            <TabButton tab="pending" label="Pending" count={counts.pending} Icon={ClipboardList} />
            <TabButton tab="searching" label="Searching" count={counts.searching} Icon={Search} />
            <TabButton tab="returned" label="Returned" count={counts.returned} Icon={CheckCircle} />
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View style={animStyle}>
        <AppCard className="gap-4 p-5">
          <SectionHeader
            title="Cases"
            description="Tap a card to open full details and contact the citizen if needed."
            trailing={<Pill label={`${visibleRows.length} shown`} tone="primary" />}
          />

          {loading ? (
            <View className="items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-6">
              <ActivityIndicator color="#0F172A" />
              <Text className="text-xs text-muted-foreground">Loading cases…</Text>
            </View>
          ) : visibleRows.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-border bg-background/60 p-6">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-ring/10">
                <Inbox size={28} color="#0F172A" />
              </View>
              <Text className="mt-3 font-semibold text-foreground">No cases in this queue</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Switch tabs to review other stages or await new reports.
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
                      pathname: "/lost-found/view",
                      params: { id: r.id, type: "lost", role: "officer", tab: activeTab },
                    })
                  }
                  android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                >
                  {isCompact ? (
                    <View className="gap-3">
                      <View className="min-w-0 pr-1">
                        <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                          {r.title}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap items-center gap-2">
                          <Text className={`text-xs font-medium ${statusTone(r.status)}`}>{r.status}</Text>
                          <Text className="text-xs text-muted-foreground">• {r.reportedAgo}</Text>
                          <Text className="text-xs text-muted-foreground">• {r.citizen}</Text>
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
                        <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                          {r.title}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap items-center gap-2">
                          <Text className={`text-xs font-medium ${statusTone(r.status)}`}>{r.status}</Text>
                          <Text className="text-xs text-muted-foreground">• {r.reportedAgo}</Text>
                          <Text className="text-xs text-muted-foreground">• {r.citizen}</Text>
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

                  <View className="mt-3 gap-3">
                    <View className="flex-row flex-wrap items-center gap-2">
                      {activeTab === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant={r.status === "New" || r.status === "In Review" ? "default" : "secondary"}
                            disabled={
                              !(r.status === "New" || r.status === "In Review") ||
                              r.statusUpdating
                            }
                            className="h-9 rounded-lg px-3"
                            onPress={() => approveRow(r.id)}
                          >
                            {r.statusUpdating ? (
                              <ActivityIndicator
                                color={r.status === "New" || r.status === "In Review" ? "#FFFFFF" : "#0F172A"}
                                size="small"
                              />
                            ) : (
                              <View className="flex-row items-center gap-1">
                                <BadgeCheck
                                  size={14}
                                  color={r.status === "New" || r.status === "In Review" ? "#FFFFFF" : "#0F172A"}
                                />
                                <Text
                                  className={`text-[12px] ${
                                    r.status === "New" || r.status === "In Review"
                                      ? "text-primary-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  Approve
                                </Text>
                              </View>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 rounded-lg px-3"
                            onPress={() => rejectRow(r.id)}
                            disabled={r.statusUpdating}
                          >
                            {r.statusUpdating ? (
                              <ActivityIndicator color="#DC2626" size="small" />
                            ) : (
                              <View className="flex-row items-center gap-1">
                                <AlertTriangle size={14} color="#DC2626" />
                                <Text className="text-[12px]" style={{ color: "#DC2626" }}>
                                  Reject
                                </Text>
                              </View>
                            )}
                          </Button>
                        </>
                      ) : null}

                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto h-9 rounded-lg px-3"
                        onPress={() => toggleUpdatePanel(r.id)}
                        disabled={r.statusUpdating}
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
                        disabled={r.notesLoading || r.noteSubmitting}
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
                          {(["Approved", "Assigned", "Searching", "Returned"] as const).map((opt) => {
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
                                disabled={r.statusUpdating}
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
                            disabled={r.statusUpdating}
                          >
                            <Text className="text-[12px] text-foreground">Cancel</Text>
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 rounded-lg px-3"
                            onPress={() => {
                              const target = r.statusDraft ?? r.status;
                              if (target === r.status) {
                                toggleUpdatePanel(r.id);
                                return;
                              }
                              applyStatusChange(r.id, target, "Status updated");
                            }}
                            disabled={
                              r.statusUpdating || (r.statusDraft ?? r.status) === r.status
                            }
                          >
                            {r.statusUpdating ? (
                              <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                              <Text className="text-[12px] text-primary-foreground">Save</Text>
                            )}
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
                          {r.notesLoading ? (
                            <View className="items-center justify-center py-4">
                              <ActivityIndicator color="#0F172A" size="small" />
                            </View>
                          ) : (r.notes ?? []).length > 0 ? (
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
                            editable={!r.noteSubmitting}
                          />
                        </View>

                        <View className="border-t border-border bg-muted px-4 py-3">
                          <View className="flex-row flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 min-w-[96px] rounded-lg px-3"
                              onPress={() => toggleNotesPanel(r.id)}
                              disabled={r.noteSubmitting}
                            >
                              <Text className="text-[12px] text-foreground">Close</Text>
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 min-w-[96px] rounded-lg px-3"
                              onPress={() => addNote(r.id)}
                              disabled={
                                r.noteSubmitting || !(r.newNoteDraft ?? "").trim()
                              }
                            >
                              {r.noteSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                              ) : (
                                <Text className="text-[12px] text-primary-foreground">Add note</Text>
                              )}
                            </Button>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}
