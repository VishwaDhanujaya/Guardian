import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { createFoundItem, fetchLostItems, LostItemDetail } from "@/lib/api";

import { Inbox, MapPin, Megaphone, PackageSearch, Plus } from "lucide-react-native";

type FoundItem = {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serial?: string;
  lastLocation?: string;
  color?: string;
  branch?: string;
  postedAt?: string;
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

const toFoundItemCard = (item: LostItemDetail): FoundItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  model: item.model,
  serial: item.serial,
  lastLocation: item.lastLocation,
  color: item.color,
  branch: item.branch,
  postedAt: formatRelativeTime(item.createdAt ?? undefined),
});

export default function OfficerFound() {
  const navigation = useNavigation<any>();
  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: "officer" } });
  };

  const { value: mount } = useMountAnimation({ damping: 14, stiffness: 160, mass: 0.6 });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const [items, setItems] = useState<FoundItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const records = await fetchLostItems();
      const found = records
        .filter((item) => item.status === "Returned")
        .map((item) => toFoundItemCard(item));
      setItems(found);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load found items");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [lastLoc, setLastLoc] = useState("");
  const [color, setColor] = useState("");
  const [branch, setBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDesc("");
    setModel("");
    setSerial("");
    setLastLoc("");
    setColor("");
    setBranch("");
  };

  const addFound = async () => {
    const trimmedName = name.trim();
    const trimmedDesc = desc.trim();
    const trimmedModel = model.trim();
    const trimmedSerial = serial.trim();
    const trimmedColor = color.trim();
    const trimmedBranch = branch.trim();
    const trimmedLocation = lastLoc.trim();

    if (!trimmedName || !trimmedLocation || !trimmedBranch) {
      toast.error("Please fill the required fields");
      return;
    }

    try {
      setSubmitting(true);
      const created = await createFoundItem({
        name: trimmedName,
        description: trimmedDesc || undefined,
        model: trimmedModel || undefined,
        serial: trimmedSerial || undefined,
        color: trimmedColor || undefined,
        branch: trimmedBranch,
        latitude: 0,
        longitude: 0,
      });
      const card = {
        ...toFoundItemCard(created),
        lastLocation: trimmedLocation || created.lastLocation,
        branch: trimmedBranch,
      };
      setItems((prev) => [card, ...prev]);
      toast.success("Found item posted");
      reset();
      setOpenForm(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to post item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen
      scrollComponent={KeyboardAwareScrollView}
      scrollViewProps={{
        enableOnAndroid: true,
        enableAutomaticScroll: true,
        keyboardShouldPersistTaps: "handled",
        extraScrollHeight: 120,
      }}
      contentClassName="px-5 pb-8"
    >
      <ScreenHeader
        title="Found items"
        subtitle="Log and publish items collected by officers so citizens can reclaim them."
        icon={Megaphone}
        onBack={goBack}
        action={<Pill label={`${items.length}`} tone="neutral" />}
      />

      <Animated.View style={animStyle}>
        <AppCard className="gap-5 p-5">
          <SectionHeader
            title="Create a found item post"
            description="Collect key identifiers so citizens can recognise their belongings."
            trailing={
              <Button
                variant="secondary"
                className="h-9 rounded-lg px-3"
                onPress={() => {
                  if (openForm) reset();
                  setOpenForm((v) => !v);
                }}
                disabled={submitting}
              >
                <Text className="text-[12px] text-foreground">{openForm ? "Close" : "Add new"}</Text>
              </Button>
            }
          />

          {openForm ? (
            <View className="gap-4 rounded-2xl border border-border bg-muted/60 p-4">
              <View className="gap-1">
                <Label>Item name*</Label>
                <Input value={name} onChangeText={setName} placeholder="e.g. Black backpack" />
              </View>
              <View className="gap-1">
                <Label>Description</Label>
                <Input value={desc} onChangeText={setDesc} placeholder="Any distinguishing details" />
              </View>
              <View className="gap-1">
                <Label>Model</Label>
                <Input value={model} onChangeText={setModel} placeholder="If applicable" />
              </View>
              <View className="gap-1">
                <Label>Serial/IMEI (optional)</Label>
                <Input value={serial} onChangeText={setSerial} placeholder="Helps verify ownership" />
              </View>
              <View className="gap-1">
                <Label>Colour</Label>
                <Input value={color} onChangeText={setColor} placeholder="Primary colour" />
              </View>
              <View className="gap-1">
                <Label>Police branch</Label>
                <Input value={branch} onChangeText={setBranch} placeholder="Where the item is kept" />
              </View>
              <View className="gap-1">
                <Label>Last location*</Label>
                <Input value={lastLoc} onChangeText={setLastLoc} placeholder="Where it was found" />
              </View>

              <View className="flex-row items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  className="h-9 rounded-lg px-3"
                  onPress={() => {
                    reset();
                    setOpenForm(false);
                  }}
                  disabled={submitting}
                >
                  <Text className="text-[12px] text-foreground">Cancel</Text>
                </Button>
                <Button className="h-9 rounded-lg px-3" onPress={addFound} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="text-[12px] text-primary-foreground">Post</Text>
                  )}
                </Button>
              </View>
            </View>
          ) : (
            <View className="rounded-2xl border border-dashed border-border bg-background/60 p-4">
              <Text className="text-[12px] text-muted-foreground">
                Capture the item’s key attributes so the rightful owner can identify it quickly.
              </Text>
            </View>
          )}
        </AppCard>
      </Animated.View>

      <Animated.View style={animStyle}>
        <AppCard className="gap-4 p-5">
          <SectionHeader
            title="Published posts"
            description="Tap a card to view or update the detailed entry."
            trailing={<Pill label={loadingItems ? "Loading…" : `${items.length} live`} tone="primary" />}
          />

          {loadingItems ? (
            <View className="items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-6">
              <ActivityIndicator color="#0F172A" />
              <Text className="text-xs text-muted-foreground">Loading found items…</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-border bg-background/60 p-6">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-ring/10">
                <Inbox size={28} color="#0F172A" />
              </View>
              <Text className="mt-3 font-semibold text-foreground">No found items yet</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Use “Add new” to share items turned in at your station.
              </Text>
            </View>
          ) : (
            items.map((it) => {
              const locationLabel = (it.lastLocation ?? "").trim();
              const showLocation = locationLabel.length > 0 && locationLabel !== it.branch;

              return (
                <Pressable
                  key={it.id}
                  className="rounded-2xl border border-border bg-background px-4 py-4"
                  onPress={() =>
                    router.push({ pathname: "/lost-found/view", params: { id: it.id, type: "found", role: "officer" } })
                  }
                  android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 pr-1">
                      <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                        {it.name}
                      </Text>
                      {it.description ? (
                        <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={3}>
                          {it.description}
                        </Text>
                      ) : null}
                    </View>

                  <Pill tone="neutral" icon={PackageSearch} label={it.postedAt ?? "Just now"} />
                  </View>

                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {it.model ? <Tag label={`Model: ${it.model}`} /> : null}
                    {it.serial ? <Tag label={`Serial: ${it.serial}`} /> : null}
                    {it.color ? <Tag label={`Colour: ${it.color}`} /> : null}
                    {showLocation ? <Tag label={`Location: ${locationLabel}`} icon={MapPin} /> : null}
                    {it.branch ? <Tag label={`Branch: ${it.branch}`} /> : null}
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

const Tag = ({ label, icon: Icon }: { label: string; icon?: typeof MapPin }) => (
  <View className="flex-row items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
    {Icon ? <Icon size={12} color="#0F172A" /> : null}
    <Text className="text-[11px] text-foreground">{label}</Text>
  </View>
);
