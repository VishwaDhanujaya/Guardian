import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { fetchFoundItems, FoundItem, reportLostItem } from "@/lib/api";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, PackageSearch, Plus, Search as SearchIcon, X } from "lucide-react-native";

export default function CitizenLostFound() {
  const navigation = useNavigation<any>();
  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace("/home?role=citizen");
  };

  const { value: mount } = useMountAnimation();
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);

  useEffect(() => {
    fetchFoundItems()
      .then(setFoundItems)
      .catch(() => toast.error("Failed to load items"))
      .finally(() => setLoadingItems(false));
  }, []);

  const filteredItems = foundItems.filter((f) => {
    const needle = search.toLowerCase();
    const title = f.title.toLowerCase();
    const meta = f.meta?.toLowerCase?.() ?? "";
    return title.includes(needle) || meta.includes(needle);
  });


  // lost form state
  const [itemName, setItemName] = useState("");
  const [desc, setDesc] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [color, setColor] = useState("");
  const [branch, setBranch] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const resetForm = () => {
    setItemName("");
    setDesc("");
    setModel("");
    setSerial("");
    setColor("");
    setBranch("");
    setLatitude("");
    setLongitude("");
  };

  const [submitting, setSubmitting] = useState(false);
  const submitLost = async () => {
    if (!itemName || !branch || !latitude || !longitude) {
      toast.error("Please fill required fields");
      return;
    }
    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      toast.error("Coordinates must be valid numbers");
      return;
    }
    try {
      setSubmitting(true);
      await reportLostItem({
        itemName,
        description: desc,
        model,
        serial,
        color,
        branch,
        latitude: latNum,
        longitude: lonNum,
        status: "PENDING",
      });
      toast.success("Lost item reported");
      resetForm();
      setOpenForm(false);
      router.replace({ pathname: "/incidents/my-reports", params: { role: "citizen", filter: "lost" } });
    } catch (e) {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={120}
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 160 }}
    >
      <View className="flex-1 p-5">
        {/* Top bar */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={goBack} className="flex-row items-center gap-1 px-2 py-1 -ml-2 rounded-md active:opacity-80">
            <ChevronLeft size={18} color="#000000" />
            <Text className="text-foreground">Back</Text>
          </Pressable>
          <View className="flex-row items-center gap-2">
            <PackageSearch size={18} color="#000000" />
            <Text className="text-xl font-semibold text-foreground">Lost &amp; Found</Text>
          </View>
          <View style={{ width: 56 }} />
        </View>
        
        <Animated.View className="bg-muted rounded-md border border-border p-4 shadow-sm" style={animStyle}>
          <View className="relative mb-4">
            <SearchIcon
              size={16}
              color="#94A3B8"
              style={{ position: "absolute", left: 12, top: 10 }}
            />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search found items"
              className="bg-background h-10 rounded-md pl-9 font-sans"
            />
          </View>

          <View className="gap-2">
            {loadingItems ? (
              <View className="items-center justify-center gap-2 py-6">
                <ActivityIndicator color="#000000" />
                <Text className="text-xs text-muted-foreground">Loading latest items…</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View className="items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background py-10">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <PackageSearch size={20} color="#0F172A" />
                </View>
                <Text className="font-semibold text-foreground">No items found</Text>
                <Text className="px-6 text-center text-xs text-muted-foreground">
                  Try adjusting your search or check back in a little while.
                </Text>
              </View>
            ) : (
              filteredItems.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() =>
                    router.push({ pathname: "/lost-found/view", params: { id: f.id, type: "found", role: "citizen" } })
                  }
                  className="bg-background rounded-md border border-border px-3 py-3 shadow-sm active:opacity-80"
                >
                  <View className="mb-1 flex-row items-center gap-2">
                    <PackageSearch size={16} color="#000000" />
                    <Text className="text-foreground">{f.title}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{f.meta}</Text>
                </Pressable>
              ))
            )}
          </View>
        </Animated.View>

        <View className="absolute bottom-10 right-6 items-center gap-1">
          <Button
            onPress={() => setOpenForm(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg shadow-black/20"
            style={{ elevation: 6 }}
            accessibilityLabel="Report lost item"
            accessibilityHint="Open the form to report a lost possession"
          >
            <Plus size={24} color="#FFFFFF" />
          </Button>
          <Text className="text-xs font-medium text-muted-foreground">Report lost item</Text>
        </View>

        <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
          <KeyboardAwareScrollView
            enableOnAndroid
            keyboardShouldPersistTaps="handled"
            extraScrollHeight={120}
            style={{ flex: 1, backgroundColor: "#FFFFFF" }}
            contentContainerStyle={{ flexGrow: 1, backgroundColor: "#FFFFFF" }}
          >
            <View className="flex-1 p-5">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-semibold text-foreground">Report lost item</Text>
                <Pressable onPress={() => setOpenForm(false)} hitSlop={8} className="rounded-md active:opacity-80">
                  <X size={20} color="#000000" />
                </Pressable>
              </View>
              <View className="gap-4">
                <View className="gap-1">
                  <Label>Item name*</Label>
                  <Input value={itemName} onChangeText={setItemName} />
                </View>
                <View className="gap-1">
                  <Label>Description</Label>
                  <Input value={desc} onChangeText={setDesc} />
                </View>
                <View className="gap-1">
                  <Label>Model</Label>
                  <Input value={model} onChangeText={setModel} />
                </View>
                <View className="gap-1">
                  <Label>Serial/IMEI (optional)</Label>
                  <Input value={serial} onChangeText={setSerial} />
                </View>
                <View className="gap-1">
                  <Label>Colour</Label>
                  <Input value={color} onChangeText={setColor} />
                </View>
                <View className="gap-1">
                  <Label>Police branch*</Label>
                  <Input value={branch} onChangeText={setBranch} />
                </View>
                <View className="gap-1">
                  <Label>Latitude*</Label>
                  <Input value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
                </View>
                <View className="gap-1">
                  <Label>Longitude*</Label>
                  <Input value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
                </View>
                <Button onPress={submitLost} className="mt-2 h-11 rounded-lg" disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <Plus size={16} color="#fff" />
                      <Text className="text-primary-foreground ml-1">Submit</Text>
                    </View>
                  )}
                </Button>
              </View>
            </View>
          </KeyboardAwareScrollView>
        </Modal>
      </View>
    </KeyboardAwareScrollView>
  );
}
