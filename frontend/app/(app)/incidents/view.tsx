// app/(app)/incidents/view.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  createElement,
} from "react";
import { ActivityIndicator, Animated, Keyboard, Linking, Pressable, ScrollView, Switch, useColorScheme, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Image } from "expo-image";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import {
  addReportNote,
  getIncident,
  Note,
  Report,
  updateReportStatus,
} from "@/lib/api";
import { buildStaticMapPreviewUrl, getMapboxAccessToken } from "@/lib/mapbox";

import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Info,
  MapPin,
  MessageSquare,
  PackageSearch,
  Phone,
  ShieldAlert,
  ShieldOff,
  Users,
  Car,
} from "lucide-react-native";

type Role = "citizen" | "officer";
type Priority = "Urgent" | "Normal" | "Low";
type Status = "New" | "In Review" | "Approved" | "Assigned" | "Ongoing" | "Resolved";
type Section = "pending" | "ongoing" | "solved";

function getMockReport(id: string): Report {
  return {
    id,
    title: "Traffic accident · Main St",
    category: "Safety",
    location: "Main St & 3rd Ave",
    reportedBy: "Alex Johnson",
    reportedAt: "Today · 3:10 PM",
    status: "In Review",
    priority: "Urgent",
    description:
      "Two vehicles collided at the intersection. No visible fire. One lane blocked. Requesting traffic control.",
    notes: [{ id: "n1", text: "Report received. Reviewing details.", at: "3:12 PM", by: "System" }],
    witnesses: [],
    rawStatus: "PENDING",
    images: [],
  };
}

