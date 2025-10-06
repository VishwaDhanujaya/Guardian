import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

/**
 * iOS tab bar background that uses system materials to mirror native appearance.
 */
export default function BlurTabBarBackground() {
  return (
    <BlurView
      // System chrome material adapts to the active theme to match native chrome.
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Accounts for the translucent iOS tab bar so scroll views leave enough padding.
 */
export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
