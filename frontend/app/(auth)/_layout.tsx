import { Stack } from "expo-router";

/**
 * Authentication layout that hides default headers for login-related screens.
 * Keeps configuration minimal because providers live in the root layout.
 *
 * @returns The stack configuration for auth routes.
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