export default function ViewIncident() {
  const { id, role: roleParam, tab: tabParam } = useLocalSearchParams<{ id?: string; role?: string; tab?: string }>();
  const role: Role = roleParam === "officer" ? "officer" : "citizen";

  const isSection = (v: any): v is Section => v === "pending" || v === "ongoing" || v === "solved";
  const backTab: Section | undefined = isSection(tabParam) ? (tabParam as Section) : undefined;

  // Entrance animation
  const { value: mount } = useMountAnimation({ damping: 14, stiffness: 160, mass: 0.6 });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  // Mock report for offline retry option
  const mockReport = useMemo(() => (id ? getMockReport(id) : null), [id]);

  // Load report
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<Status>("New");
  const [statusDraft, setStatusDraft] = useState<Status | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const [mapPreviewError, setMapPreviewError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoadError(false);
    setReport(null);
    getIncident(id)
      .then((data) => {
        setReport(data);
        setStatus(data.status);
        setStatusDraft(null);
        setPriority(data.priority);
        setNotes(data.notes ?? []);
      })
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    if (!report || typeof report.latitude !== "number" || typeof report.longitude !== "number") {
      setMapPreviewUrl(null);
      setMapPreviewError(null);
      setMapPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const lat = report.latitude;
    const lon = report.longitude;

    setMapPreviewLoading(true);
    setMapPreviewError(null);

    getMapboxAccessToken()
      .then((token) => {
        if (cancelled) return;
        const url = buildStaticMapPreviewUrl(lat, lon, token, {
          width: 720,
          height: 400,
          theme: colorScheme === "dark" ? "dark" : "light",
        });
        setMapPreviewUrl(url);
      })
      .catch((error: any) => {
        console.error(error);
        if (cancelled) return;
        setMapPreviewUrl(null);
        setMapPreviewError("Unable to load map preview");
      })
      .finally(() => {
        if (!cancelled) {
          setMapPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [report, colorScheme]);

  const [showUpdate, setShowUpdate] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [newNoteDraft, setNewNoteDraft] = useState("");
  const [newNoteHeight, setNewNoteHeight] = useState<number | undefined>(undefined);
  const [notifyCitizen, setNotifyCitizen] = useState(true);

  const openAttachment = useCallback((url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => toast.error("Unable to open attachment"));
  }, []);

  // SECTION logic:
  // - Officers: honor the tab they came from (Pending / Ongoing / Solved), regardless of current status.
  // - Citizens: infer from current status.
  const section: Section = useMemo<Section>(() => {
    if (role === "officer" && backTab) return backTab;
    if (status === "Resolved") return "solved";
    if (status === "New" || status === "In Review") return "pending";
    return "ongoing"; // Approved, Assigned, Ongoing
  }, [role, backTab, status]);

  // Officer permissions strictly by tab (per product requirement)
  const canApproveReject = role === "officer" && section === "pending";
  const canUpdateStatus = role === "officer" && section === "ongoing";
  const canAddNotes = role === "officer" && (section === "ongoing" || section === "solved");

  // Navigation
  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      if (role === "officer") {
        router.replace({ pathname: "/incidents/manage-incidents", params: { role, tab: backTab ?? section } });
      } else {
        router.replace({ pathname: "/incidents/my-reports", params: { role } });
      }
    }
  }, [navigation, role, backTab, section]);

  // Actions
  const applyStatus = async (next: Status): Promise<boolean> => {
    if (!id || statusLoading) {
      return false;
    }
    setStatusLoading(true);
    try {
      await updateReportStatus(id, next);
      setStatus(next);
      return true;
    } catch (error) {
      toast.error("Failed to update status");
      return false;
    } finally {
      setStatusLoading(false);
    }
  };

  const onApprove = async () => {
    if (!canApproveReject) return;
    const ok = await applyStatus("Approved");
    if (ok) {
      setShowUpdate(false);
      toast.success("Report approved");
    }
  };

  const onReject = async () => {
    if (!canApproveReject) return;
    const ok = await applyStatus("Resolved");
    if (ok) {
      setShowUpdate(false);
      toast.success("Report rejected");
    }
  };

  const addNote = async () => {
    if (!canAddNotes || !id || noteSaving) return;
    const text = newNoteDraft.trim();
    if (!text) return;
    try {
      setNoteSaving(true);
      const created = await addReportNote(
        id,
        role === "officer" ? "Officer" : "Citizen",
        text,
      );
      setNotes((arr) => [...arr, created]);
      setNewNoteDraft("");
      setNewNoteHeight(undefined);
      setShowNotes(false);
      toast.success(
        notifyCitizen && role === "officer"
          ? "Note added and citizen notified"
          : "Note added",
      );
    } catch (error) {
      toast.error("Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  // Icons & tones
  const prioPill = (p: Priority) =>
    p === "Urgent"
      ? { wrap: "bg-destructive/10 border-destructive/30", text: "text-destructive", Icon: AlertTriangle }
      : p === "Normal"
      ? { wrap: "bg-ring/10 border-ring/30", text: "text-ring", Icon: Info }
      : { wrap: "bg-primary/10 border-primary/30", text: "text-primary", Icon: CheckCircle2 };

  const statusTone =
    status === "Ongoing"
      ? "text-ring"
      : status === "Resolved"
      ? "text-muted-foreground"
      : status === "In Review"
      ? "text-primary"
      : "text-foreground";

  if (loadError && !report) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <Text className="text-foreground mb-4">Failed to load report.</Text>
        <View className="flex-row items-center gap-2">
          <Button onPress={load} className="h-10 px-3 rounded-lg">
            <Text className="text-primary-foreground">Retry</Text>
          </Button>
          {mockReport ? (
            <Button
              variant="secondary"
              onPress={() => {
                setReport(mockReport);
                setStatus(mockReport.status);
                setPriority(mockReport.priority);
                setNotes(mockReport.notes);
                setLoadError(false);
              }}
              className="h-10 px-3 rounded-lg"
            >
              <Text className="text-foreground">Use mock</Text>
            </Button>
          ) : null}
          <Button variant="secondary" onPress={goBack} className="h-10 px-3 rounded-lg">
            <Text className="text-foreground">Back</Text>
          </Button>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator color="#0F172A" />
      </View>
    );
  }

  const categoryLabel = report.category?.trim?.() ? report.category : "Incident";
  const categoryKey = categoryLabel.toLowerCase();
  const catIcon = (() => {
    if (categoryKey.includes("theft") || categoryKey.includes("steal")) {
      return ShieldOff;
    }
    if (categoryKey.includes("hazard") || categoryKey.includes("danger")) {
      return AlertTriangle;
    }
    if (categoryKey.includes("accident") || categoryKey.includes("crash") || categoryKey.includes("collision")) {
      return Car;
    }
    if (categoryKey.includes("maint") || categoryKey.includes("repair")) {
      return PackageSearch;
    }
    if (categoryKey.includes("crime")) {
      return AlertTriangle;
    }
    return ShieldAlert;
  })();

  const PillIcon = prioPill(priority).Icon;

  const formatPhoneDisplay = (value: string) =>
    /^0\d{9}$/.test(value) ? value.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : value || "Not provided";

  const formatDobDisplay = (value: string) => {
    if (!value) return "Not provided";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const witnesses = report.witnesses ?? [];
  const attachments = Array.isArray(report.images)
    ? report.images.filter((url) => typeof url === "string" && url.trim().length > 0)
    : [];

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={120}
      onScrollBeginDrag={Keyboard.dismiss}
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: "#FFFFFF" }}
    >
      <View className="flex-1 p-5">
        <View className="pt-10 pb-6">
          {/* Top bar */}
          <View className="flex-row items-center justify-between mb-4">
            <Pressable onPress={goBack} className="flex-row items-center gap-1 px-2 py-1 -ml-2" hitSlop={8}>
              <ChevronLeft size={18} color="#0F172A" />
              <Text className="text-foreground">Back</Text>
            </Pressable>

            <View className="flex-row items-center gap-2">
              <ClipboardList size={18} color="#0F172A" />
              <Text className="text-xl font-semibold text-foreground">Incident report</Text>
            </View>

            <View style={{ width: 56 }} />
          </View>

          {/* Details card */}
          <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-4" style={animStyle}>
            {/* Title + status */}
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 pr-1">
                <Text className="text-foreground text-base">{report.title}</Text>
                <View className="flex-row flex-wrap items-center gap-2 mt-1">
                  <View className="flex-row items-center gap-1">
                    <CalendarDays size={14} color="#0F172A" />
                    <Text className="text-xs text-muted-foreground">{report.reportedAt}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">• By {report.reportedBy}</Text>
                </View>
              </View>
              <View className="px-2 py-0.5 rounded-full bg-foreground/10">
                <Text className={`text-[11px] ${statusTone}`}>Status: {status}</Text>
              </View>
            </View>

            {/* Meta row */}
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="flex-row items-center gap-1 bg-background border border-border rounded-lg px-2 py-1">
                {catIcon ? createElement(catIcon, { size: 14, color: "#0F172A" }) : <Info size={14} color="#0F172A" />}
                <Text className="text-[12px] text-foreground">{categoryLabel}</Text>
              </View>
              <View className="flex-row items-center gap-1 bg-background border border-border rounded-lg px-2 py-1">
                <MapPin size={14} color="#0F172A" />
                <Text className="text-[12px] text-foreground">{report.location}</Text>
              </View>
              <View className={`px-2 py-0.5 rounded-full border flex-row items-center gap-1 ${prioPill(priority).wrap}`}>
                <PillIcon size={12} color="#0F172A" />
                <Text className={`text-[11px] font-medium ${prioPill(priority).text}`}>Priority: {priority}</Text>
              </View>
            </View>

            {mapPreviewUrl ? (
              <View className="overflow-hidden rounded-xl border border-border bg-background">
                <View style={{ height: 200, position: "relative" }}>
                  <Image
                    source={{ uri: mapPreviewUrl }}
                    style={{ width: "100%", height: 200 }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1">
                    <Text className="text-[11px] text-foreground">{report.location}</Text>
                  </View>
                </View>
              </View>
            ) : mapPreviewLoading ? (
              <View className="h-40 items-center justify-center rounded-xl border border-border bg-background">
                <ActivityIndicator size="small" color="#0F172A" />
                <Text className="mt-2 text-[11px] text-muted-foreground">Loading map preview…</Text>
              </View>
            ) : mapPreviewError ? (
              <View className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
                <Text className="text-[11px] text-muted-foreground">{mapPreviewError}</Text>
              </View>
            ) : null}

            {/* Description */}
            {report.description ? (
              <View className="bg-background rounded-xl border border-border p-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <FileText size={14} color="#0F172A" />
                  <Text className="text-[12px] text-foreground">Description</Text>
                </View>
                <Text className="text-sm text-foreground">{report.description}</Text>
              </View>
            ) : null}

            {/* Attachments */}
            {attachments.length > 0 ? (
              <View className="bg-background rounded-xl border border-border p-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <ImageIcon size={14} color="#0F172A" />
                    <Text className="text-[12px] text-foreground">Evidence</Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground">
                    {attachments.length === 1 ? "1 photo" : `${attachments.length} photos`}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 4 }}
                >
                  {attachments.map((url, index) => (
                    <Pressable
                      key={url}
                      onPress={() => openAttachment(url)}
                      className="mr-3 overflow-hidden rounded-xl border border-border"
                      style={index === attachments.length - 1 ? { marginRight: 0 } : undefined}
                      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: 132, height: 132 }}
                        contentFit="cover"
                        transition={200}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </Animated.View>

          {/* Witness summary */}
          <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-3 mt-4" style={animStyle}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Users size={16} color="#0F172A" />
                <Text className="text-[13px] text-foreground">Witnesses</Text>
              </View>
              <Text className="text-[11px] text-muted-foreground">
                {witnesses.length === 1 ? "1 saved" : `${witnesses.length} saved`}
              </Text>
            </View>

            {witnesses.length > 0 ? (
              <View className="gap-2">
                {witnesses.map((w) => {
                  const name = [w.firstName, w.lastName].filter(Boolean).join(" ").trim();
                  return (
                    <View key={w.id} className="bg-background border border-border rounded-xl px-3 py-2">
                      <Text className="text-[13px] text-foreground">{name || "Unnamed witness"}</Text>
                      <View className="flex-row flex-wrap items-center gap-3 mt-1">
                        <View className="flex-row items-center gap-1">
                          <Calendar size={12} color="#0F172A" />
                          <Text className="text-[11px] text-muted-foreground">
                            {formatDobDisplay(w.dateOfBirth)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Phone size={12} color="#0F172A" />
                          <Text className="text-[11px] text-muted-foreground">
                            {formatPhoneDisplay(w.contactNumber)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-background border border-border rounded-xl px-3 py-3">
                <Text className="text-[12px] text-muted-foreground">No witnesses recorded.</Text>
                <Text className="text-[11px] text-muted-foreground mt-1">
                  Witnesses saved during submission will appear here for follow-up.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Officer actions by SECTION */}
          {/* Pending: Approve/Reject (tab-driven) */}
          {role === "officer" && canApproveReject ? (
            <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-2 mt-4" style={animStyle}>
              <Text className="text-[12px] text-foreground">Decision</Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Button onPress={onApprove} className="flex-1 h-10 rounded-lg">
                  <View className="flex-row items-center justify-center gap-1">
                    <BadgeCheck size={16} color="#FFFFFF" />
                    <Text className="text-primary-foreground text-[13px]">Approve</Text>
                  </View>
                </Button>
                <Button variant="secondary" onPress={onReject} className="flex-1 h-10 rounded-lg">
                  <View className="flex-row items-center justify-center gap-1">
                    <AlertTriangle size={16} color="#DC2626" />
                    <Text className="text-[13px}" style={{ color: "#DC2626" }}>Reject</Text>
                  </View>
                </Button>
              </View>
              <Text className="text-[11px] text-muted-foreground mt-1">
                Approve to proceed; Reject will mark this as resolved (demo).
              </Text>
            </Animated.View>
          ) : null}

          {/* Ongoing: Update Status + Add Notes (tab-driven) */}
          {role === "officer" && canUpdateStatus ? (
            <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-3 mt-4" style={animStyle}>
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] text-foreground">Status</Text>
                <Button
                  variant="secondary"
                  className="h-9 px-3 rounded-lg"
                  onPress={() =>
                    setShowUpdate((prev) => {
                      const next = !prev;
                      setStatusDraft(next ? status : null);
                      return next;
                    })
                  }
                >
                  <View className="flex-row items-center gap-1">
                    <ClipboardList size={14} color="#0F172A" />
                    <Text className="text-[12px] text-foreground">{showUpdate ? "Close" : "Update status"}</Text>
                  </View>
                </Button>
              </View>

              {showUpdate ? (
                <View className="bg-muted rounded-xl border border-border p-3">
                  <Text className="text-[12px] text-foreground">Set status</Text>
                  <View className="flex-row flex-wrap gap-2 mt-2">
                    {(["Approved", "Assigned", "Ongoing", "Resolved"] as const).map((opt) => {
                      const active = (statusDraft ?? status) === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setStatusDraft(opt)}
                          className={`px-3 py-1 rounded-full border ${active ? "bg-foreground/10 border-transparent" : "bg-background border-border"}`}
                          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                        >
                          <Text className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View className="flex-row items-center justify-end gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="h-9 px-3 rounded-lg"
                      onPress={() => {
                        setShowUpdate(false);
                        setStatusDraft(null);
                      }}
                    >
                      <Text className="text-foreground text-[12px]">Cancel</Text>
                    </Button>
                    <Button
                      className="h-9 px-3 rounded-lg"
                      disabled={statusLoading}
                      onPress={async () => {
                        const target = statusDraft ?? status;
                        const ok = await applyStatus(target);
                        if (ok) {
                          setShowUpdate(false);
                          setStatusDraft(null);
                          toast.success("Status updated");
                        }
                      }}
                    >
                      <Text className="text-primary-foreground text-[12px]">
                        {statusLoading ? "Saving..." : "Save"}
                      </Text>
                    </Button>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          {/* Notes (citizen-visible): only render if notes exist or officer can add */}
          {(notes.length > 0 || canAddNotes) ? (
            <Animated.View className="bg-muted rounded-2xl border border-border mt-4 overflow-hidden" style={animStyle}>
              {/* Header */}
              <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <MessageSquare size={16} color="#0F172A" />
                  <Text className="text-[13px] text-foreground">Notes</Text>
                </View>

                {canAddNotes ? (
                  <Button variant="secondary" className="h-9 px-3 rounded-lg" onPress={() => setShowNotes((v) => !v)}>
                    <Text className="text-[12px] text-foreground">{showNotes ? "Close" : "Add note"}</Text>
                  </Button>
                ) : null}
              </View>

              {/* Existing notes */}
              <View className="px-4 py-3">
                {notes.length > 0 ? (
                  notes.slice().reverse().map((n) => (
                    <View key={n.id} className="bg-background rounded-lg border border-border px-3 py-2 mb-2">
                      <Text className="text-[12px] text-foreground">{n.text}</Text>
                      <Text className="text-[10px] text-muted-foreground mt-1">
                        {n.by} · {n.at}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View className="bg-background rounded-lg border border-border px-3 py-2">
                    <Text className="text-[12px] text-muted-foreground">No notes yet.</Text>
                  </View>
                )}
              </View>

              {/* Composer (officer, ongoing/solved only) */}
              {canAddNotes && showNotes ? (
                <>
                  <View className="px-4">
                    <Input
                      value={newNoteDraft}
                      onChangeText={setNewNoteDraft}
                      onContentSizeChange={(e) => setNewNoteHeight(e.nativeEvent.contentSize.height)}
                      placeholder="Add a note for the citizen…"
                      className="bg-background rounded-xl"
                      style={{ minHeight: 96, height: Math.max(96, newNoteHeight ?? 0), textAlignVertical: "top", paddingTop: 12 }}
                      multiline
                      numberOfLines={4}
                      scrollEnabled={false}
                    />
                  </View>

                  <View className="border-t border-border px-4 py-3 bg-muted">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Switch value={notifyCitizen} onValueChange={setNotifyCitizen} />
                        <Text className="text-[12px] text-foreground">Notify citizen</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Button
                          variant="secondary"
                          className="h-9 px-3 rounded-lg"
                          onPress={() => {
                            setShowNotes(false);
                            setNewNoteDraft("");
                            setNewNoteHeight(undefined);
                          }}
                        >
                          <Text className="text-foreground text-[12px]">Cancel</Text>
                        </Button>
                        <Button
                          className="h-9 px-3 rounded-lg"
                          onPress={addNote}
                          disabled={noteSaving}
                        >
                          {noteSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-primary-foreground text-[12px]">Add note</Text>
                          )}
                        </Button>
                      </View>
                    </View>
                  </View>
                </>
              ) : null}
            </Animated.View>
          ) : null}

          {/* Citizen reassurance footer */}
          {role === "citizen" ? (
            <Animated.View className="bg-muted rounded-2xl border border-border p-4 mt-4" style={animStyle}>
              <View className="flex-row items-center gap-2">
                <CheckCircle size={16} color="#0F172A" />
                <Text className="text-[13px] text-foreground">We’ll keep this page updated as report progresses.</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* Resolved banner */}
          {status === "Resolved" ? (
            <Animated.View className="bg-primary/10 border border-primary/30 rounded-2xl p-4 mt-4" style={animStyle}>
              <View className="flex-row items-center gap-2">
                <CheckCircle size={18} color="#2563EB" />
                <Text className="text-[13px] text-primary">This report is marked as resolved.</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
