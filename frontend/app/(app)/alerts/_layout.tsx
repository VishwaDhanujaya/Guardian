import { Stack } from "expo-router";

/**
 * Alerts stack layout that hides headers while grouping alert workflows.
 *
 * @returns The stack configuration for alert routes.
 */
export default function AlertsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="citizen" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
