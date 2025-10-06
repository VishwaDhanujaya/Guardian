import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { NativeSyntheticEvent, TextInput as RNTextInput, TextInputContentSizeChangeEventData } from "react-native";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { MapboxLocationField } from "@/components/map/MapboxLocationPicker";
import type { MapboxLocation } from "@/components/map/MapboxLocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { createReport, createReportWitness, getIncident } from "@/lib/api";
import { formatCoordinates } from "@/lib/mapbox";

import {
  AlertTriangle,
  Calendar,
  Car,
  ChevronRight,
  FilePlus2,
  Image as ImageIcon,
  MoreHorizontal,
  NotebookPen,
  Phone,
  ShieldOff,
  ShieldPlus,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react-native";

type Role = "citizen" | "officer";
type Witness = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  expanded: boolean;
};

type ReportAttachment = {
  id: string;
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

const MAX_ATTACHMENTS = 12;

/**
 * Citizen incident report screen that collects key details and posts them to the backend.
 * Handles attachments, witnesses, and location input with light validation.
 *
 * @returns The incident report UI.
 */
export default function ReportIncidents() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";

  // Safe back navigation (fallback to /home)
  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: resolvedRole } });
  }, [navigation, resolvedRole]);

  // Entrance motion
  const { value: mount } = useMountAnimation({
    damping: 14,
    stiffness: 160,
    mass: 0.6,
  });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  };

  // Form state
  const [category, setCategory] = useState<"Theft" | "Accident" | "Hazard" | "Other">("Accident");
  const [location, setLocation] = useState<MapboxLocation | null>(null);

  // Description (auto-grow + counter)
  const DESC_MAX = 500;
  const [desc, setDesc] = useState("");
  const [descHeight, setDescHeight] = useState(100);

  /** Clamp description to DESC_MAX and update value. */
  const onChangeDesc = (v: string) => setDesc(v.slice(0, DESC_MAX));

  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<ReportAttachment[]>([]);

  const pickAttachments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) {
        return;
      }
      let trimmed = false;
      setPhotos((prev) => {
        const existing = new Set(prev.map((p) => p.uri));
        const next = [...prev];
        result.assets.forEach((asset, index) => {
          if (!asset?.uri || existing.has(asset.uri)) {
            return;
          }
          if (next.length >= MAX_ATTACHMENTS) {
            trimmed = true;
            return;
          }
          const name = asset.name?.trim() || `Photo ${next.length + 1}`;
          next.push({
            id: `${asset.uri}-${Date.now()}-${index}`,
            uri: asset.uri,
            name,
            size: asset.size ?? undefined,
            mimeType: asset.mimeType ?? undefined,
          });
        });
        return next;
      });
      if (trimmed) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} photos per report`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to pick attachments");
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
  }, []);

  const formatFileSize = (size?: number) => {
    if (!size || size <= 0) return "";
    const units = ["B", "KB", "MB", "GB"] as const;
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  // Witnesses
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const nameRefs = useRef<Record<string, RNTextInput | null>>({});

  /** Strip non-digits and clamp to 10 chars. */
  const sanitizePhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

  const sanitizeName = (v: string) => v.replace(/\s+/g, " ").trim();

  const toIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  /** Validate local phone format: 10 digits starting with 0. */
  const isValidPhone = (v: string) => /^0\d{9}$/.test(v);

  const isValidDob = (value: string) => {
    if (!value) return false;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    parsed.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return toIsoDate(parsed) === value && parsed <= today;
  };

  /** Format phone for display: 000 000 0000. */
  const formatPhoneDisplay = (v: string) =>
    /^0\d{9}$/.test(v) ? v.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : v;

  const formatDobDisplay = (value: string) => {
    if (!isValidDob(value)) return value;
    const [year, month, day] = value.split("-").map((part) => Number(part));
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Duplicate phone detection across witnesses
  const phoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    witnesses.forEach((w) => {
      if (isValidPhone(w.phone)) map[w.phone] = (map[w.phone] ?? 0) + 1;
    });
    return map;
  }, [witnesses]);

  const hasDuplicatePhones = Object.values(phoneCounts).some((c) => c > 1);

  const isWitnessComplete = (w: Witness) =>
    w.firstName.trim().length > 0 &&
    w.lastName.trim().length > 0 &&
    isValidDob(w.dateOfBirth) &&
    isValidPhone(w.phone);

  const witnessesValid =
    witnesses.length === 0 ||
    (witnesses.every(isWitnessComplete) && !hasDuplicatePhones);

  const nearingLimit = desc.length >= DESC_MAX - 20;

  const canSubmit = Boolean(location) && desc.trim().length > 5 && witnessesValid && !submitting;

  /**
   * Submit incident (stub).
   * Replace with API call and error handling.
   */
  const onSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const validatedWitnesses = witnesses.filter(isWitnessComplete);
      const witnessLines = validatedWitnesses.map((w, idx) => {
        const name = `${w.firstName.trim()} ${w.lastName.trim()}`.trim();
        const parts = [name];
        if (isValidDob(w.dateOfBirth)) {
          parts.push(`DOB ${formatDobDisplay(w.dateOfBirth)}`);
        }
        parts.push(`Phone ${formatPhoneDisplay(w.phone)}`);
        return `Witness ${idx + 1}: ${parts.join(" · ")}`;
      });

      const detailSegments = [desc.trim()];
      if (category) detailSegments.push(`Category: ${category}`);
      if (location) {
        const label = location.label ?? formatCoordinates(location.latitude, location.longitude);
        detailSegments.push(`Location: ${label}`);
      }
      if (witnessLines.length > 0) {
        detailSegments.push(["Witnesses:", ...witnessLines].join("\n"));
      }

      const descriptionPayload = detailSegments.filter(Boolean).join("\n\n");

      const reportSummary = await createReport({
        description: descriptionPayload,
        latitude: location?.latitude,
        longitude: location?.longitude,
        photos: photos.map((photo) => ({
          uri: photo.uri,
          name: photo.name,
          mimeType: photo.mimeType,
        })),
      });

      if (!reportSummary?.id) {
        throw new Error("Missing report identifier");
      }

      if (validatedWitnesses.length > 0) {
        await Promise.all(
          validatedWitnesses.map((w) =>
            createReportWitness(reportSummary.id, {
              firstName: w.firstName.trim(),
              lastName: w.lastName.trim(),
              dateOfBirth: w.dateOfBirth,
              contactNumber: w.phone,
            })
          )
        );

        const refreshed = await getIncident(reportSummary.id);
        const savedCount = refreshed?.witnesses?.length ?? 0;
        if (savedCount < validatedWitnesses.length) {
          throw new Error("Unable to confirm all witnesses were saved");
        }
      }

      const successMessage = (() => {
        const witnessPart = validatedWitnesses.length > 0;
        const photoPart = photos.length > 0;
        if (witnessPart && photoPart) return "Incident, witnesses, and photos submitted";
        if (witnessPart) return "Incident and witnesses submitted";
        if (photoPart) return "Incident and photos submitted";
        return "Incident submitted";
      })();

      toast.success(successMessage);
      setPhotos([]);
      router.replace({
        pathname: "/incidents/my-reports",
        params: { role: resolvedRole },
      });
    } catch (error: any) {
      const fallback = witnesses.some(isWitnessComplete)
        ? "Failed to submit incident and witnesses"
        : "Failed to submit incident";
      const message =
        error?.message === "Unable to confirm all witnesses were saved"
          ? "Report created, but we couldn't confirm every witness was saved. Please review the incident details before leaving."
          : error?.message === "Missing report identifier"
          ? fallback
          : error?.response?.data?.message || error?.message || fallback;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Category chip control. */
  const CategoryChip = ({
    value,
    Icon,
  }: {
    value: typeof category;
    Icon: ComponentType<{ size?: number; color?: string }>;
  }) => {
    const active = category === value;
    return (
      <Pressable
        onPress={() => setCategory(value)}
        className={`px-3 py-1.5 rounded-full border flex-row items-center gap-1.5 ${
          active ? "bg-foreground/10 border-transparent" : "bg-background border-border"
        }`}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        <Icon size={14} color={active ? "#0F172A" : "#64748B"} />
        <Text className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{value}</Text>
      </Pressable>
    );
  };

  return (
    <AppScreen
      scrollComponent={KeyboardAwareScrollView}
      scrollViewProps={{
        enableOnAndroid: true,
        keyboardShouldPersistTaps: "handled",
        extraScrollHeight: 80,
        onScrollBeginDrag: Keyboard.dismiss,
      }}
      contentClassName="pb-6"
    >
      <ScreenHeader
        title="Report Incident"
        subtitle="Share what happened so we can route it to the right team."
        icon={ShieldPlus}
        onBack={goBack}
      />

      <Animated.View style={animStyle} className="w-full">
        <AppCard className="gap-8">
          <View className="gap-5">
            <SectionHeader
              title="Incident details"
              description="Provide as much context as you can — it helps responders act faster."
            />

            <View className="gap-6">
              <View>
                <Text className="mb-2 text-xs font-semibold text-muted-foreground">Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  <CategoryChip value="Accident" Icon={Car} />
                  <CategoryChip value="Theft" Icon={ShieldOff} />
                  <CategoryChip value="Hazard" Icon={AlertTriangle} />
                  <CategoryChip value="Other" Icon={MoreHorizontal} />
                </View>
              </View>

              <View className="flex-row items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3">
                <AlertTriangle size={16} color="#4338CA" style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-primary">Be as specific as possible</Text>
                  <Text className="mt-1 text-[11px] text-primary/80">
                    Include the timeline, people involved, and any evidence or photos so officers can respond quickly.
                  </Text>
                </View>
              </View>

              <View className="gap-2">
                <Label nativeID="descLabel" className="text-xs font-semibold text-muted-foreground">
                  <Text className="text-xs text-muted-foreground">Description</Text>
                </Label>
                <View className="relative overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm shadow-black/5">
                  <NotebookPen size={16} color="#64748B" style={{ position: "absolute", left: 18, top: 18 }} />
                  <Input
                    aria-labelledby="descLabel"
                    value={desc}
                    onChangeText={onChangeDesc}
                    onContentSizeChange={(e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
                      const h = e?.nativeEvent?.contentSize?.height ?? 100;
                      setDescHeight(Math.max(100, Math.min(h, 220)));
                    }}
                    placeholder="What happened?"
                    className="rounded-3xl border-0 bg-transparent pl-12 pr-4"
                    style={{ minHeight: 128, height: descHeight, paddingTop: 18, textAlignVertical: "top" }}
                    multiline
                    maxLength={DESC_MAX}
                  />
                </View>
              </View>

              <MapboxLocationField
                value={location}
                onChange={setLocation}
                allowClear
                helperText="Pan and zoom the map to drop the pin."
              />
            </View>
          </View>

          <View className="h-px w-full bg-border/80" />

          <View className="gap-4">
            <SectionHeader
              title="Attachments"
              description="Include supporting media to help responders understand the situation."
              trailing={
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={pickAttachments}
                  className="h-9 rounded-lg px-3"
                  disabled={submitting}
                >
                  <View className="flex-row items-center gap-1">
                    <FilePlus2 size={14} color="#0F172A" />
                    <Text className="text-[12px] text-foreground">{photos.length > 0 ? "Add more" : "Choose"}</Text>
                  </View>
                </Button>
              }
            />
            {photos.length > 0 ? (
              <View className="gap-2">
                {photos.map((photo) => (
                  <View
                    key={photo.id}
                    className="flex-row items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3"
                  >
                    <ImageIcon size={18} color="#0F172A" />
                    <View className="flex-1">
                      <Text
                        className="text-[13px] font-medium text-foreground"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {photo.name}
                      </Text>
                      <Text className="text-[11px] text-muted-foreground">
                        {[photo.mimeType ?? "Image", formatFileSize(photo.size)].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeAttachment(photo.id)}
                      className="h-8 w-8 items-center justify-center rounded-full bg-destructive/10"
                      android_ripple={{ color: "rgba(220,38,38,0.12)", borderless: true }}
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row flex-wrap items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
                <ImageIcon size={20} color="#0F172A" />
                <View className="flex-1 gap-1">
                  <Text className="font-medium text-foreground">Attach photo (optional)</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Include a clear photo if you have one available.
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="h-px w-full bg-border/80" />

          <WitnessSection
            witnesses={witnesses}
            setWitnesses={setWitnesses}
            nameRefs={nameRefs}
            isValidPhone={isValidPhone}
            isValidDob={isValidDob}
            formatPhoneDisplay={formatPhoneDisplay}
            formatDobDisplay={formatDobDisplay}
            sanitizeName={sanitizeName}
            toIsoDate={toIsoDate}
          />

          <Button
            onPress={onSubmit}
            size="lg"
            variant="default"
            className="h-12 rounded-2xl"
            disabled={!canSubmit}
          >
            <Text className="font-semibold text-primary-foreground">
              {submitting ? "Submitting…" : "Submit Report"}
            </Text>
          </Button>
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}

/**
 * Witness collection section.
 * - Manages add/edit/remove of witness entries with basic validation.
 * - Limits to five witnesses and flags duplicate phone numbers.
 */
function WitnessSection({
  witnesses,
  setWitnesses,
  nameRefs,
  isValidPhone,
  isValidDob,
  formatPhoneDisplay,
  formatDobDisplay,
  sanitizeName,
  toIsoDate,
}: {
  witnesses: Witness[];
  setWitnesses: Dispatch<SetStateAction<Witness[]>>;
  nameRefs: MutableRefObject<Record<string, RNTextInput | null>>;
  isValidPhone: (v: string) => boolean;
  isValidDob: (v: string) => boolean;
  formatPhoneDisplay: (v: string) => string;
  formatDobDisplay: (v: string) => string;
  sanitizeName: (v: string) => string;
  toIsoDate: (date: Date) => string;
}) {
  const sanitizePhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

  const parseIsoDate = (value: string) => {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  };

  const getDobSeed = (value?: string) => {
    if (value && isValidDob(value)) {
      return parseIsoDate(value);
    }
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() - 18);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  };

  const phoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    witnesses.forEach((w) => {
      if (isValidPhone(w.phone)) map[w.phone] = (map[w.phone] ?? 0) + 1;
    });
    return map;
  }, [witnesses, isValidPhone]);

  const hasDuplicatePhones = Object.values(phoneCounts).some((c) => c > 1);
  const [iosDobPicker, setIosDobPicker] = useState<{ id: string; date: Date } | null>(null);

  const addWitness = () => {
    const id = Math.random().toString(36).slice(2, 9);
    setWitnesses((prev) => [
      ...prev,
      { id, firstName: "", lastName: "", dateOfBirth: "", phone: "", expanded: true },
    ]);
    setTimeout(() => nameRefs.current[id]?.focus?.(), 60);
  };

  const removeWitness = (id: string) => {
    setWitnesses((prev) => prev.filter((w) => w.id !== id));
    nameRefs.current[id] = null;
  };

  const toggleExpanded = (id: string, force?: boolean) =>
    setWitnesses((prev) =>
      prev.map((w) => (w.id === id ? { ...w, expanded: force ?? !w.expanded } : w)),
    );

  const setWitnessField = (
    id: string,
    field: "firstName" | "lastName" | "phone" | "dateOfBirth",
    value: string,
  ) =>
    setWitnesses((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (field === "phone") {
          return { ...w, phone: sanitizePhone(value) };
        }
        if (field === "dateOfBirth") {
          return { ...w, dateOfBirth: value };
        }
        const cleaned = sanitizeName(value);
        return field === "firstName"
          ? { ...w, firstName: cleaned }
          : { ...w, lastName: cleaned };
      }),
    );

  const openDobPicker = (id: string) => {
    const target = witnesses.find((x) => x.id === id);
    const seed = getDobSeed(target?.dateOfBirth);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: seed,
        mode: "date",
        maximumDate: new Date(),
        onChange: (_event: any, selectedDate?: Date) => {
          if (selectedDate) {
            setWitnessField(id, "dateOfBirth", toIsoDate(selectedDate));
          }
        },
      });
    } else {
      setIosDobPicker({ id, date: seed });
    }
  };

  const doneEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    if (
      !w.firstName.trim() ||
      !w.lastName.trim() ||
      !isValidDob(w.dateOfBirth) ||
      !isValidPhone(w.phone)
    )
      return;
    toggleExpanded(id, false);
  };

  const onCancelEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    const isEmpty =
      !w.firstName.trim() &&
      !w.lastName.trim() &&
      w.phone.length === 0 &&
      w.dateOfBirth.length === 0;
    if (isEmpty) removeWitness(id);
    else toggleExpanded(id, false);
  };

  return (
    <View className="gap-3">
      <SectionHeader
        title="Witnesses (optional)"
        description="Add people we can reach out to for follow-up details."
        trailing={
          <Button
            size="sm"
            variant="secondary"
            onPress={addWitness}
            className="h-9 rounded-lg px-3"
            disabled={witnesses.length >= 5}
          >
            <View className="flex-row items-center gap-1">
              <UserPlus size={14} color="#0F172A" />
              <Text className="text-[12px] text-foreground">Add Witness</Text>
            </View>
          </Button>
        }
      />

      {witnesses.length === 0 ? (
        <View className="items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <Text className="text-xs font-medium text-muted-foreground">No witnesses added yet.</Text>
          <Text className="text-[11px] text-muted-foreground">
            You can include up to five people who saw what happened.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {witnesses.map((w) => {
            const nameOk = w.firstName.trim().length > 0 && w.lastName.trim().length > 0;
            const dobOk = isValidDob(w.dateOfBirth);
            const phoneOk = isValidPhone(w.phone);
            const duplicate = phoneOk && phoneCounts[w.phone] > 1;
            const errors: string[] = [];
            if (!nameOk) errors.push("Enter first and last name.");
            if (!dobOk) errors.push("Select a valid date of birth.");
            if (!phoneOk) errors.push("Enter a valid phone (10 digits starting with 0).");
            if (duplicate) errors.push("This phone duplicates another witness.");
            const showError = w.expanded && errors.length > 0;

            if (!w.expanded) {
              return (
                <Pressable
                  key={w.id}
                  onPress={() => toggleExpanded(w.id, true)}
                  className="flex-row items-center justify-between rounded-2xl border border-border bg-background px-3 py-3"
                  android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-foreground/10">
                      <UserRound size={18} color="#0F172A" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground">
                        {nameOk ? (
                          `${w.firstName.trim()} ${w.lastName.trim()}`
                        ) : (
                          <Text className="text-muted-foreground">Unnamed</Text>
                        )}
                      </Text>
                      <Text className={`mt-0.5 text-xs ${dobOk ? "text-foreground" : "text-muted-foreground"}`}>
                        DOB: {dobOk ? formatDobDisplay(w.dateOfBirth) : "Add date"}
                      </Text>
                      <Text
                        className={`mt-0.5 text-xs ${
                          phoneOk && !duplicate ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Phone: {w.phone ? formatPhoneDisplay(w.phone) : "Add phone"}
                        {duplicate ? <Text className="text-destructive">  • duplicate</Text> : null}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </Pressable>
              );
            }

            return (
              <View key={w.id} className="gap-3 rounded-2xl border border-border bg-background p-3">
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1">
                    <Label nativeID={`wfirst-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                      <Text className="text-[11px] text-muted-foreground">First name</Text>
                    </Label>
                    <View className="relative">
                      <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                      <Input
                        ref={(r) => {
                          nameRefs.current[w.id] = r;
                        }}
                        aria-labelledby={`wfirst-${w.id}`}
                        value={w.firstName}
                        onChangeText={(t) => setWitnessField(w.id, "firstName", t)}
                        placeholder="e.g. Jamie"
                        className="h-12 rounded-2xl bg-background pl-9"
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View className="flex-1 gap-1">
                    <Label nativeID={`wlast-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                      <Text className="text-[11px] text-muted-foreground">Last name</Text>
                    </Label>
                    <View className="relative">
                      <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                      <Input
                        aria-labelledby={`wlast-${w.id}`}
                        value={w.lastName}
                        onChangeText={(t) => setWitnessField(w.id, "lastName", t)}
                        placeholder="e.g. Lee"
                        className="h-12 rounded-2xl bg-background pl-9"
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1">
                    <Label nativeID={`wdob-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                      <Text className="text-[11px] text-muted-foreground">Date of birth</Text>
                    </Label>
                    <Pressable
                      onPress={() => openDobPicker(w.id)}
                      className="relative"
                      accessibilityRole="button"
                      android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: false }}
                    >
                      <Calendar size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                      <Input
                        aria-labelledby={`wdob-${w.id}`}
                        value={w.dateOfBirth ? formatDobDisplay(w.dateOfBirth) : ""}
                        placeholder="Select date"
                        editable={false}
                        className={`h-12 rounded-2xl bg-background pl-9 pr-3 ${
                          showError && !dobOk ? "border border-destructive text-destructive" : ""
                        }`}
                      />
                    </Pressable>
                  </View>

                  <View className="flex-1 gap-1">
                    <Label nativeID={`wphone-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                      <Text className="text-[11px] text-muted-foreground">Phone</Text>
                    </Label>
                    <View className="relative">
                      <Phone size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                      <Input
                        aria-labelledby={`wphone-${w.id}`}
                        value={w.phone}
                        onChangeText={(t) => setWitnessField(w.id, "phone", t)}
                        placeholder="e.g. 0714404243"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        className="h-12 rounded-2xl bg-background pl-9 pr-10"
                        maxLength={10}
                      />
                      <Pressable
                        onPress={() => removeWitness(w.id)}
                        className="absolute right-1 top-1 h-10 w-10 items-center justify-center rounded-full"
                        android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
                      >
                        <Trash2 size={16} color="#0F172A" />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {showError ? (
                  <View className="mt-1 gap-1">
                    {errors.map((msg) => (
                      <Text key={msg} className="text-[11px] text-destructive">
                        {msg}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <View className="mt-1 gap-1">
                    <Text className="text-[11px] text-muted-foreground">DOB format: YYYY-MM-DD</Text>
                    <Text className="text-[11px] text-muted-foreground">Phone format: 0XXXXXXXXX</Text>
                  </View>
                )}

                <View className="flex-row items-center justify-between">
                  <Button variant="link" onPress={() => onCancelEdit(w.id)} className="h-auto p-0">
                    <Text className="text-[12px] text-muted-foreground">Cancel</Text>
                  </Button>
                  <Button size="sm" onPress={() => doneEdit(w.id)} className="h-9 rounded-lg px-3">
                    <Text className="text-primary-foreground">Done</Text>
                  </Button>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View className="gap-1">
        {witnesses.length >= 5 ? (
          <Text className="text-[11px] text-muted-foreground">You can add up to 5 witnesses.</Text>
        ) : null}
        {hasDuplicatePhones ? (
          <Text className="text-[11px] text-destructive">Duplicate witness phones detected.</Text>
        ) : null}
      </View>

      {Platform.OS === "ios" && iosDobPicker ? (
        <View className="rounded-2xl border border-border bg-background p-3">
          <DateTimePicker
            value={iosDobPicker.date}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={(event: any, selectedDate?: Date) => {
              if (selectedDate) {
                setIosDobPicker({ id: iosDobPicker.id, date: selectedDate });
                setWitnessField(iosDobPicker.id, "dateOfBirth", toIsoDate(selectedDate));
              }
              if (event?.type === "dismissed") {
                setIosDobPicker(null);
              }
            }}
            style={{ alignSelf: "stretch" }}
          />
          <View className="flex-row justify-end mt-2">
            <Button variant="secondary" className="h-9 rounded-lg px-3" onPress={() => setIosDobPicker(null)}>
              <Text className="text-[12px] text-foreground">Done</Text>
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
