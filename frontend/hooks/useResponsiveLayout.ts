import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export type ResponsiveLayout = {
  width: number;
  isCompact: boolean;
  isCozy: boolean;
  horizontalPadding: number;
  contentGap: number;
  sectionGap: number;
  cardSpacing: number;
  maxContentWidth: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const isCompact = width < 360;
    const isCozy = width < 520;

    const horizontalPadding = width >= 1024
      ? 40
      : width >= 768
      ? 32
      : width >= 480
      ? 24
      : width >= 360
      ? 20
      : 16;

    const contentGap = isCompact ? 20 : isCozy ? 24 : 28;
    const sectionGap = isCompact ? 20 : 24;
    const cardSpacing = isCompact ? 14 : 18;
    const maxContentWidth = Math.max(
      width - horizontalPadding * 2,
      width * 0.92,
      0,
    );

    return {
      width,
      isCompact,
      isCozy,
      horizontalPadding,
      contentGap,
      sectionGap,
      cardSpacing,
      maxContentWidth,
    };
  }, [width]);
}
