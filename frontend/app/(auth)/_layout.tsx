import { Stack } from "expo-router";

/**
 * Authentication stack layout with headerless screens for login flows.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="mfa" />
    </Stack>
  );
}
