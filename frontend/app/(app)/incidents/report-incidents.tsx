// app/(app)/incidents/report-incidents.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";

import {
  AlertTriangle,
  Car,
  ChevronRight,
  FilePlus2,
  Image as ImageIcon,
  MapPin,
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
type Witness = { id: string; name: string; phone: string; expanded: boolean };

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
  const [location, setLocation] = useState("");

  // Description (auto-grow + counter)
  const DESC_MAX = 500;
  const [desc, setDesc] = useState("");
  const [descHeight, setDescHeight] = useState(100);

  /** Clamp description to DESC_MAX and update value. */
  const onChangeDesc = (v: string) => setDesc(v.slice(0, DESC_MAX));

  const [submitting, setSubmitting] = useState(false);

  // Witnesses
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const nameRefs = useRef<Record<string, RNTextInput | null>>({});

  /** Strip non-digits and clamp to 10 chars. */
  const sanitizePhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

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

  const witnessesValid =
    witnesses.length === 0 ||
    (witnesses.every((w) => w.name.trim().length > 0 && isValidPhone(w.phone)) && !hasDuplicatePhones);

  const canSubmit =
    location.trim().length > 2 && desc.trim().length > 5 && witnessesValid && !submitting;

  // Witness handlers
  const addWitness = () => {
    const id = Math.random().toString(36).slice(2, 9);
    setWitnesses((prev) => [...prev, { id, name: "", phone: "", expanded: true }]);
    setTimeout(() => nameRefs.current[id]?.focus?.(), 60);
    toast.info("Adding a witness");
  };
  const removeWitness = (id: string) => setWitnesses((prev) => prev.filter((w) => w.id !== id));
  const toggleExpanded = (id: string, force?: boolean) =>
    setWitnesses((prev) => prev.map((w) => (w.id === id ? { ...w, expanded: force ?? !w.expanded } : w)));
  const setWitnessField = (id: string, field: "name" | "phone", value: string) =>
    setWitnesses((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, [field]: field === "phone" ? sanitizePhone(value) : value.replace(/\s+/g, " ") } : w
      )
    );
  const doneEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    if (w.name.trim().length === 0 || !isValidPhone(w.phone)) return; // keep expanded until valid
    toggleExpanded(id, false);
    toast.success("Witness saved");
  };
  const onCancelEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    const isEmpty = w.name.trim().length === 0 && w.phone.length === 0;
    if (isEmpty) {
      removeWitness(id);
      toast.info("Discarded witness");
    } else {
      toggleExpanded(id, false);
    }
  };

  /**
   * Submit incident (stub).
   * Replace with API call and error handling.
   */
  const onSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 450));
      toast.success("Incident submitted");
      router.replace({ pathname: "/home", params: { role: resolvedRole } });
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

              <View className="gap-2">
                <Label nativeID="descLabel" className="text-xs font-semibold text-muted-foreground">
                  <Text className="text-xs text-muted-foreground">Description</Text>
                </Label>
                <View className="relative">
                  <NotebookPen size={16} color="#94A3B8" style={{ position: "absolute", left: 14, top: 16 }} />
                  <Input
                    aria-labelledby="descLabel"
                    value={desc}
                    onChangeText={onChangeDesc}
                    onContentSizeChange={(e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
                      const h = e?.nativeEvent?.contentSize?.height ?? 100;
                      setDescHeight(Math.max(100, Math.min(h, 220)));
                    }}
                    placeholder="What happened?"
                    className="rounded-2xl bg-background/60 pl-11"
                    style={{ minHeight: 120, height: descHeight, paddingTop: 16, textAlignVertical: "top" }}
                    multiline
                    maxLength={DESC_MAX}
                  />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-muted-foreground">Be as specific as possible.</Text>
                  <Text
                    className={
                      "text-[11px] font-medium " +
                      (desc.length >= DESC_MAX - 20 ? "text-destructive" : "text-muted-foreground")
                    }
                  >
                    {desc.length}/{DESC_MAX}
                  </Text>
                </View>
              </View>

              <View className="gap-2">
                <Label nativeID="locLabel" className="text-xs font-semibold text-muted-foreground">
                  <Text className="text-xs text-muted-foreground">Location</Text>
                </Label>
                <View className="relative">
                  <MapPin size={16} color="#94A3B8" style={{ position: "absolute", left: 14, top: 14 }} />
                  <Input
                    aria-labelledby="locLabel"
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Main St & 5th"
                    className="h-12 rounded-2xl bg-background/60 pl-11"
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>
          </View>

          <View className="h-px w-full bg-border/80" />

          <View className="gap-4">
            <SectionHeader
              title="Attachments"
              description="Include supporting media to help responders understand the situation."
              trailing={
                <Button size="sm" variant="secondary" onPress={() => {}} className="h-9 rounded-lg px-3">
                  <View className="flex-row items-center gap-1">
                    <FilePlus2 size={14} color="#0F172A" />
                    <Text className="text-[12px] text-foreground">Choose</Text>
                  </View>
                </Button>
              }
            />

            <View className="flex-row flex-wrap items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
              <ImageIcon size={20} color="#0F172A" />
              <View className="flex-1 gap-1">
                <Text className="font-medium text-foreground">Attach photo (optional)</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Include a clear photo if you have one available.
                </Text>
              </View>
            </View>
          </View>

          <View className="h-px w-full bg-border/80" />

          <WitnessSection
            witnesses={witnesses}
            setWitnesses={setWitnesses}
            nameRefs={nameRefs}
            isValidPhone={isValidPhone}
            formatPhoneDisplay={formatPhoneDisplay}
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
}: {
  witnesses: Witness[];
  setWitnesses: Dispatch<SetStateAction<Witness[]>>;
  nameRefs: MutableRefObject<Record<string, RNTextInput | null>>;
  isValidPhone: (v: string) => boolean;
  formatPhoneDisplay: (v: string) => string;
}) {
  const sanitizePhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

  const phoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    witnesses.forEach((w) => {
      if (isValidPhone(w.phone)) map[w.phone] = (map[w.phone] ?? 0) + 1;
    });
    return map;
  }, [witnesses, isValidPhone]);

  const hasDuplicatePhones = Object.values(phoneCounts).some((c) => c > 1);

  const addWitness = () => {
    const id = Math.random().toString(36).slice(2, 9);
    setWitnesses((prev) => [...prev, { id, name: "", phone: "", expanded: true }]);
    setTimeout(() => nameRefs.current[id]?.focus?.(), 60);
  };
  const removeWitness = (id: string) => setWitnesses((prev) => prev.filter((w) => w.id !== id));
  const toggleExpanded = (id: string, force?: boolean) =>
    setWitnesses((prev) => prev.map((w) => (w.id === id ? { ...w, expanded: force ?? !w.expanded } : w)));
  const setWitnessField = (id: string, field: "name" | "phone", value: string) =>
    setWitnesses((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, [field]: field === "phone" ? sanitizePhone(value) : value.replace(/\s+/g, " ") } : w
      )
    );
  const doneEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    if (w.name.trim().length === 0 || !isValidPhone(w.phone)) return;
    toggleExpanded(id, false);
  };
  const onCancelEdit = (id: string) => {
    const w = witnesses.find((x) => x.id === id);
    if (!w) return;
    const isEmpty = w.name.trim().length === 0 && w.phone.length === 0;
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
            const nameOk = w.name.trim().length > 0;
            const phoneOk = isValidPhone(w.phone);
            const duplicate = phoneOk && phoneCounts[w.phone] > 1;
            const showError = w.expanded && (!nameOk || !phoneOk || duplicate);

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
                        {nameOk ? w.name : <Text className="text-muted-foreground">Unnamed</Text>}
                      </Text>
                      <Text className={`mt-0.5 text-xs ${phoneOk && !duplicate ? "text-foreground" : "text-muted-foreground"}`}>
                        {w.phone ? formatPhoneDisplay(w.phone) : "Add phone"}
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
                    <Text className="text-[11px] text-muted-foreground">Name</Text>
                  </Label>
                  <View className="relative">
                    <UserRound size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 14 }} />
                    <Input
                      ref={(r) => {
                        nameRefs.current[w.id] = r;
                      }}
                      aria-labelledby={`wname-${w.id}`}
                      value={w.name}
                      onChangeText={(t) => setWitnessField(w.id, "name", t)}
                      placeholder="e.g. Jamie Lee"
                      className="h-12 rounded-2xl bg-background pl-9"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View className="gap-1">
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

                  {showError ? (
                    <Text className="mt-1 text-[11px] text-destructive">
                      {!nameOk
                        ? "Enter the witness name."
                        : duplicate
                        ? "This phone duplicates another witness."
                        : "Enter a valid phone (10 digits starting with 0)."}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-[11px] text-muted-foreground">Format: 0XXXXXXXXX</Text>
                  )}
                </View>

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
    </View>
  );
}
