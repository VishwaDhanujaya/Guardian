import { Stack } from "expo-router";

/**
 * Lost & Found stack layout that keeps related flows grouped and headerless.
 *
 * @returns The stack configuration for lost-and-found routes.
 */
export default function LostFoundLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="citizen" />
      <Stack.Screen name="officer-found" />
      <Stack.Screen name="officer-lost" />
      <Stack.Screen name="view" />
    </Stack>
  );
}
