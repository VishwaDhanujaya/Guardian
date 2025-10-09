// app/(app)/incidents/report-incidents.tsx
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
  Pressable,
  View,
} from "react-native";
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
  fullName: string;
  phone: string;
  expanded: boolean;
};

type WitnessSectionProps = {
  witnesses: Witness[];
  setWitnesses: Dispatch<SetStateAction<Witness[]>>;
  nameRefs: MutableRefObject<Record<string, RNTextInput | null>>;
  isValidPhone: (value: string) => boolean;
  formatPhoneDisplay: (value: string) => string;
  sanitizeName: (value: string) => string;
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
 * Citizen incident report screen.
 * - Collects category, location, description, and optional witnesses.
 * - Performs lightweight client-side validation and shows inline guidance.
 * - Stubs submission; replace with API integration when backend is ready.
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

  /** Validate local phone format: 10 digits starting with 0. */
  const isValidPhone = (v: string) => /^0\d{9}$/.test(v);

  /** Format phone for display: 000 000 0000. */
  const formatPhoneDisplay = (v: string) =>
    /^0\d{9}$/.test(v) ? v.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : v;

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
    w.fullName.trim().length > 0 && isValidPhone(w.phone);

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
        const name = w.fullName.trim();
        const parts = [name];
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
              fullName: w.fullName.trim(),
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
            formatPhoneDisplay={formatPhoneDisplay}
            sanitizeName={sanitizeName}
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
  formatPhoneDisplay,
  sanitizeName,
}: WitnessSectionProps) {
  const sanitizePhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

  const phoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    witnesses.forEach((w) => {
      if (isValidPhone(w.phone)) {
        map[w.phone] = (map[w.phone] ?? 0) + 1;
      }
    });
    return map;
  }, [witnesses, isValidPhone]);

  const addWitness = () => {
    const id = Math.random().toString(36).slice(2, 9);
    setWitnesses((prev) => [
      ...prev,
      { id, fullName: "", phone: "", expanded: true },
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
    field: "fullName" | "phone",
    value: string,
  ) =>
    setWitnesses((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              [field]: field === "phone" ? sanitizePhone(value) : value,
            }
          : w,
      ),
    );

  const onSaveWitness = (id: string) => {
    setWitnesses((prev) =>
      prev.map((w) => {
        if (w.id !== id) {
          return w;
        }
        const name = sanitizeName(w.fullName);
        const phone = sanitizePhone(w.phone);
        const nameOk = name.length > 0;
        const phoneOk = isValidPhone(phone);
        return {
          ...w,
          fullName: name,
          phone,
          expanded: nameOk && phoneOk ? false : true,
        };
      }),
    );
  };

  const onCancelEdit = (id: string) => {
    const target = witnesses.find((x) => x.id === id);
    if (!target) return;
    const isEmpty = !target.fullName.trim() && target.phone.length === 0;
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
            const nameOk = w.fullName.trim().length > 0;
            const phoneOk = isValidPhone(w.phone);
            const duplicate = phoneOk && phoneCounts[w.phone] > 1;
            const errors: string[] = [];
            if (!nameOk) errors.push("Enter a full name.");
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
                          w.fullName.trim()
                        ) : (
                          <Text className="text-muted-foreground">Unnamed</Text>
                        )}
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
                <View className="gap-1">
                  <Label nativeID={`wname-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                    <Text className="text-[11px] text-muted-foreground">Full name</Text>
                  </Label>
                  <View className="relative">
                    <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                    <Input
                      ref={(r) => {
                        nameRefs.current[w.id] = r;
                      }}
                      aria-labelledby={`wname-${w.id}`}
                      value={w.fullName}
                      onChangeText={(t) => setWitnessField(w.id, "fullName", t)}
                      placeholder="e.g. Jamie Lee"
                      className="h-12 rounded-2xl bg-background pl-9"
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View className="gap-1">
                  <Label nativeID={`wphone-${w.id}`} className="text-[11px] font-medium text-muted-foreground">
                    <Text className="text-[11px] text-muted-foreground">Contact number</Text>
                  </Label>
                  <View className="relative">
                    <Phone size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                    <Input
                      aria-labelledby={`wphone-${w.id}`}
                      value={w.phone}
                      onChangeText={(t) => setWitnessField(w.id, "phone", t)}
                      placeholder="e.g. 0712345678"
                      keyboardType="phone-pad"
                      className="h-12 rounded-2xl bg-background pl-9"
                    />
                  </View>
                </View>

                {showError ? (
                  <View className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
                    {errors.map((err) => (
                      <Text key={err} className="text-[11px] text-destructive">
                        {err}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <View className="flex-row flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    onPress={() => onSaveWitness(w.id)}
                    className="h-9 rounded-lg px-3"
                    disabled={errors.length > 0}
                  >
                    <Text className="text-[12px] font-medium text-primary-foreground">Save witness</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => onCancelEdit(w.id)}
                    className="h-9 rounded-lg px-3"
                  >
                    <Text className="text-[12px] text-foreground">Cancel</Text>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => removeWitness(w.id)}
                    className="h-9 rounded-lg px-2"
                  >
                    <View className="flex-row items-center gap-1">
                      <Trash2 size={14} color="#EF4444" />
                      <Text className="text-[12px] text-destructive">Remove</Text>
                    </View>
                  </Button>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
