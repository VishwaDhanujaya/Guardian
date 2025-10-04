// app/(app)/lost-found/view.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, useColorScheme, View } from "react-native";
import { Image } from "expo-image";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import {
  addLostItemNote,
  fetchLostItemNotes,
  FoundItemDetail,
  getFoundItem,
  getLostItem,
  ItemNote,
  LostFrontendStatus,
  LostItemDetail,
  type LostItemUpdatePayload,
  updateLostItem,
  updateLostItemStatus,
} from "@/lib/api";
import { buildStaticMapPreviewUrl, getMapboxAccessToken } from "@/lib/mapbox";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Info as InfoIcon,
  PackageSearch,
} from "lucide-react-native";

type Section = "pending" | "searching" | "returned";
const isSection = (v: any): v is Section => v === "pending" || v === "searching" || v === "returned";

export default function LostFoundView() {
  const { id, type, role, tab: tabParam } = useLocalSearchParams<{ id: string; type: "found" | "lost"; role?: string; tab?: string }>();
  const navigation = useNavigation<any>();

  const backTab: Section | undefined = isSection(tabParam) ? (tabParam as Section) : undefined;

  const { value: mount } = useMountAnimation();
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const [item, setItem] = useState<FoundItemDetail | LostItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    model: "",
    serial: "",
    color: "",
    lastLocation: "",
  });

  const [status, setStatus] = useState<LostFrontendStatus>("New");
  const [statusDraft, setStatusDraft] = useState<LostFrontendStatus | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [notes, setNotes] = useState<ItemNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNoteDraft, setNewNoteDraft] = useState("");
  const [newNoteHeight, setNewNoteHeight] = useState<number | undefined>(undefined);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const [mapPreviewError, setMapPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const data = type === "lost" ? await getLostItem(id) : await getFoundItem(id);
        setItem(data);
        setDraft({
          name: data.name ?? "",
          description: data.description ?? "",
          model: data.model ?? "",
          serial: data.serial ?? "",
          color: data.color ?? "",
          lastLocation: data.lastLocation ?? "",
        });

        if (type === "lost") {
          const currentStatus = (data as LostItemDetail)?.status;
          if (currentStatus) setStatus(currentStatus);
          setStatusDraft(null);
          setNotesLoading(true);
          try {
            const loadedNotes = await fetchLostItemNotes(id);
            setNotes(loadedNotes);
          } catch {
            toast.error("Failed to load notes");
          } finally {
            setNotesLoading(false);
          }
        } else {
          setNotes([]);
          setStatusDraft(null);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, type]);

  useEffect(() => {
    let cancelled = false;

    if (!item || typeof item.latitude !== "number" || typeof item.longitude !== "number") {
      setMapPreviewUrl(null);
      setMapPreviewError(null);
      setMapPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const lat = item.latitude;
    const lon = item.longitude;

    setMapPreviewLoading(true);
    setMapPreviewError(null);

    getMapboxAccessToken()
      .then((token) => {
        if (cancelled) return;
        const url = buildStaticMapPreviewUrl(lat, lon, token, {
          width: 720,
          height: 360,
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
  }, [item, colorScheme]);

  // ⇣ Key change: for officers, always honor the tab they came from
  const section = useMemo<Section | undefined>(() => {
    if (type !== "lost") return undefined;
    if (role === "officer" && backTab) return backTab; // <-- tab-driven for officers
    // Citizen (or no tab): infer from current status
    if (status === "Returned") return "returned";
    if (status === "New" || status === "In Review") return "pending";
    return "searching"; // Approved, Assigned, Searching
  }, [backTab, role, status, type]);

  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else if (role === "officer" && type === "lost") {
      router.replace({ pathname: "/(app)/lost-found/officer-lost", params: { role, tab: backTab ?? section } });
    } else {
      router.replace({ pathname: "/home", params: { role: role === "officer" ? "officer" : "citizen" } });
    }
  }, [navigation, role, type, backTab, section]);

  // Permissions based on officer tab (as requested)
  const canApproveReject = role === "officer" && section === "pending";
  const canUpdateStatus = role === "officer" && section === "searching";
  const canAddNotes = role === "officer" && (section === "searching" || section === "returned");

  const saveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const payload: Partial<LostItemUpdatePayload> = {};
      const current = {
        name: item.name ?? "",
        description: item.description ?? "",
        model: item.model ?? "",
        serial: item.serial ?? "",
        color: item.color ?? "",
        lastLocation: item.lastLocation ?? "",
      };

      if (draft.name !== current.name) payload.name = draft.name;
      if (draft.description !== current.description) payload.description = draft.description;
      if (draft.model !== current.model) payload.model = draft.model;
      if (draft.serial !== current.serial) payload.serial = draft.serial;
      if (draft.color !== current.color) payload.color = draft.color;
      const locationChanged = draft.lastLocation !== current.lastLocation;

      const updated = await updateLostItem(item.id, payload);
      setItem((prev) => {
        if (!locationChanged) return updated;
        return { ...updated, lastLocation: draft.lastLocation };
      });
      setDraft({
        name: updated.name ?? "",
        description: updated.description ?? "",
        model: updated.model ?? "",
        serial: updated.serial ?? "",
        color: updated.color ?? "",
        lastLocation: locationChanged ? draft.lastLocation : updated.lastLocation ?? "",
      });
      if (type === "lost") {
        const nextStatus = (updated.status as LostFrontendStatus | undefined) ?? status;
        setStatus(nextStatus);
      }
      setEditing(false);
      toast.success("Item updated");
    } catch {
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (!item) return;
    setDraft({
      name: item.name ?? "",
      description: item.description ?? "",
      model: item.model ?? "",
      serial: item.serial ?? "",
      color: item.color ?? "",
      lastLocation: item.lastLocation ?? "",
    });
    setEditing(false);
  };

  const applyStatus = async (
    next: LostFrontendStatus,
    successMessage: string,
    options: { closeAfter?: boolean } = {},
  ) => {
    if (!item) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateLostItemStatus(item.id, next);
      const nextStatus = (updated.status as LostFrontendStatus | undefined) ?? next;
      setItem(updated);
      setStatus(nextStatus);
      setStatusDraft(null);
      setShowUpdate(false);
      toast.success(successMessage);
      if (options.closeAfter) {
        goBack();
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const onApprove = () => {
    if (!canApproveReject) return;
    applyStatus("Approved", "Lost report approved");
  };

  const onReject = () => {
    if (!canApproveReject) return;
    applyStatus("Returned", "Lost report closed", { closeAfter: true });
  };

  const addNote = async () => {
    if (!canAddNotes || noteSubmitting || !item) return;
    const text = newNoteDraft.trim();
    if (!text) return;
    setNoteSubmitting(true);
    try {
      const created = await addLostItemNote(item.id, "Officer", text);
      setNotes((arr) => [...arr, created]);
      setNewNoteDraft("");
      setNewNoteHeight(undefined);
      setShowNotes(true);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const onSaveStatus = async () => {
    if (!showUpdate || statusDraft == null || statusDraft === status) {
      setShowUpdate(false);
      setStatusDraft(null);
      return;
    }
    await applyStatus(statusDraft, "Status updated");
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#0F172A" />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-5">
        <Text className="mb-4 text-foreground">Failed to load item.</Text>
        <Button onPress={goBack} className="h-10 px-4 rounded-lg">
          <Text className="text-primary-foreground">Go back</Text>
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }} contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 p-5">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={goBack} className="flex-row items-center gap-1 px-2 py-1 -ml-2" hitSlop={8}>
            <ChevronLeft size={18} color="#0F172A" />
            <Text className="text-foreground">Back</Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <PackageSearch size={18} color="#0F172A" />
            <Text className="text-xl font-semibold text-foreground">{type === "lost" ? "Lost item" : "Found item"}</Text>
          </View>
          <View style={{ width: 56 }} />
        </View>

        <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-3" style={animStyle}>
          {renderField("Name", editing ? draft.name : item.name, (t) => setDraft((d) => ({ ...d, name: t })), editing)}
          {renderField("Description", editing ? draft.description : item.description, (t) => setDraft((d) => ({ ...d, description: t })), editing)}
          {renderField("Model", editing ? draft.model : item.model, (t) => setDraft((d) => ({ ...d, model: t })), editing)}
          {renderField("Serial/IMEI", editing ? draft.serial : item.serial, (t) => setDraft((d) => ({ ...d, serial: t })), editing)}
          {renderField("Colour", editing ? draft.color : item.color, (t) => setDraft((d) => ({ ...d, color: t })), editing)}
          {!editing
            ? mapPreviewUrl
              ? (
                  <View className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                    <View style={{ height: 200, position: "relative" }}>
                      <Image
                        source={{ uri: mapPreviewUrl }}
                        style={{ width: "100%", height: 200 }}
                        contentFit="cover"
                        transition={200}
                      />
                      <View className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1">
                        <Text className="text-[11px] text-foreground">{item.lastLocation || "Location"}</Text>
                      </View>
                    </View>
                  </View>
                )
              : mapPreviewLoading
              ? (
                  <View className="h-40 items-center justify-center rounded-2xl border border-border bg-muted/20">
                    <ActivityIndicator size="small" color="#0F172A" />
                    <Text className="mt-2 text-[11px] text-muted-foreground">Loading map preview…</Text>
                  </View>
                )
              : mapPreviewError
              ? (
                  <View className="rounded-2xl border border-dashed border-border bg-muted/20 p-3">
                    <Text className="text-[11px] text-muted-foreground">{mapPreviewError}</Text>
                  </View>
                )
              : null
            : null}
          {renderField("Last location", editing ? draft.lastLocation : item.lastLocation, (t) => setDraft((d) => ({ ...d, lastLocation: t })), editing)}
          {"branch" in item ? renderField("Police branch", item.branch) : null}
          {"reportedBy" in item ? renderField("Reported by", item.reportedBy) : null}
          {type === "lost" && "status" in item ? renderField("Status", status) : null}
        </Animated.View>

        {/* Citizen edit */}
        {role === "citizen" ? (
          <View className="flex-row flex-wrap items-center gap-2 mt-4">
            {editing ? (
              <>
                <Button onPress={saveEdit} className="px-4 h-10 rounded-lg" disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text className="text-primary-foreground">Save</Text>}
                </Button>
                <Button variant="secondary" onPress={cancelEdit} className="px-4 h-10 rounded-lg" disabled={saving}>
                  <Text className="text-foreground">Cancel</Text>
                </Button>
              </>
            ) : (
              <Button variant="secondary" onPress={() => setEditing(true)} className="px-4 h-10 rounded-lg">
                <Text className="text-foreground">Edit</Text>
              </Button>
            )}
          </View>
        ) : null}

        {/* Officer: Pending tab → Approve / Reject */}
        {role === "officer" && type === "lost" && canApproveReject ? (
          <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-2 mt-4" style={animStyle}>
            <Text className="text-[12px] text-foreground">Decision</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Button onPress={onApprove} className="flex-1 h-10 rounded-lg" disabled={updatingStatus}>
                <View className="flex-row items-center justify-center gap-1">
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text className="text-primary-foreground text-[13px]">Approve</Text>
                </View>
              </Button>
              <Button variant="secondary" onPress={onReject} className="flex-1 h-10 rounded-lg" disabled={updatingStatus}>
                <View className="flex-row items-center justify-center gap-1">
                  <AlertTriangle size={16} color="#DC2626" />
                  <Text className="text-[13px]" style={{ color: "#DC2626" }}>
                    Reject
                  </Text>
                </View>
              </Button>
            </View>
          </Animated.View>
        ) : null}

        {/* Officer: Searching tab → Update status + Notes */}
        {role === "officer" && type === "lost" && canUpdateStatus ? (
          <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-3 mt-4" style={animStyle}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[12px] text-foreground">Status</Text>
              <Button
                variant="secondary"
                className="h-9 px-3 rounded-lg"
                onPress={() =>
                  setShowUpdate((v) => {
                    const next = !v;
                    setStatusDraft(next ? status : null);
                    return next;
                  })
                }
                disabled={updatingStatus}
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
                  {(["Approved", "Assigned", "Searching", "Returned"] as const).map((opt) => {
                    const active = (statusDraft ?? status) === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => setStatusDraft(opt)}
                        className={`px-3 py-1 rounded-full border ${active ? "bg-foreground/10 border-transparent" : "bg-background border-border"}`}
                        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                        disabled={updatingStatus}
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
                    disabled={updatingStatus}
                  >
                    <Text className="text-foreground text-[12px]">Cancel</Text>
                  </Button>
                  <Button
                    className="h-9 px-3 rounded-lg"
                    onPress={onSaveStatus}
                    disabled={updatingStatus || statusDraft == null || statusDraft === status}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-primary-foreground text-[12px]">Save</Text>
                    )}
                  </Button>
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Officer: Searching/Returned tabs → Notes */}
        {role === "officer" && type === "lost" && (canAddNotes || notes.length > 0) ? (
          <Animated.View className="bg-muted rounded-2xl border border-border mt-4 overflow-hidden" style={animStyle}>
            <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <InfoIcon size={16} color="#0F172A" />
                <Text className="text-[13px] text-foreground">Notes</Text>
              </View>
              {canAddNotes ? (
                <Button variant="secondary" className="h-9 px-3 rounded-lg" onPress={() => setShowNotes((v) => !v)}>
                  <Text className="text-[12px] text-foreground">{showNotes ? "Close" : "Add note"}</Text>
                </Button>
              ) : null}
            </View>

            <View className="px-4 py-3">
              {notesLoading ? (
                <View className="py-4 items-center justify-center">
                  <ActivityIndicator color="#0F172A" />
                </View>
              ) : notes.length > 0 ? (
                notes
                  .slice()
                  .reverse()
                  .map((n) => (
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

            {canAddNotes && showNotes ? (
              <>
                <View className="px-4">
                  <Input
                    value={newNoteDraft}
                    onChangeText={setNewNoteDraft}
                    onContentSizeChange={(e) => setNewNoteHeight(e.nativeEvent.contentSize.height)}
                    placeholder="Add a note for the citizen…"
                    className="bg-background rounded-xl"
                    style={{
                      minHeight: 96,
                      height: Math.max(96, newNoteHeight ?? 0),
                      textAlignVertical: "top",
                      paddingTop: 12,
                    }}
                    multiline
                    numberOfLines={4}
                    scrollEnabled={false}
                  />
                </View>

                <View className="border-t border-border px-4 py-3 bg-muted">
                  <View className="flex-row items-center justify-end gap-2">
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
                    <Button className="h-9 px-3 rounded-lg" onPress={addNote} disabled={noteSubmitting}>
                      {noteSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text className="text-primary-foreground text-[12px]">Add note</Text>
                      )}
                    </Button>
                  </View>
                </View>
              </>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const renderField = (
  label: string,
  value?: string,
  onChange?: (t: string) => void,
  editing?: boolean,
) => {
  if (editing) {
    return (
      <View>
        <Text className="text-sm font-medium text-foreground mb-1">{label}</Text>
        <Input value={value} onChangeText={onChange} className="bg-background rounded-xl" />
      </View>
    );
  }
  if (!value) return null;
  return (
    <View>
      <Text className="text-sm font-medium text-foreground mb-1">{label}</Text>
      <Text className="text-muted-foreground">{value}</Text>
    </View>
  );
};
