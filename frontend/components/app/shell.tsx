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
  scrollViewProps?: ScrollViewProps & Record<string, any>;
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
              <View className={cn("gap-6", contentClassName)}>{children}</View>
            </ScrollCmp>
          ) : (
            <View className={cn("flex-1 gap-6", className)} style={styles.nonScroll}>
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
        className={cn("rounded-2xl", className)}
        style={[
          styles.cardBase,
          translucent ? styles.cardTranslucent : styles.cardSolid,
          style,
        ]}
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
    <View className="mb-3 w-full flex-row flex-wrap items-start gap-y-3 gap-x-3">
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
      {trailing ? (
        <View className="flex-row items-center justify-end gap-2" style={{ flexShrink: 0 }}>
          {trailing}
        </View>
      ) : null}
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
  primary: { bg: "#E0EAFF", fg: "#1E3A8A" },
  accent: { bg: "#D1FAF5", fg: "#0F766E" },
  neutral: { bg: "#E2E8F0", fg: "#0F172A" },
  danger: { bg: "#FEE2E2", fg: "#B91C1C" },
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
    <View className="mb-6 flex-row items-center justify-between">
      <View className="flex-row flex-1 items-center gap-3">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="h-9 w-9 items-center justify-center rounded-full bg-white"
            style={styles.backButtonShadow}
            hitSlop={10}
          >
            <ChevronLeft size={18} color="#0F172A" />
          </Pressable>
        ) : null}

        {Icon ? (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Icon size={18} color="#0F172A" />
          </View>
        ) : null}

        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          {subtitle ? <Text className="text-xs text-muted-foreground">{subtitle}</Text> : null}
        </View>
      </View>

      {action ? <View className="pl-3">{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 12,
    gap: 24,
  } as any,
  nonScroll: {
    paddingTop: 12,
  },
  fabSlot: {
    position: "absolute",
    right: 20,
    bottom: 20,
  },
  fabInner: {
    alignSelf: "flex-end",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardBase: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    padding: 18,
  },
  cardSolid: {
    backgroundColor: "#FFFFFF",
  },
  cardTranslucent: {
    backgroundColor: "#F8FAFC",
  },
  backButtonShadow: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
