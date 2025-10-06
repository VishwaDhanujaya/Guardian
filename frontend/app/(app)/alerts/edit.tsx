import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { getAlert, saveAlert, AlertDraft } from "@/lib/api";
import useMountAnimation from "@/hooks/useMountAnimation";
import { ChevronLeft, Megaphone, Pencil, Save } from "lucide-react-native";

type Role = "citizen" | "officer";

/**
 * Alert editor for creating or updating safety alerts.
 * Restricts access to officers and pre-fills when editing an existing alert.
 *
 * @returns The alert edit form UI.
 */
export default function EditAlert() {
  const { role, id } = useLocalSearchParams<{ role?: string; id?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";

  const navigation = useNavigation<any>();
  const goBack = useCallback(() => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/alerts/manage", params: { role: resolvedRole } });
  }, [navigation, resolvedRole]);

  const { value: mount } = useMountAnimation({
    damping: 14,
    stiffness: 160,
    mass: 0.6,
  });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const [existing, setExisting] = useState<AlertDraft | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertType, setAlertType] = useState("");
  const [messageHeight, setMessageHeight] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    getAlert(id)
      .then((data) => {
        setExisting(data);
        setTitle(data.title);
        setDescription(data.description);
        setAlertType(data.type);
      })
      .catch(() => toast.error("Failed to load alert"))
      .finally(() => setLoading(false));
  }, [id]);

  // Validation
  const canSave =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    alertType.trim().length > 0;

  const onSave = async () => {
    if (!canSave || saving) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      setSaving(true);
      await saveAlert({ id: existing?.id, title, description, type: alertType });
      toast.success(existing?.id ? "Alert updated" : "Alert created");
      router.replace({ pathname: "/alerts/manage", params: { role: "officer" } });
    } catch (e) {
      toast.error("Failed to save alert");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !existing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator color="#0F172A" />
      </View>
    );
  }

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
              <Megaphone size={18} color="#0F172A" />
              <Text className="text-xl font-semibold text-foreground">
                {existing ? "Edit alert" : "New alert"}
              </Text>
            </View>

            <View style={{ width: 56 }} />
          </View>

          {/* Form */}
          <Animated.View className="bg-muted rounded-2xl border border-border p-4 gap-3" style={animStyle}>
            {/* Title */}
            <View>
              <Label nativeID="titleLbl">
                <Text className="text-[12px] text-foreground">Title *</Text>
              </Label>
              <Input
                aria-labelledby="titleLbl"
                value={title}
                onChangeText={setTitle}
                placeholder="E.g., Road closure at Main St"
                className="bg-background rounded-xl mt-1"
                returnKeyType="next"
              />
            </View>

            {/* Type */}
            <View>
              <Label nativeID="typeLbl">
                <Text className="text-[12px] text-foreground">Type *</Text>
              </Label>
              <Input
                aria-labelledby="typeLbl"
                value={alertType}
                onChangeText={setAlertType}
                placeholder="E.g., Weather, Road, Safety"
                className="bg-background rounded-xl mt-1"
                returnKeyType="next"
              />
            </View>

            {/* Message */}
            <View>
              <Label nativeID="messageLbl">
                <Text className="text-[12px] text-foreground">Description *</Text>
              </Label>
              <Input
                aria-labelledby="messageLbl"
                value={description}
                onChangeText={setDescription}
                onContentSizeChange={(e) => setMessageHeight(e.nativeEvent.contentSize.height)}
                placeholder="Describe the alert clearly…"
                className="bg-background rounded-xl mt-1"
                style={{
                  minHeight: 120,
                  height: Math.max(120, messageHeight ?? 0),
                  textAlignVertical: "top",
                  paddingTop: 12,
                }}
                multiline
                numberOfLines={6}
                scrollEnabled={false}
              />
            </View>

            {/* Actions */}
            <View className="flex-row items-center justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                className="h-10 px-3 rounded-lg"
                onPress={goBack}
              >
                <Text className="text-[13px] text-foreground">Cancel</Text>
              </Button>
              <Button
                className="h-10 px-3 rounded-lg"
                disabled={!canSave || saving}
                onPress={onSave}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View className="flex-row items-center gap-1">
                    {existing ? <Pencil size={16} color="#FFFFFF" /> : <Save size={16} color="#FFFFFF" />}
                    <Text className="text-[13px] text-primary-foreground">
                      {existing ? "Save changes" : "Create alert"}
                    </Text>
                  </View>
                )}
              </Button>
            </View>

              {!canSave ? (
                <Text className="text-[11px] text-muted-foreground mt-1">
                  Title, Type and Description are required.
                </Text>
              ) : null}
          </Animated.View>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
