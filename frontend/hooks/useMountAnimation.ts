import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Provides a simple spring entrance animation for mounting components, returning the animated
 * value and style helpers for convenience.
 */
export function useMountAnimation(config: Partial<Animated.SpringAnimationConfig> = {}) {
  const value = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(value, {
      toValue: 1,
      useNativeDriver: true,
      ...config,
    }).start();
  }, [value]);

  return {
    value,
    style: {
      opacity: value,
      transform: [{ scale: value }],
    },
  };
}

export default useMountAnimation;
