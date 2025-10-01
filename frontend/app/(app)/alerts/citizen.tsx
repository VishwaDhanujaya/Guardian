// app/(app)/alerts/citizen.tsx
import { useNavigation } from "@react-navigation/native";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";
import { fetchAlerts, formatRelativeTime, type AlertRow as AlertRecord } from "@/lib/api";
import { toast } from "@/components/toast";

import { AlertTriangle, Eye, EyeOff, Megaphone } from "lucide-react-native";

type Role = "citizen" | "officer";

type AlertRow = AlertRecord & {
  isRead: boolean;
  expanded: boolean;
};

const ALERT_TONES: Record<string, "destructive" | "primary" | "accent" | "ring"> = {
  emergency: "destructive",
  urgent: "destructive",
  weather: "primary",
  maintenance: "accent",
  info: "ring",
};

function resolveAlertTone(type?: string): "destructive" | "primary" | "accent" | "ring" {
  if (!type) return "ring";
  const key = type.toLowerCase();
  return ALERT_TONES[key] ?? (key.includes("emergency") ? "destructive" : "primary");
}

function formatAlertType(type?: string): string {
  if (!type) return "General";
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function CitizenAlerts() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const resolvedRole: Role = role === "officer" ? "officer" : "citizen";
  const roleLabel = resolvedRole === "officer" ? "Officer" : "Citizen";

  // Entrance animation
  const { value: mount } = useMountAnimation({
    damping: 14,
    stiffness: 160,
    mass: 0.6,
  });
  const animStyle = {
    opacity: mount.interpolate({ inputRange: [0.9, 1], outputRange: [0.95, 1] }),
    transform: [{ translateY: mount.interpolate({ inputRange: [0.9, 1], outputRange: [6, 0] }) }],
  } as const;

  const navigation = useNavigation<any>();
  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else router.replace({ pathname: "/home", params: { role: resolvedRole } });
  };

  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAlerts();
      setRows((prev) => {
        const previous = new Map(prev.map((item) => [item.id, item] as const));
        return data.map((alert) => {
          const existing = previous.get(alert.id);
          return {
            ...alert,
            isRead: existing?.isRead ?? false,
            expanded: existing?.expanded ?? false,
          };
        });
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to load alerts";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const toggleExpanded = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));

  const toggleRead = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: !r.isRead } : r)));

  const anyDestructive = rows.some((r) => resolveAlertTone(r.type) === "destructive");

  return (
    <AppScreen contentClassName="gap-6">
      <Animated.View style={animStyle} className="gap-5">
        <ScreenHeader
          title="Safety alerts"
          subtitle={`${roleLabel} view`}
          icon={Megaphone}
          onBack={goBack}
          action={<Pill tone="primary" label={roleLabel} />}
        />

        {anyDestructive ? (
          <AppCard className="flex-row items-center gap-3 border border-destructive/40">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle size={18} color="#B91C1C" />
            </View>
            <Text className="flex-1 text-[13px] text-destructive">If this is an emergency, call 119 immediately.</Text>
          </AppCard>
        ) : null}

        <AppCard className="gap-4">
          <SectionHeader
            eyebrow="Live updates"
            title="Nearby alerts"
            description="Stay informed about urgent messages shared across your community."
            trailing={
              <Button
                size="sm"
                variant="secondary"
                onPress={loadAlerts}
                className="h-9 rounded-full px-3"
                disabled={loading}
              >
                <Text className="text-[12px] text-foreground">{loading ? "Refreshing…" : "Refresh"}</Text>
              </Button>
            }
          />

          <View className="gap-3">
            {loading && rows.length === 0 ? (
              <View className="items-center gap-3 rounded-2xl bg-muted p-6">
                <ActivityIndicator size="small" color="#0F172A" />
                <Text className="text-sm font-semibold text-foreground">Loading alerts…</Text>
                <Text className="text-center text-xs text-muted-foreground">
                  Fetching the latest safety notifications.
                </Text>
              </View>
            ) : error && rows.length === 0 ? (
              <View className="items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
                <Text className="text-sm font-semibold text-destructive">Unable to load alerts</Text>
                <Text className="text-center text-xs text-destructive/80">{error}</Text>
                <Button onPress={loadAlerts} size="sm" className="h-9 rounded-full px-4">
                  <Text className="text-[12px] text-primary-foreground">Try again</Text>
                </Button>
              </View>
            ) : rows.length === 0 ? (
              <View className="items-center gap-3 rounded-2xl bg-muted p-6">
                <Megaphone size={28} color="#0F172A" />
                <Text className="text-sm font-semibold text-foreground">No nearby alerts</Text>
                <Text className="text-center text-xs text-muted-foreground">
                  Great news — nothing urgent in your area right now.
                </Text>
              </View>
            ) : (
              rows.map((it) => {
                const tone = resolveAlertTone(it.type);
                const pillTone = it.isRead
                  ? "neutral"
                  : tone === "destructive"
                  ? "danger"
                  : tone === "accent"
                  ? "accent"
                  : "primary";
                const detailLine = [
                  it.type ? formatAlertType(it.type) : null,
                  it.createdAt ? formatRelativeTime(it.createdAt) : null,
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Pressable
                    key={it.id}
                    onPress={() => toggleExpanded(it.id)}
                    android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
                    className="active:opacity-95"
                  >
                    <View className="rounded-2xl border border-border bg-white p-4">
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1 gap-2">
                          <Text
                            className={`text-sm font-semibold text-foreground ${it.isRead ? "opacity-60" : ""}`}
                          >
                            {it.title}
                          </Text>
                          {detailLine ? (
                            <View className="flex-row flex-wrap items-center gap-2">
                              <View className="flex-row items-center gap-1">
                                <Megaphone size={14} color="#0F172A" />
                                <Text className="text-xs text-muted-foreground">{detailLine}</Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                        <Pill tone={pillTone} label={it.isRead ? "Read" : "New"} />
                      </View>

                      {it.expanded ? (
                        <View className="mt-3 gap-3 rounded-2xl bg-muted p-3">
                          <Text className="text-[13px] text-foreground">{it.description}</Text>

                          <View className="flex-row items-center justify-end">
                            <Button
                              variant="secondary"
                              className="h-10 rounded-full px-4"
                              onPress={() => toggleRead(it.id)}
                            >
                              <View className="flex-row items-center gap-1">
                                {it.isRead ? <EyeOff size={14} color="#0F172A" /> : <Eye size={14} color="#0F172A" />}
                                <Text className="text-[12px] text-foreground">
                                  {it.isRead ? "Marked as read" : "Mark as read"}
                                </Text>
                              </View>
                            </Button>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}
