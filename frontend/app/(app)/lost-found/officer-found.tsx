import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";

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

  const [items, setItems] = useState<FoundItem[]>([
    {
      id: "f1",
      name: "Wallet",
      description: "Brown leather, cards inside",
      lastLocation: "Negombo PS",
      color: "Brown",
      branch: "Negombo",
      postedAt: "Today 10:30",
    },
    {
      id: "f2",
      name: "Phone",
      description: "Samsung, black case",
      model: "S21",
      lastLocation: "Colombo Central",
      color: "Black",
      branch: "Colombo",
      postedAt: "Yesterday 15:20",
    },
  ]);

  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [lastLoc, setLastLoc] = useState("");
  const [color, setColor] = useState("");
  const [branch, setBranch] = useState("");

  const reset = () => {
    setName("");
    setDesc("");
    setModel("");
    setSerial("");
    setLastLoc("");
    setColor("");
    setBranch("");
  };

  const addFound = () => {
    if (!name.trim() || !lastLoc.trim()) {
      toast.error("Please fill the required fields");
      return;
    }
    const newItem: FoundItem = {
      id: `f_${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || undefined,
      model: model.trim() || undefined,
      serial: serial.trim() || undefined,
      lastLocation: lastLoc.trim(),
      color: color.trim() || undefined,
      branch: branch.trim() || "Unknown",
      postedAt: new Date().toLocaleString(),
    };
    setItems((prev) => [newItem, ...prev]);
    toast.success("Found item posted");
    reset();
    setOpenForm(false);
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
                >
                  <Text className="text-[12px] text-foreground">Cancel</Text>
                </Button>
                <Button className="h-9 rounded-lg px-3" onPress={addFound}>
                  <Text className="text-[12px] text-primary-foreground">Post</Text>
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
            trailing={<Pill label={`${items.length} live`} tone="primary" />}
          />

          {items.length === 0 ? (
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
            items.map((it) => (
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

                  <Pill tone="neutral" icon={PackageSearch} label={it.postedAt ?? "Unscheduled"} />
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {it.model ? <Tag label={`Model: ${it.model}`} /> : null}
                  {it.serial ? <Tag label={`Serial: ${it.serial}`} /> : null}
                  {it.color ? <Tag label={`Colour: ${it.color}`} /> : null}
                  {it.lastLocation ? <Tag label={`Location: ${it.lastLocation}`} icon={MapPin} /> : null}
                  {it.branch ? <Tag label={`Branch: ${it.branch}`} /> : null}
                </View>
              </Pressable>
            ))
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
