// app/(app)/alerts/citizen.tsx
import { useNavigation } from "@react-navigation/native";
import { AppCard, AppScreen, Pill, ScreenHeader, SectionHeader } from "@/components/app/shell";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import useMountAnimation from "@/hooks/useMountAnimation";

import {
    AlertTriangle,
    Eye,
    EyeOff,
    MapPin,
    Megaphone,
} from "lucide-react-native";

type Role = "citizen" | "officer";

type AlertRow = {
  id: string;
  title: string;
  message: string;
  region: string;
  meta?: string; // e.g., "Today", "Until 6 PM"
};

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

  // Mock: nearby/active alerts; region matching can be added later
  const initial = useMemo<AlertRow[]>(
    () => [
      {
        id: "a1",
        title: "Road closure at Main St",
        message: "Main St is closed between 3rd and 6th from 9–12 for a parade. Use the 5th Ave detour.",
        region: "Central Branch",
        meta: "Today",
      },
      {
        id: "a2",
        title: "Heavy rain advisory",
        message: "Avoid low-lying roads. Expect flash floods in underpasses. Drive carefully.",
        region: "West Branch",
        meta: "Until 6 PM",
      },
      {
        id: "a3",
        title: "Power maintenance: Sector 12",
        message: "Scheduled maintenance tonight 1–3 AM. Temporary outages possible in Sector 12.",
        region: "North Branch",
        meta: "Tonight",
      },
    ],
    []
  );

  // Local state for read/expanded
  const [rows, setRows] = useState(
    initial.map((r) => ({ ...r, isRead: false as boolean, expanded: false as boolean }))
  );

  const toggleExpanded = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));

  const toggleRead = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: !r.isRead } : r)));

  const anyDestructive = rows.length > 0; // simple banner trigger

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
          <AppCard translucent className="flex-row items-center gap-3 border border-destructive/30">
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
          />

          <View className="gap-3">
            {rows.length === 0 ? (
              <View className="items-center gap-3 rounded-2xl bg-white/60 p-6">
                <Megaphone size={28} color="#0F172A" />
                <Text className="text-sm font-semibold text-foreground">No nearby alerts</Text>
                <Text className="text-center text-xs text-muted-foreground">
                  Great news — nothing urgent in your area right now.
                </Text>
              </View>
            ) : (
              rows.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => toggleExpanded(it.id)}
                  android_ripple={{ color: "rgba(0,0,0,0.05)", borderless: false }}
                  className="active:opacity-95"
                >
                  <View className="rounded-2xl border border-white/60 bg-white/70 p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-2">
                        <Text className={`text-sm font-semibold text-foreground ${it.isRead ? "opacity-60" : ""}`}>
                          {it.title}
                        </Text>
                        <View className="flex-row flex-wrap items-center gap-2">
                          <View className="flex-row items-center gap-1">
                            <MapPin size={14} color="#0F172A" />
                            <Text className="text-xs text-muted-foreground">{it.region}</Text>
                          </View>
                          {it.meta ? <Text className="text-xs text-muted-foreground">• {it.meta}</Text> : null}
                        </View>
                      </View>
                      <Pill tone={it.isRead ? "neutral" : "primary"} label={it.isRead ? "Read" : "New"} />
                    </View>

                    {it.expanded ? (
                      <View className="mt-3 gap-3 rounded-2xl bg-white/80 p-3">
                        <Text className="text-[13px] text-foreground">{it.message}</Text>

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
              ))
            )}
          </View>
        </AppCard>
      </Animated.View>
    </AppScreen>
  );
}
