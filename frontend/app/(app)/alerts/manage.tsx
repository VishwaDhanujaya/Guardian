// app/(app)/alerts/manage.tsx
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { toast } from "@/components/toast";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { AlertRow, deleteAlert, fetchAlerts } from "@/lib/api";
import { cn } from "@/lib/utils";

import { MapPin, Megaphone, Pencil, Plus, Trash2 } from "lucide-react-native";

type Role = "citizen" | "officer";

export default function ManageAlerts() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";
  const isOfficer = resolvedRole === "officer";
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

  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchAlerts()
      .then((list) => {
        setRows(list);
      })
      .catch(() => {
        setLoadError(true);
        toast.error("Failed to load alerts");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visibleRows = useMemo(() => [...rows], [rows]);
  const useTwoColumnLayout = visibleRows.length > 1;
  const twoColumnRows = useMemo(() => {
    if (!useTwoColumnLayout) return [] as AlertRow[][];
    const groups: AlertRow[][] = [];
    for (let i = 0; i < visibleRows.length; i += 2) {
      groups.push(visibleRows.slice(i, i + 2));
    }
    return groups;
  }, [useTwoColumnLayout, visibleRows]);
  const alertCardPadding = "px-4 py-4";

  const createNew = () => {
    if (!isOfficer) return;
    router.push({ pathname: "/alerts/edit", params: { role: "officer" } });
  };

  const editAlert = (id: string) => {
    if (!isOfficer) return;
    router.push({ pathname: "/alerts/edit", params: { role: "officer", id } });
  };

  const deleteAlertRow = (id: string) => {
    if (!isOfficer) return;
    deleteAlert(id)
      .then(() => {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("Alert removed");
      })
      .catch(() => toast.error("Failed to remove alert"));
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
      contentClassName={cn(layout.isCozy ? "px-4" : "px-5", "pb-8")}
    >
      <ScreenHeader
        title={isOfficer ? "Manage alerts" : "Safety alerts"}
        subtitle={
          isOfficer
            ? "Publish urgent notices and keep the community informed."
            : "Review active safety alerts shared by officers."
        }
        icon={Megaphone}
        onBack={goBack}
        action={<Pill label={`${rows.length}`} tone="neutral" />}
      />

      {isOfficer ? (
        <Animated.View style={animStyle}>
          <AppCard className={cn("gap-4", layout.isCozy ? "p-4" : "p-5")}>
            <SectionHeader
              title="Create a new alert"
              description="Draft a message when there’s an urgent update citizens should see."
            />

            <Button className="h-11 rounded-2xl px-4" onPress={createNew}>
              <View className="flex-row items-center justify-center gap-2">
                <Plus size={16} color="#FFFFFF" />
                <Text className="text-[13px] text-primary-foreground">New alert</Text>
              </View>
            </Button>
          </AppCard>
        </Animated.View>
      ) : null}

      <Animated.View style={animStyle}>
        <AppCard className={cn("gap-4", layout.isCozy ? "p-4" : "p-5")}>
          <SectionHeader
            title={isOfficer ? "Active alerts" : "Current alerts"}
            description={
              isOfficer
                ? "Edit or retire alerts as situations evolve."
                : "These alerts were published by your local officers."
            }
            trailing={<Pill label={`${visibleRows.length} shown`} tone="primary" />}
          />

          {loading ? (
            <View
              className={cn(
                "items-center justify-center rounded-2xl border border-border bg-background/70",
                layout.isCozy ? "p-4" : "p-6",
              )}
            >
              <ActivityIndicator color="#0F172A" />
              <Text className="mt-2 text-xs text-muted-foreground">Loading alerts…</Text>
            </View>
          ) : loadError ? (
            <View
              className={cn(
                "items-center rounded-2xl border border-border bg-background/70",
                layout.isCozy ? "p-4" : "p-6",
              )}
            >
              <Text className="font-semibold text-foreground">Unable to load alerts</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Check your connection and try again.
              </Text>
              <Button className="mt-3 h-9 rounded-lg px-4" onPress={reload}>
                <Text className="text-[12px] text-primary-foreground">Retry</Text>
              </Button>
            </View>
          ) : visibleRows.length === 0 ? (
            <View
              className={cn(
                "items-center rounded-2xl border border-dashed border-border bg-background/60",
                layout.isCozy ? "p-4" : "p-6",
              )}
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-ring/10">
                <Megaphone size={28} color="#0F172A" />
              </View>
              <Text className="mt-3 font-semibold text-foreground">No alerts right now</Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                {isOfficer ? "Tap “New alert” to publish one." : "Officers will post here when there’s news."}
              </Text>
            </View>
          ) : useTwoColumnLayout ? (
            twoColumnRows.map((row, rowIdx) => (
              <View key={rowIdx} className="flex-row gap-3">
                {row.map((it) => (
                  <View key={it.id} className="flex-1">
                    <Pressable
                      className={cn(
                        'flex-1 rounded-2xl border border-border bg-background',
                        alertCardPadding,
                      )}
                      onPress={() => editAlert(it.id)}
                      disabled={!isOfficer}
                      android_ripple={isOfficer ? { color: 'rgba(0,0,0,0.04)' } : undefined}
                    >
                      <View className="flex-row flex-wrap items-start justify-between gap-3">
                        <View className="min-w-0 flex-1 pr-1">
                          <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                            {it.title}
                          </Text>
                          <View className="mt-1 flex-row flex-wrap items-center gap-2">
                            <MapPin size={14} color="#0F172A" />
                            <Text className="text-xs text-muted-foreground">{it.type}</Text>
                          </View>
                        </View>
                      </View>

                      {it.description ? (
                        <View className="mt-3 rounded-xl border border-border bg-muted px-3 py-2">
                          <Text className="text-[12px] text-foreground">{it.description}</Text>
                        </View>
                      ) : null}

                      {isOfficer ? (
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 rounded-lg px-3"
                            onPress={() => editAlert(it.id)}
                          >
                            <View className="flex-row items-center gap-1">
                              <Pencil size={14} color="#0F172A" />
                              <Text className="text-[12px] text-foreground">Edit</Text>
                            </View>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-lg px-3"
                            onPress={() => deleteAlertRow(it.id)}
                          >
                            <View className="flex-row items-center gap-1">
                              <Trash2 size={14} color="#DC2626" />
                              <Text className="text-[12px]" style={{ color: '#DC2626' }}>
                                Remove
                              </Text>
                            </View>
                          </Button>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                ))}
                {row.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))
          ) : (
            visibleRows.map((it) => (
              <Pressable
                key={it.id}
                className={cn(
                  'rounded-2xl border border-border bg-background',
                  alertCardPadding,
                )}
                onPress={() => editAlert(it.id)}
                disabled={!isOfficer}
                android_ripple={isOfficer ? { color: 'rgba(0,0,0,0.04)' } : undefined}
              >
                <View className="flex-row flex-wrap items-start justify-between gap-3">
                  <View className="min-w-0 flex-1 pr-1">
                    <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                      {it.title}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-center gap-2">
                      <MapPin size={14} color="#0F172A" />
                      <Text className="text-xs text-muted-foreground">{it.type}</Text>
                    </View>
                  </View>
                </View>

                {it.description ? (
                  <View className="mt-3 rounded-xl border border-border bg-muted px-3 py-2">
                    <Text className="text-[12px] text-foreground">{it.description}</Text>
                  </View>
                ) : null}

                {isOfficer ? (
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 rounded-lg px-3"
                      onPress={() => editAlert(it.id)}
                    >
                      <View className="flex-row items-center gap-1">
                        <Pencil size={14} color="#0F172A" />
                        <Text className="text-[12px] text-foreground">Edit</Text>
                      </View>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-lg px-3"
                      onPress={() => deleteAlertRow(it.id)}
                    >
                      <View className="flex-row items-center gap-1">
                        <Trash2 size={14} color="#DC2626" />
                        <Text className="text-[12px]" style={{ color: '#DC2626' }}>
                          Remove
                        </Text>
                      </View>
                    </Button>
                  </View>
                ) : null}
              </Pressable>
            ))
          )}
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}
