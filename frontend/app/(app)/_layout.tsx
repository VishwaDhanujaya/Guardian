import { Stack, Redirect } from "expo-router";
import { useContext, useEffect } from "react";
import { AuthContext } from "@/context/AuthContext";

/**
 * Authenticated app layout that protects routes and hosts the primary stacks.
 * Redirects unauthenticated users to the login screen and hides default headers.
 *
 * @returns The stack configuration for authenticated screens.
 */
export default function AppLayout() {
  const { session, checkAuthed } = useContext(AuthContext);

  useEffect(() => {
    checkAuthed();
  }, [checkAuthed]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="incidents" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="lost-found" />
    </Stack>
  );
}
