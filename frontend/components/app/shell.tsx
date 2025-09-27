import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";
import { forwardRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChevronLeft } from "lucide-react-native";

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  scrollComponent?: ComponentType<any>;
  scrollViewProps?: ScrollViewProps;
  contentClassName?: string;
  contentStyle?: ViewProps["style"];
  className?: string;
  floatingAction?: ReactNode;
};

/**
 * Shared atmospheric wrapper for app screens.
 * Adds a soft backdrop, consistent padding, and optional floating action area.
 */
export function AppScreen({
  children,
  scroll = true,
  scrollComponent: ScrollComponent = ScrollView,
  scrollViewProps,
  contentClassName,
  contentStyle,
  className,
  floatingAction,
}: AppScreenProps) {
  const ScrollCmp = ScrollComponent as ComponentType<any>;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.decorContainer} pointerEvents="none">
          <View style={[styles.blob, styles.blobTop]} />
          <View style={[styles.blob, styles.blobBottom]} />
        </View>

        <View style={styles.body}>
          {scroll ? (
            <ScrollCmp
              showsVerticalScrollIndicator={false}
              {...scrollViewProps}
              className={cn("flex-1", className, scrollViewProps?.className)}
              contentContainerStyle={[
                styles.scrollContent,
                scrollViewProps?.contentContainerStyle,
                contentStyle,
              ]}
            >
              <View className={cn("gap-5", contentClassName)}>{children}</View>
            </ScrollCmp>
          ) : (
            <View className={cn("flex-1 gap-5", className)} style={styles.nonScroll}>
              {children}
            </View>
          )}

          {floatingAction ? (
            <View style={styles.fabSlot} pointerEvents="box-none">
              <View style={styles.fabInner}>{floatingAction}</View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

type AppCardProps = ViewProps & {
  translucent?: boolean;
};

/**
 * Frosted card surface with rounded corners and subtle drop shadow.
 */
export const AppCard = forwardRef<View, AppCardProps>(
  ({ className, style, translucent = false, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn("rounded-3xl", translucent ? "bg-white/70" : "bg-white/90", className)}
        style={[styles.cardBase, translucent ? styles.cardTranslucent : styles.cardSolid, style]}
        {...props}
      />
    );
  }
);
AppCard.displayName = "AppCard";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

/**
 * Standardised section heading with optional eyebrow and trailing action.
 */
export function SectionHeader({ eyebrow, title, description, trailing }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-3">
      <View className="flex-1 gap-1">
        {eyebrow ? (
          <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-primary/70">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        {description ? (
          <Text className="text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {trailing ? <View className="items-end justify-center">{trailing}</View> : null}
    </View>
  );
}

type PillProps = ViewProps & {
  tone?: "primary" | "accent" | "neutral" | "danger";
  icon?: ComponentType<{ size?: number; color?: string }>;
  label: string;
};

/**
 * Compact pill badge for statuses/counts.
 */
export function Pill({ tone = "neutral", icon: Icon, label, className, style, ...props }: PillProps) {
  const palette = PILL_TONES[tone] ?? PILL_TONES.neutral;
  return (
    <View
      className={cn("flex-row items-center gap-1 rounded-full px-3 py-1", className)}
      style={[{ backgroundColor: palette.bg }, style]}
      {...props}
    >
      {Icon ? <Icon size={14} color={palette.fg} /> : null}
      <Text className="text-[12px] font-medium" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}

const PILL_TONES = {
  primary: { bg: "rgba(37, 99, 235, 0.12)", fg: "#1E40AF" },
  accent: { bg: "rgba(14, 165, 233, 0.14)", fg: "#0369A1" },
  neutral: { bg: "rgba(15, 23, 42, 0.08)", fg: "#0F172A" },
  danger: { bg: "rgba(220, 38, 38, 0.14)", fg: "#B91C1C" },
} as const;

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  onBack?: () => void;
  action?: ReactNode;
};

/**
 * Soft navigation header with optional back button and trailing action.
 */
export function ScreenHeader({ title, subtitle, icon: Icon, onBack, action }: ScreenHeaderProps) {
  return (
    <View className="mb-6 mt-2 flex-row items-center justify-between">
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="flex-row items-center gap-2 rounded-full bg-white/70 px-3 py-1"
          hitSlop={10}
        >
          <ChevronLeft size={18} color="#0F172A" />
          <Text className="text-sm text-foreground">Back</Text>
        </Pressable>
      ) : (
        <View style={{ width: 64 }} />
      )}

      <View className="items-center gap-1">
        {Icon ? (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-white/70">
            <Icon size={20} color="#0F172A" />
          </View>
        ) : null}
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        {subtitle ? <Text className="text-xs text-muted-foreground">{subtitle}</Text> : null}
      </View>

      {action ? <View>{action}</View> : <View style={{ width: 64 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FF",
  },
  safe: {
    flex: 1,
  },
  decorContainer: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
  } as any,
  blob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260 / 2,
    opacity: 0.45,
  },
  blobTop: {
    top: -110,
    right: -80,
    backgroundColor: "rgba(59, 130, 246, 0.25)",
  },
  blobBottom: {
    bottom: -130,
    left: -70,
    backgroundColor: "rgba(236, 72, 153, 0.18)",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 16,
    gap: 20,
  } as any,
  nonScroll: {
    paddingTop: 16,
  },
  fabSlot: {
    position: "absolute",
    right: 20,
    bottom: 20,
  },
  fabInner: {
    alignSelf: "flex-end",
  },
  cardBase: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    padding: 20,
  },
  cardSolid: {
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  cardTranslucent: {
    backgroundColor: "rgba(255,255,255,0.78)",
  },
});
