import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Animated, Keyboard, Pressable, View, useWindowDimensions } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";

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

type Note = { id: string; text: string; at: string; by: string };

type Row = {
  id: string;
  title: string;
  citizen: string;
  status: StatusLost;
  suggestedPriority: Priority;
  reportedAgo: string;
  notes?: Note[];
  showUpdate?: boolean;
  showNotes?: boolean;
  newNoteDraft?: string;
  newNoteHeight?: number;
  statusDraft?: StatusLost;
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

const isTabKey = (v: any): v is TabKey => v === "pending" || v === "searching" || v === "returned";

export default function OfficerLost() {
  const { role, tab: tabParam } = useLocalSearchParams<{ role?: string; tab?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";

  const { width } = useWindowDimensions();
  const isCompact = width < 360;

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

  const [rows, setRows] = useState<Row[]>([
    { id: "l1", title: "Lost: Wallet · Brown leather", citizen: "Alex J.", status: "In Review", suggestedPriority: "Normal", reportedAgo: "12m ago", notes: [] },
    { id: "l2", title: "Lost: Phone · Samsung black", citizen: "Priya K.", status: "Approved", suggestedPriority: "Urgent", reportedAgo: "2h ago", notes: [] },
    { id: "l3", title: "Lost: Backpack · Blue", citizen: "Omar R.", status: "Searching", suggestedPriority: "Normal", reportedAgo: "4h ago", notes: [] },
    { id: "l4", title: "Lost: Watch · Silver", citizen: "Jin L.", status: "Returned", suggestedPriority: "Low", reportedAgo: "1d ago", notes: [] },
    { id: "l5", title: "Lost: ID Card", citizen: "Sara D.", status: "New", suggestedPriority: "Low", reportedAgo: "9m ago", notes: [] },
  ]);

  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  useEffect(() => {
    if (isTabKey(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

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

  const toggleUpdatePanel = (id: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, showUpdate: !r.showUpdate, showNotes: false, statusDraft: r.showUpdate ? undefined : r.status }
          : r,
      ),
    );

  const toggleNotesPanel = (id: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, showNotes: !r.showNotes, showUpdate: false }
          : r,
      ),
    );

  const approveRow = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Approved", showUpdate: false, statusDraft: undefined } : r)),
    );

  const rejectRow = (id: string) =>
    setRows((prev) => {
      toast.success("Lost report rejected");
      return prev.filter((r) => r.id !== id);
    });

  const setDraftNote = (id: string, text: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteDraft: text } : r)));

  const setNoteHeight = (id: string, height: number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, newNoteHeight: height } : r)));

  const addNote = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const text = (r.newNoteDraft ?? "").trim();
        if (!text) return r;
        const nextNote: Note = {
          id: `note_${Date.now()}`,
          text,
          at: new Date().toLocaleString(),
          by: "Officer",
        };
        const next: Row = {
          ...r,
          notes: [...(r.notes ?? []), nextNote],
          newNoteDraft: "",
          newNoteHeight: undefined,
          showNotes: true,
        };
        toast.success("Note added");
        return next;
      }),
    );
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

          {visibleRows.length === 0 ? (
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
                            disabled={!(r.status === "New" || r.status === "In Review")}
                            className="h-9 rounded-lg px-3"
                            onPress={() => approveRow(r.id)}
                          >
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
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 rounded-lg px-3"
                            onPress={() => rejectRow(r.id)}
                          >
                            <View className="flex-row items-center gap-1">
                              <AlertTriangle size={14} color="#DC2626" />
                              <Text className="text-[12px]" style={{ color: "#DC2626" }}>
                                Reject
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
                            onPress={() => {
                              const target = r.statusDraft ?? r.status;
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.id === r.id
                                    ? { ...x, status: target, statusDraft: undefined, showUpdate: false }
                                    : x,
                                ),
                              );
                              toast.success("Status updated");
                            }}
                          >
                            <Text className="text-[12px] text-primary-foreground">Save</Text>
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
                              disabled={!(r.newNoteDraft ?? "").trim()}
                            >
                              <Text className="text-[12px] text-primary-foreground">Add note</Text>
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
