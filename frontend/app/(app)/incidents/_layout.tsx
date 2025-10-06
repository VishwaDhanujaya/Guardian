import { Stack } from "expo-router";

/**
 * Incidents stack layout that groups incident workflows without default headers.
 *
 * @returns The stack configuration for incident routes.
 */
export default function IncidentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="manage-incidents" />
      <Stack.Screen name="report-incidents" />
      <Stack.Screen name="my-reports" />
      <Stack.Screen name="view" />
    </Stack>
  );
}
